import random

from .base import Event, LogCategory
from .common import fill_template, random_ip

SERVICE_NAME = "nginx"

# Ordinary web traffic noise: combined-log-format access lines plus the
# occasional upstream/error-log line. {src_ip} is filled per line.
SINGLE_MESSAGES = [
    '{src_ip} - - "GET / HTTP/1.1" 200 612 "-" "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"',
    '{src_ip} - - "GET /favicon.ico HTTP/1.1" 404 162 "-" "Mozilla/5.0"',
    '{src_ip} - - "GET /api/health HTTP/1.1" 200 15 "-" "kube-probe/1.29"',
    '{src_ip} - - "POST /api/login HTTP/1.1" 200 87 "-" "Mozilla/5.0"',
    '{src_ip} - - "GET /static/app.{n}.js HTTP/1.1" 304 0 "-" "Mozilla/5.0"',
    '{src_ip} - - "GET /robots.txt HTTP/1.1" 200 26 "-" "Googlebot/2.1"',
    '{src_ip} - - "GET /wp-login.php HTTP/1.1" 404 162 "-" "Mozilla/5.0"',
    "[error] upstream timed out (110: Connection timed out) while reading response header from upstream, client: {src_ip}, server: app.example.net",
    '{src_ip} - - "GET /checkout HTTP/1.1" 500 0 "-" "Mozilla/5.0"',
]

# Vulnerability-scan / path-enumeration burst: same attacker IP hammering
# several well-known sensitive/exploit-probe paths in quick succession,
# ending in a rate-limit or WAF-block line.
SCAN_ATTEMPTS = [
    '{src_ip} - - "GET /.env HTTP/1.1" 404 162 "-" "-"',
    '{src_ip} - - "GET /.git/config HTTP/1.1" 404 162 "-" "-"',
    '{src_ip} - - "GET /wp-admin/setup-config.php HTTP/1.1" 404 162 "-" "-"',
    '{src_ip} - - "GET /phpmyadmin/index.php HTTP/1.1" 404 162 "-" "-"',
    '{src_ip} - - "GET /admin/config.php HTTP/1.1" 404 162 "-" "-"',
    '{src_ip} - - "GET /../../../../etc/passwd HTTP/1.1" 400 0 "-" "-"',
    "{src_ip} - - \"GET /search?q=1' OR '1'='1 HTTP/1.1\" 403 0 \"-\" \"-\"",
    '{src_ip} - - "GET /search?q=<script>alert(1)</script> HTTP/1.1" 403 0 "-" "-"',
    '{src_ip} - - "GET /cgi-bin/../../../bin/sh HTTP/1.1" 400 0 "-" "-"',
]

SCAN_CLOSERS = [
    '[warn] limiting requests, excess: {n}.500 by zone "scan_limit", client: {src_ip}, server: app.example.net',
    "[error] access forbidden by rule, client: {src_ip}, server: app.example.net, request: \"GET /admin/config.php HTTP/1.1\"",
]

SCAN_CHANCE = 0.15
SCAN_MIN_ATTEMPTS = 4
SCAN_MAX_ATTEMPTS = 9


def _random_pid() -> int:
    return random.randint(1000, 60000)


def _fill_fixed_ip(template: str, src_ip: str) -> str:
    return fill_template(template.replace("{src_ip}", src_ip))


def _single_event() -> list[Event]:
    message = fill_template(random.choice(SINGLE_MESSAGES))
    return [(SERVICE_NAME, _random_pid(), message)]


def _scan_burst() -> list[Event]:
    attacker_ip = random_ip()
    attempts = random.randint(SCAN_MIN_ATTEMPTS, SCAN_MAX_ATTEMPTS)

    events = [
        (SERVICE_NAME, _random_pid(), _fill_fixed_ip(random.choice(SCAN_ATTEMPTS), attacker_ip))
        for _ in range(attempts)
    ]
    events.append(
        (SERVICE_NAME, _random_pid(), _fill_fixed_ip(random.choice(SCAN_CLOSERS), attacker_ip))
    )
    return events


def sample() -> list[Event]:
    if random.random() < SCAN_CHANCE:
        return _scan_burst()
    return _single_event()


CATEGORY = LogCategory(name="web", weight=5, sample=sample)
