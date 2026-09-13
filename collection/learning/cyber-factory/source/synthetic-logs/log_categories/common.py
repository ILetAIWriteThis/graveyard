import random

HOSTNAME = "lab-host"

USERNAMES = [
    "analyst", "root", "admin", "test", "ubuntu", "oracle",
    "postgres", "git", "deploy", "pi", "ec2-user", "guest",
]

ISP_LABELS = ["dsl-broadband", "fiber-net", "cloudhost", "dynamic-ip", "colo"]


def random_ip() -> str:
    return f"{random.randint(1, 254)}.{random.randint(1, 254)}.{random.randint(1, 254)}.{random.randint(1, 254)}"


def random_internal_ip() -> str:
    return f"192.168.1.{random.randint(1, 254)}"


def random_user() -> str:
    return random.choice(USERNAMES)


def random_rdns_host() -> str:
    a, b, c, d = (random.randint(1, 254) for _ in range(4))
    return f"{a}-{b}-{c}-{d}.{random.choice(ISP_LABELS)}.example.net"


def fill_template(msg: str) -> str:
    return (
        msg.replace("{serial}", str(random.randint(10000000, 99999999)))
        .replace("{pid}", str(random.randint(1000, 60000)))
        .replace("{src_ip}", random_ip())
        .replace("{dst_ip}", random_internal_ip())
        .replace("{sport}", str(random.randint(1024, 65535)))
        .replace("{dport}", str(random.choice([22, 80, 443, 8080, 3389, 8443])))
        .replace("{ts}", f"{random.randint(1700000000, 1800000000)}.{random.randint(0, 999)}:0")
        .replace("{n}", str(random.randint(1, 9999)))
        .replace("{host}", HOSTNAME)
        .replace("{user}", random_user())
        .replace("{rdns_host}", random_rdns_host())
    )
