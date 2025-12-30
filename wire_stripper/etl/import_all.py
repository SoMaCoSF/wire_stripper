from __future__ import annotations

from wire_stripper.db.store import Store
from wire_stripper.etl.import_dmbt import import_dmbt
from wire_stripper.etl.import_privacy_proxy import import_privacy_proxy


def import_all(store: Store, profile_id: str = "default") -> dict[str, dict[str, int]]:
    return {
        "dmbt": import_dmbt(store, profile_id=profile_id),
        "privacy_proxy": import_privacy_proxy(store, profile_id=profile_id),
    }
