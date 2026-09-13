"""Tests for scenario scheduling in the synthetic log generator.

Example:
    uv run python -m unittest discover -s synthetic-logs/tests -v
"""

import io
import json
import sys
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

SYNTHETIC_LOGS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SYNTHETIC_LOGS))

import generate_syslog  # noqa: E402
from log_categories.base import LogCategory  # noqa: E402
from scenarios.base import Stage  # noqa: E402


def noise() -> list[tuple[str, int, str]]:
    return [("noise", 0, "background")]


class ScenarioSchedulingTests(unittest.TestCase):
    def test_overdue_stages_remain_complete_atomic_and_ordered(self):
        stages = [
            Stage(
                name,
                [("scenario", 0, f"{name}-{index}") for index in range(19)],
            )
            for name in ("alpha", "bravo", "charlie")
        ]
        output = io.StringIO()

        with patch("generate_syslog.random.uniform", side_effect=lambda low, high: low):
            generate_syslog.generate(
                count=70,
                start=datetime(2026, 1, 1),
                min_gap=0,
                max_gap=0,
                fmt="jsonl",
                output=output,
                categories=[LogCategory(name="noise", weight=1, sample=noise)],
                stages=stages,
            )

        messages = [json.loads(line)["message"] for line in output.getvalue().splitlines()]
        previous_end = -1
        for name in ("alpha", "bravo", "charlie"):
            indices = [
                index
                for index, message in enumerate(messages)
                if message.startswith(f"{name}-")
            ]
            self.assertEqual(len(indices), 19)
            self.assertEqual(indices, list(range(indices[0], indices[0] + 19)))
            self.assertGreater(indices[0], previous_end)
            previous_end = indices[-1]


if __name__ == "__main__":
    unittest.main()
