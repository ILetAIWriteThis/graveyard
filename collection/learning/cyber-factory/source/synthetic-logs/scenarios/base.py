from dataclasses import dataclass
from typing import Callable

from log_categories.base import Event


@dataclass
class Stage:
    """One step of an attack chain: a few log lines emitted back to back."""

    name: str
    events: list[Event]


@dataclass
class Scenario:
    name: str
    description: str
    # Returns the full chain, in order. Called once per generation run so a
    # scenario can pick its attacker IP / target user and reuse them across
    # every stage — that shared identity is what makes the chain correlatable.
    build: Callable[[], list[Stage]]
