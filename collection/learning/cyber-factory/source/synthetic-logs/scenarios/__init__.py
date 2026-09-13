from . import ssh_intrusion
from .base import Scenario, Stage

# To add a scenario: create a module exposing build() -> list[Stage] plus
# SCENARIO_NAME/DESCRIPTION (see ssh_intrusion.py), then register it here.
SCENARIOS: dict[str, Scenario] = {
    ssh_intrusion.SCENARIO_NAME: Scenario(
        name=ssh_intrusion.SCENARIO_NAME,
        description=ssh_intrusion.DESCRIPTION,
        build=ssh_intrusion.build,
    ),
}


def get_scenario(name: str) -> Scenario:
    if name not in SCENARIOS:
        raise ValueError(f"Unknown scenario: {name}. Available: {', '.join(SCENARIOS)}")
    return SCENARIOS[name]
