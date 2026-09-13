import random

from .base import Event, LogCategory
from .common import fill_template

SERVICES = [
    ("gnome-keyring-daemon", "gnome-keyring-d", 4176),
    ("gnome-shell", None, 4413),
    ("tracker-miner-fs-3", None, None),
    ("kernel", None, None),
    ("systemd", None, 1),
    ("NetworkManager", "NetworkManager", None),
    ("dbus-daemon", None, None),
    ("snapd", None, None),
    ("udisksd", None, None),
    ("pulseaudio", None, None),
    ("bluetoothd", None, None),
    ("avahi-daemon", None, None),
    ("cron", None, None),
    ("sudo", None, None),
]

MESSAGES = {
    "gnome-keyring-daemon": [
        "asked to register item /org/freedesktop/secrets/collection/login/1",
        "asked to register item /org/freedesktop/secrets/collection/Default_5fkeyring/3",
        "couldn't access control socket: /run/user/1000/keyring/control",
    ],
    "gnome-shell": [
        "Window manager warning: Ping serial {serial} was reused",
        "JS ERROR: TypeError: this._delegate is null",
        "Failed to create backend: No such file or directory",
    ],
    "tracker-miner-fs-3": [
        "(tracker-extract-3:{pid}): GLib-GIO-WARNING **: 15:53:09.421: Error creating IO channel for /proc/self/mountinfo: Invalid argument (g-io-error-quark, 13)",
        "(tracker-extract-3:{pid}): GLib-WARNING **: 15:53:09.421: GError set over the top of a previous GError or uninitialized memory.",
    ],
    "kernel": [
        "[UFW BLOCK] IN=wlp2s0 OUT= MAC=02:00:00:00:00:01:02:00:00:00:00:02:08:00 SRC={src_ip} DST={dst_ip} LEN=40 TOS=0x00 PREC=0x00 TTL=238 ID=54321 PROTO=TCP SPT={sport} DPT={dport} WINDOW=1024 RES=0x00 SYN URGP=0",
        "audit: type=1400 audit({ts}): apparmor=\"ALLOWED\" operation=\"open\" profile=\"snap.firefox.firefox\"",
        "EXT4-fs (sda2): re-mounted. Opts: errors=remount-ro",
        "usb 1-1: new high-speed USB device number {pid} using xhci_hcd",
        "NET: Registered PF_INET6 protocol family",
    ],
    "systemd": [
        "Started Session {n} of User 1000.",
        "Starting Network Manager Script Dispatcher Service...",
        "snapd.socket: Listening on /run/snapd.socket.",
        "user@1000.service: Deactivated successfully.",
        "tmp.mount: Deactivated successfully.",
    ],
    "NetworkManager": [
        "<info>  [1751292745.3578] device (wlp2s0): Activation: successful, device activated.",
        "<warn>  [1751292745.3578] Connection 'HomeNetwork' has no secrets and cannot connect.",
        "<info>  [1751292745.3578] manager: NetworkManager state is now CONNECTED_GLOBAL",
        "<info>  [1751292745.3578] dhcp4 (wlp2s0): address={dst_ip}",
    ],
    "dbus-daemon": [
        "[system] Successfully activated service 'org.freedesktop.hostname1'",
        "[session uid=1000 pid={pid}] Successfully activated service 'org.gnome.Shell.CalendarServer'",
        "[system] Activating via systemd: service name='org.freedesktop.NetworkManager'",
    ],
    "snapd": [
        "2026/06/30 15:52:25.000001 overlord.go:272: Restarting...",
        "2026/06/30 15:52:25.000001 api.go:272: access denied",
        "snap.mount-unit=firefox-{n}.mount snap-name=firefox snap-revision={n}: Service stopped.",
    ],
    "udisksd": [
        "Mounted /dev/sda1 at /media/analyst/USB on behalf of uid 1000",
        "Cleaning up mount point /media/analyst/USB (device 8:1 is not mounted any more)",
    ],
    "pulseaudio": [
        "W: [pulseaudio] alsa-util.c: Failed to set hardware parameters: Invalid argument",
        "I: [pulseaudio] sink.c: Suspend cause of sink 0 changed from 0x0000 to 0x0004.",
    ],
    "bluetoothd": [
        "src/plugin.c:plugin_init() Failed to init vcp plugin",
        "src/adapter.c:powered_callback() hci0 Status 0x00",
        "profiles/audio/a2dp.c:a2dp_remote_sep_destroy()",
    ],
    "avahi-daemon": [
        "Registering new address record for 192.168.1.{n} on wlp2s0.IPv4.",
        "Withdrawing address record for 192.168.1.{n} on wlp2s0.",
        "Server startup complete. Host name is {host}.local. Local service cookie is {n}.",
    ],
    "cron": [
        "(analyst) CMD (/usr/bin/python3 /home/analyst/scripts/backup.py)",
        "(root) CMD (test -x /usr/sbin/anacron || ( cd / && run-parts --report /etc/cron.daily ))",
    ],
    "sudo": [
        "analyst : TTY=pts/{n} ; PWD=/home/analyst ; USER=root ; COMMAND=/usr/bin/apt update",
        "analyst : TTY=pts/{n} ; PWD=/home/analyst ; USER=root ; COMMAND=/usr/bin/systemctl restart NetworkManager",
    ],
}


def _random_pid() -> int:
    return random.randint(1000, 60000)


def sample() -> list[Event]:
    full_name, short_name, fixed_pid = random.choice(SERVICES)
    pid = fixed_pid if fixed_pid else _random_pid()

    display_name = full_name
    if short_name and random.random() < 0.4:
        display_name = short_name

    messages = MESSAGES.get(full_name, ["Unknown error occurred"])
    message = fill_template(random.choice(messages)).replace("{pid}", str(pid))
    return [(display_name, pid, message)]


CATEGORY = LogCategory(name="desktop", weight=10, sample=sample)
