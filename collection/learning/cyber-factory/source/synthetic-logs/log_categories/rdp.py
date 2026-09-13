import random

from .base import Event, LogCategory
from .common import fill_template, random_ip, random_user

SERVICE_NAME = "xrdp"

# Ordinary, non-attack RDP activity: successful connections, normal session
# lifecycle, occasional benign connection noise (dropped handshakes, TLS
# renegotiation). Modeled on xrdp/xrdp-sesman log lines.
SINGLE_MESSAGES = [
    "[INFO ] Socket {pid}: connection received from {src_ip} port {sport}",
    "[INFO ] xrdp_wm_log_msg: login successful for display 10 width=1920 height=1080 bpp=24",
    "[INFO ] connected client computer name 'WORKSTATION-{n}' - configured client computer name 'WORKSTATION-{n}'",
    "pam_unix(xrdp-sesman:session): session opened for user {user}(uid=1000) by (uid=0)",
    "pam_unix(xrdp-sesman:session): session closed for user {user}",
    "[INFO ] ++ terminated session (id:{n}, uid:1000, usename:{user}, ip:{src_ip}:{sport})",
    "[INFO ] Certificate loaded, continuing with TLS connection",
    "[WARN ] Socket {pid}: connection aborted: TLS handshake timed out",
]

# Repeated-attempt lines used inside a brute-force burst — same attacker
# IP and target user reused across several consecutive lines.
BRUTE_FORCE_ATTEMPTS = [
    "pam_unix(xrdp-sesman:auth): authentication failure; logname= uid=0 euid=0 tty= ruser= rhost={src_ip} user={user}",
    "[ERROR] xrdp_mm_process_login_response: login failed for display 10, user={user} - authentication error",
    "[WARN ] login attempt for user {user} from {src_ip} rejected: invalid credentials",
]

BRUTE_FORCE_CLOSERS = [
    "[ERROR] connection aborted: maximum login attempts exceeded for user {user} from {src_ip}",
    "[INFO ] Socket closed: max retries reached for {src_ip}",
]

BRUTE_FORCE_CHANCE = 0.15
BRUTE_FORCE_MIN_ATTEMPTS = 3
BRUTE_FORCE_MAX_ATTEMPTS = 8


def _random_pid() -> int:
    return random.randint(1000, 60000)


def _fill_fixed(template: str, src_ip: str, user: str) -> str:
    # src_ip/user are already chosen for the whole burst; fill_template()
    # only fills placeholders that are still present in the template.
    return fill_template(template.replace("{src_ip}", src_ip).replace("{user}", user))


def _single_event() -> list[Event]:
    message = fill_template(random.choice(SINGLE_MESSAGES))
    return [(SERVICE_NAME, _random_pid(), message)]


def _brute_force_burst() -> list[Event]:
    attacker_ip = random_ip()
    target_user = random_user()
    attempts = random.randint(BRUTE_FORCE_MIN_ATTEMPTS, BRUTE_FORCE_MAX_ATTEMPTS)

    events = [
        (SERVICE_NAME, _random_pid(), _fill_fixed(random.choice(BRUTE_FORCE_ATTEMPTS), attacker_ip, target_user))
        for _ in range(attempts)
    ]
    events.append(
        (SERVICE_NAME, _random_pid(), _fill_fixed(random.choice(BRUTE_FORCE_CLOSERS), attacker_ip, target_user))
    )
    return events


def sample() -> list[Event]:
    if random.random() < BRUTE_FORCE_CHANCE:
        return _brute_force_burst()
    return _single_event()


CATEGORY = LogCategory(name="rdp", weight=3, sample=sample)
