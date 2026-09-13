"""Tests for the cross-log-source synthetic scenario.

Example:
    uv run python -m unittest discover -s synthetic-logs/tests -v
"""

import re
import sys
import unittest
from pathlib import Path

SYNTHETIC_LOGS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SYNTHETIC_LOGS))

from scenarios import ssh_intrusion  # noqa: E402


def field(message: str, name: str) -> str:
    match = re.search(rf"(?:^| ){re.escape(name)}=([^ ]+)", message)
    if not match:
        raise AssertionError(f"field {name!r} missing from {message!r}")
    return match.group(1)


def ufw_field(message: str, name: str) -> str:
    match = re.search(rf"\b{re.escape(name)}=([^ ]+)", message)
    if not match:
        raise AssertionError(f"UFW field {name!r} missing from {message!r}")
    return match.group(1)


class CrossSourceSshScenarioTests(unittest.TestCase):
    def setUp(self):
        self.stages = {stage.name: stage for stage in ssh_intrusion.build()}

    def test_chain_uses_multiple_log_sources(self):
        services = {
            service
            for stage in self.stages.values()
            for service, _, _ in stage.events
        }
        self.assertTrue(
            {"kernel", "zeek-conn", "suricata", "sshd", "sudo", "systemd", "CRON"}
            <= services
        )

    def test_recon_matches_firewall_zeek_and_suricata(self):
        events = self.stages["recon"].events
        ufw = [message for service, _, message in events if service == "kernel"]
        zeek = [message for service, _, message in events if service == "zeek-conn"]
        alert = next(message for service, _, message in events if service == "suricata")

        attacker = ufw_field(ufw[0], "SRC")
        target = ufw_field(ufw[0], "DST")
        self.assertTrue(attacker.startswith(ssh_intrusion.DOCUMENTATION_PREFIXES))
        self.assertEqual({ufw_field(message, "SRC") for message in ufw}, {attacker})
        self.assertEqual({ufw_field(message, "DST") for message in ufw}, {target})
        self.assertEqual({field(message, "id.orig_h") for message in zeek}, {attacker})
        self.assertEqual({field(message, "id.resp_h") for message in zeek}, {target})
        self.assertEqual(
            {ufw_field(message, "SPT") for message in ufw},
            {field(message, "id.orig_p") for message in zeek},
        )
        self.assertEqual(
            {ufw_field(message, "DPT") for message in ufw},
            {field(message, "id.resp_p") for message in zeek},
        )
        self.assertEqual(field(alert, "src_ip"), attacker)
        self.assertEqual(field(alert, "dest_ip"), target)

    def test_foothold_and_c2_keep_the_same_endpoints(self):
        recon_ufw = next(
            message
            for service, _, message in self.stages["recon"].events
            if service == "kernel"
        )
        attacker = ufw_field(recon_ufw, "SRC")
        target = ufw_field(recon_ufw, "DST")

        foothold = self.stages["foothold"].events
        accepted = next(message for service, _, message in foothold if service == "sshd")
        foothold_conn = next(
            message for service, _, message in foothold if service == "zeek-conn"
        )
        accepted_match = re.search(r"from ([^ ]+) port (\d+)", accepted)
        self.assertEqual(accepted_match.group(1), attacker)
        self.assertEqual(field(foothold_conn, "id.orig_h"), attacker)
        self.assertEqual(field(foothold_conn, "id.orig_p"), accepted_match.group(2))
        self.assertEqual(field(foothold_conn, "id.resp_h"), target)
        self.assertEqual(field(foothold_conn, "id.resp_p"), "22")

        c2 = self.stages["c2_beacon"].events
        cron = [message for service, _, message in c2 if service == "CRON"]
        ufw = [message for service, _, message in c2 if service == "kernel"]
        zeek = [message for service, _, message in c2 if service == "zeek-conn"]
        self.assertTrue(all(f"https://{attacker}/u.sh" in message for message in cron))
        self.assertEqual({ufw_field(message, "SRC") for message in ufw}, {target})
        self.assertEqual({ufw_field(message, "DST") for message in ufw}, {attacker})
        self.assertEqual({field(message, "id.orig_h") for message in zeek}, {target})
        self.assertEqual({field(message, "id.resp_h") for message in zeek}, {attacker})
        self.assertEqual(
            {ufw_field(message, "SPT") for message in ufw},
            {field(message, "id.orig_p") for message in zeek},
        )
        self.assertTrue(all("IN= OUT=wlp2s0" in message for message in ufw))
        self.assertTrue(all("local_orig=T local_resp=F" in message for message in zeek))


if __name__ == "__main__":
    unittest.main()
