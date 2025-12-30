from __future__ import annotations

import uuid
from typing import Any

from wire_stripper.db.store import Store


def _upsert_ip(
    store: Store, ip: str, ip_version: int | None, asn: str | None, asn_name: str | None
) -> None:
    store.upsert(
        "INSERT INTO ip(ip, ip_version, asn, asn_name, first_seen, last_seen) "
        "VALUES(?,?,?,?,?,?) "
        "ON CONFLICT(ip) DO UPDATE SET ip_version=excluded.ip_version, asn=excluded.asn, asn_name=excluded.asn_name, last_seen=excluded.last_seen",
        (ip, ip_version, asn, asn_name, store.now(), store.now()),
    )


def _upsert_asn(store: Store, asn: str, org_name: str | None) -> None:
    store.upsert(
        "INSERT INTO asn(asn, org_name, first_seen, last_seen) VALUES(?,?,?,?) "
        "ON CONFLICT(asn) DO UPDATE SET org_name=excluded.org_name, last_seen=excluded.last_seen",
        (asn, org_name, store.now(), store.now()),
    )


def _upsert_prefix(
    store: Store, prefix: str, asn: str | None, source: str | None
) -> None:
    store.upsert(
        "INSERT INTO prefix(prefix, asn, source, first_seen, last_seen) VALUES(?,?,?,?,?) "
        "ON CONFLICT(prefix) DO UPDATE SET asn=excluded.asn, source=excluded.source, last_seen=excluded.last_seen",
        (prefix, asn, source, store.now(), store.now()),
    )


def _upsert_domain(store: Store, domain: str) -> None:
    store.upsert(
        "INSERT INTO domain(domain, etld1, first_seen, last_seen) VALUES(?,?,?,?) "
        "ON CONFLICT(domain) DO UPDATE SET last_seen=excluded.last_seen",
        (domain, None, store.now(), store.now()),
    )


def import_dmbt(store: Store, profile_id: str = "default") -> dict[str, int]:
    """Import DMBT tables into canonical wire_stripper tables.

    Reads:
    - ip_map, asn_map, prefix_map, blocklist, flow_history

    Writes:
    - domain, ip, asn, prefix, event, list_entry

    Idempotency:
    - events use deterministic `event_id` based on source row ids
    - list entries use INSERT OR IGNORE uniqueness constraint
    """

    counts = {
        "ip": 0,
        "asn": 0,
        "prefix": 0,
        "domain": 0,
        "event": 0,
        "list_entry": 0,
    }

    # asn_map -> asn
    for row in store.conn.execute("SELECT asn, org_name FROM asn_map").fetchall():
        _upsert_asn(store, row[0], row[1])
        counts["asn"] += 1

    # prefix_map -> prefix
    for row in store.conn.execute(
        "SELECT prefix, asn, source FROM prefix_map"
    ).fetchall():
        _upsert_prefix(store, row[0], row[1], row[2])
        counts["prefix"] += 1

    # ip_map -> ip + domain
    for row in store.conn.execute(
        "SELECT domain, ip, ip_version, asn, asn_name FROM ip_map"
    ).fetchall():
        domain, ip, ip_version, asn, asn_name = row
        if domain:
            _upsert_domain(store, domain)
            counts["domain"] += 1
        if ip:
            _upsert_ip(store, ip, ip_version, asn, asn_name)
            counts["ip"] += 1
        if asn:
            _upsert_asn(store, asn, asn_name)

    # blocklist -> list_entry (black prefix)
    for row in store.conn.execute(
        "SELECT prefix, asn, reason, added_at FROM blocklist"
    ).fetchall():
        prefix, asn, reason, added_at = row
        entry_id = f"dmbt:blocklist:{prefix}"
        store.upsert(
            "INSERT OR IGNORE INTO list_entry(entry_id, profile_id, list_type, target_type, target_value, reason, created_at, created_by) "
            "VALUES(?,?,?,?,?,?,?,?)",
            (
                entry_id,
                profile_id,
                "black",
                "prefix",
                prefix,
                reason or "dmbt blocklist",
                added_at or store.now(),
                "dmbt",
            ),
        )
        counts["list_entry"] += 1

    # flow_history -> event
    # flow_history has no id; use SQLite rowid for deterministic mapping.
    for row in store.conn.execute(
        "SELECT rowid, ts, src_ip, dst_ip, dst_port, proto, bytes, hostname FROM flow_history"
    ).fetchall():
        rid, ts, src_ip, dst_ip, dst_port, proto, bytes_, hostname = row
        event_id = f"dmbt:flow:{rid}"
        store.upsert(
            "INSERT OR IGNORE INTO event(event_id, ts, sensor, profile_id, url, hostname, method, resource_type, src_ip, dst_ip, dst_port, proto, bytes, headers_json, cookies_json, initiator_json) "
            "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                event_id,
                ts or store.now(),
                "dmbt_flow",
                profile_id,
                None,
                hostname,
                None,
                None,
                src_ip,
                dst_ip,
                dst_port,
                proto,
                bytes_,
                None,
                None,
                None,
            ),
        )
        counts["event"] += 1

    return counts
