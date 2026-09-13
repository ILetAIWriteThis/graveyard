from dataclasses import dataclass
from typing import Callable

# (service display name, pid, message)
Event = tuple[str, int, str]


@dataclass
class LogCategory:
    name: str
    weight: float
    sample: Callable[[], list[Event]]
