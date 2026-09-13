import random

from .base import Event, LogCategory
from .common import fill_template, random_ip

SERVICE_NAME = "authd"

# Ordinary, non-attack activity against a centralized auth/identity service
# (SSO/IdP-style): logins, MFA challenges, password resets, session/device
# housekeeping.
SINGLE_MESSAGES = [
    "login succeeded for user {user} from {src_ip} via password",
    "login succeeded for user {user} from {src_ip} via sso_token",
    "mfa challenge sent to user {user} (push) from {src_ip}",
    "mfa challenge approved for user {user} from {src_ip}",
    "password reset requested for user {user} from {src_ip}",
    "password changed for user {user} from {src_ip}",
    "session refreshed for user {user} from {src_ip}",
    "logout for user {user} from {src_ip}",
    "new device registered for user {user} from {src_ip}",
]

# Credential-stuffing / password-spray burst: unlike the ssh/rdp brute-force
# pattern (fixed user, fixed attacker), this fixes only the attacker IP and
# sprays a different username per attempt — the realistic shape of stuffing
# attacks run against a centralized login endpoint.
SPRAY_ATTEMPTS = [
    "login failed for user {user} from {src_ip}: invalid credentials",
    "login failed for user {user} from {src_ip}: unknown account",
    "mfa challenge failed for user {user} from {src_ip}",
]

SPRAY_CLOSERS = [
    "rate limit exceeded for {src_ip}: blocking further login attempts for 15m",
    "anomaly detected: {n} failed logins from {src_ip} across distinct accounts, IP flagged",
]

SPRAY_CHANCE = 0.15
SPRAY_MIN_ATTEMPTS = 4
SPRAY_MAX_ATTEMPTS = 10


def _random_pid() -> int:
    return random.randint(1000, 60000)


def _fill_fixed_ip(template: str, src_ip: str) -> str:
    # src_ip is fixed for the whole spray burst; fill_template() fills the
    # per-attempt {user} (and any other remaining placeholders) freshly.
    return fill_template(template.replace("{src_ip}", src_ip))


def _single_event() -> list[Event]:
    message = fill_template(random.choice(SINGLE_MESSAGES))
    return [(SERVICE_NAME, _random_pid(), message)]


def _credential_spray_burst() -> list[Event]:
    attacker_ip = random_ip()
    attempts = random.randint(SPRAY_MIN_ATTEMPTS, SPRAY_MAX_ATTEMPTS)

    events = [
        (SERVICE_NAME, _random_pid(), _fill_fixed_ip(random.choice(SPRAY_ATTEMPTS), attacker_ip))
        for _ in range(attempts)
    ]
    events.append(
        (SERVICE_NAME, _random_pid(), _fill_fixed_ip(random.choice(SPRAY_CLOSERS), attacker_ip))
    )
    return events


def sample() -> list[Event]:
    if random.random() < SPRAY_CHANCE:
        return _credential_spray_burst()
    return _single_event()


CATEGORY = LogCategory(name="auth", weight=3, sample=sample)
