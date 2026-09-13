from .base import LogCategory
from . import auth, desktop, ndr, rdp, ssh, web

# To add a new category: create a module exposing a module-level `CATEGORY =
# LogCategory(...)` (see desktop.py / ssh.py), then register it here.
CATEGORIES: dict[str, LogCategory] = {
    desktop.CATEGORY.name: desktop.CATEGORY,
    ssh.CATEGORY.name: ssh.CATEGORY,
    rdp.CATEGORY.name: rdp.CATEGORY,
    auth.CATEGORY.name: auth.CATEGORY,
    web.CATEGORY.name: web.CATEGORY,
    ndr.CATEGORY.name: ndr.CATEGORY,
}


def get_categories(names: list[str] | None) -> list[LogCategory]:
    if not names:
        return list(CATEGORIES.values())
    unknown = [n for n in names if n not in CATEGORIES]
    if unknown:
        available = ", ".join(CATEGORIES)
        raise ValueError(f"Unknown categories: {', '.join(unknown)}. Available: {available}")
    return [CATEGORIES[n] for n in names]
