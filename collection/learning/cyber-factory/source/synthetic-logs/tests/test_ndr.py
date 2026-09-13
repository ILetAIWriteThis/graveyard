"""Tests for synthetic NDR telemetry.

Example:
    uv run python -m unittest discover -s synthetic-logs/tests -v
"""

import re
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

SYNTHETIC_LOGS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SYNTHETIC_LOGS))

from log_categories import CATEGORIES, ndr  # noqa: E402


def field(message: str, name: str) -> str:
    match = re.search(rf"(?:^| ){re.escape(name)}=([^ ]+)", message)
    if not match:
        raise AssertionError(f"field {name!r} missing from {message!r}")
    return match.group(1)


class NdrCategoryTests(unittest.TestCase):
    def test_category_is_registered(self):
        self.assertIs(CATEGORIES["ndr"], ndr.CATEGORY)

    def test_normal_sample_is_one_well_formed_event(self):
        with patch("log_categories.ndr.random.random", return_value=0.99):
            events = ndr.sample()

        self.assertEqual(len(events), 1)
        service, pid, message = events[0]
        self.assertIn(service, {"zeek-conn", "zeek-dns", "zeek-ssl"})
        self.assertIsInstance(pid, int)
        self.assertIn("uid=", message)

    def test_scan_burst_keeps_attacker_and_target_stable(self):
        with patch("log_categories.ndr.random.random", return_value=0.0):
            events = ndr.sample()

        connections = [message for service, _, message in events if service == "zeek-conn"]
        self.assertGreaterEqual(len(connections), 5)
        self.assertEqual(
            {field(message, "id.orig_h") for message in connections},
            {field(connections[0], "id.orig_h")},
        )
        self.assertEqual(
            {field(message, "id.resp_h") for message in connections},
            {field(connections[0], "id.resp_h")},
        )
        self.assertTrue(all("conn_state=S0" in message for message in connections))
        self.assertEqual(events[-1][0], "suricata")

    def test_dns_beacon_keeps_client_domain_and_answer_stable(self):
        with patch("log_categories.ndr.random.random", return_value=0.1):
            events = ndr.sample()

        queries = [message for service, _, message in events if service == "zeek-dns"]
        self.assertGreaterEqual(len(queries), 4)
        self.assertEqual(
            {field(message, "id.orig_h") for message in queries},
            {field(queries[0], "id.orig_h")},
        )
        self.assertEqual(
            {field(message, "answers") for message in queries},
            {field(queries[0], "answers")},
        )
        self.assertTrue(
            all(field(message, "query").endswith(".sync.example.invalid") for message in queries)
        )
        self.assertEqual(events[-1][0], "zeek-notice")


if __name__ == "__main__":
    unittest.main()
