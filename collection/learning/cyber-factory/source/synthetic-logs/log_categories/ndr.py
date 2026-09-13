"""Synthetic NDR telemetry modeled after Zeek and Suricata records.

All external addresses come from RFC 5737 documentation ranges and all
domains are reserved examples, so generated telemetry cannot point at a real
system. Bursts keep their endpoints stable to make cross-line correlation
possible.
"""

import random
import string

from .base import Event, LogCategory
from .common import random_internal_ip

DOCUMENTATION_PREFIXES = ("192.0.2", "198.51.100", "203.0.113")
BENIGN_DOMAINS = (
    "cdn.example.net",
    "login.example.com",
    "packages.example.org",
    "status.example.net",
    "updates.example.com",
)

SCAN_CHANCE = 0.08
DNS_BEACON_CHANCE = 0.07
SCAN_PORTS = (21, 22, 23, 25, 53, 80, 110, 135, 139, 443, 445, 3389, 8080, 8443)


def _external_ip() -> str:
    return f"{random.choice(DOCUMENTATION_PREFIXES)}.{random.randint(1, 254)}"


def _port() -> int:
    return random.randint(1024, 65535)


def _uid() -> str:
    alphabet = string.ascii_letters + string.digits
    return "C" + "".join(random.choices(alphabet, k=17))


def _token(length: int = 12) -> str:
    return "".join(random.choices("0123456789abcdef", k=length))


def _normal_connection() -> list[Event]:
    source = random_internal_ip()
    destination = _external_ip()
    destination_port, protocol, service = random.choice(
        ((53, "udp", "dns"), (80, "tcp", "http"), (123, "udp", "ntp"), (443, "tcp", "ssl"))
    )
    message = (
        f"uid={_uid()} id.orig_h={source} id.orig_p={_port()} "
        f"id.resp_h={destination} id.resp_p={destination_port} proto={protocol} "
        f"service={service} duration={random.uniform(0.01, 8.0):.3f} "
        f"orig_bytes={random.randint(40, 4000)} resp_bytes={random.randint(40, 50000)} "
        "conn_state=SF local_orig=T local_resp=F"
    )
    return [("zeek-conn", 0, message)]


def _normal_dns() -> list[Event]:
    message = (
        f"uid={_uid()} id.orig_h={random_internal_ip()} id.orig_p={_port()} "
        f"id.resp_h=192.168.1.1 id.resp_p=53 proto=udp query={random.choice(BENIGN_DOMAINS)} "
        f"qtype_name={random.choice(('A', 'AAAA'))} rcode_name=NOERROR "
        f"answers={_external_ip()} TTL={random.choice((60, 300, 900, 3600))}"
    )
    return [("zeek-dns", 0, message)]


def _normal_tls() -> list[Event]:
    message = (
        f"uid={_uid()} id.orig_h={random_internal_ip()} id.orig_p={_port()} "
        f"id.resp_h={_external_ip()} id.resp_p=443 version=TLSv13 "
        f"cipher=TLS_AES_256_GCM_SHA384 server_name={random.choice(BENIGN_DOMAINS)} "
        "resumed=F established=T"
    )
    return [("zeek-ssl", 0, message)]


def _port_scan_burst() -> list[Event]:
    attacker = _external_ip()
    target = random_internal_ip()
    ports = random.sample(SCAN_PORTS, k=random.randint(5, 9))
    events: list[Event] = []
    for destination_port in ports:
        message = (
            f"uid={_uid()} id.orig_h={attacker} id.orig_p={_port()} "
            f"id.resp_h={target} id.resp_p={destination_port} proto=tcp service=- "
            "duration=0.000 orig_bytes=0 resp_bytes=0 conn_state=S0 "
            "local_orig=F local_resp=T"
        )
        events.append(("zeek-conn", 0, message))

    alert = (
        f"event_type=alert src_ip={attacker} src_port={_port()} dest_ip={target} "
        f"dest_port={ports[-1]} proto=TCP alert.signature_id=2002910 "
        'alert.signature="ET SCAN Potential TCP Port Scan" '
        'alert.category="Network Scan" alert.severity=2'
    )
    events.append(("suricata", 0, alert))
    return events


def _dns_beacon_burst() -> list[Event]:
    client = random_internal_ip()
    resolver = "192.168.1.1"
    beacon_domain = "sync.example.invalid"
    answer = _external_ip()
    events: list[Event] = []
    for _ in range(random.randint(4, 7)):
        query = f"{_token()}.{beacon_domain}"
        message = (
            f"uid={_uid()} id.orig_h={client} id.orig_p={_port()} "
            f"id.resp_h={resolver} id.resp_p=53 proto=udp query={query} "
            f"qtype_name=TXT rcode_name=NOERROR answers={answer} TTL=60"
        )
        events.append(("zeek-dns", 0, message))

    notice = (
        f"note=DNS::Beaconing src={client} dst={answer} query={beacon_domain} "
        f'subqueries={len(events)} msg="Repeated encoded DNS queries to one domain"'
    )
    events.append(("zeek-notice", 0, notice))
    return events


def sample() -> list[Event]:
    roll = random.random()
    if roll < SCAN_CHANCE:
        return _port_scan_burst()
    if roll < SCAN_CHANCE + DNS_BEACON_CHANCE:
        return _dns_beacon_burst()
    return random.choice((_normal_connection, _normal_dns, _normal_tls))()


CATEGORY = LogCategory(name="ndr", weight=4, sample=sample)
