import random

from .base import Event, LogCategory
from .common import fill_template, random_ip, random_user

SERVICE_NAME = "sshd"

# Ordinary, non-attack SSH activity: successful logins, normal session
# lifecycle, occasional benign connection noise (scanners, flaky clients).
SINGLE_MESSAGES = [
    "Accepted publickey for {user} from {src_ip} port {sport} ssh2: RSA SHA256:abc123",
    "Accepted password for {user} from {src_ip} port {sport} ssh2",
    "pam_unix(sshd:session): session opened for user {user}(uid=1000) by (uid=0)",
    "pam_unix(sshd:session): session closed for user {user}",
    "Received disconnect from {src_ip} port {sport}:11: disconnected by user",
    "Did not receive identification string from {src_ip} port {sport}",
    "Connection closed by authenticating user {user} {src_ip} port {sport} [preauth]",
    "reverse mapping checking getaddrinfo for {rdns_host} [{src_ip}] failed - POSSIBLE BREAK-IN ATTEMPT!",
]

# Repeated-attempt lines used inside a brute-force burst — same attacker
# IP and target user reused across several consecutive lines.
BRUTE_FORCE_ATTEMPTS = [
    "Invalid user {user} from {src_ip} port {sport}",
    "Failed password for invalid user {user} from {src_ip} port {sport} ssh2",
    "Failed password for {user} from {src_ip} port {sport} ssh2",
    "pam_unix(sshd:auth): authentication failure; logname= uid=0 euid=0 tty=ssh ruser= rhost={src_ip} user={user}",
]

BRUTE_FORCE_CLOSERS = [
    "Connection closed by invalid user {user} {src_ip} port {sport} [preauth]",
    "Disconnected from invalid user {user} {src_ip} port {sport} [preauth]",
    "error: maximum authentication attempts exceeded for invalid user {user} from {src_ip} port {sport} ssh2 [preauth]",
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


CATEGORY = LogCategory(name="ssh", weight=3, sample=sample)
