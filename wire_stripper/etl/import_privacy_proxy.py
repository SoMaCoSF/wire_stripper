from __future__ import annotations

from wire_stripper.db.store import Store


def _upsert_domain(
    store: Store,
    domain: str,
    category: str | None = None,
    confidence: float | None = None,
) -> None:
    store.upsert(
        "INSERT INTO domain(domain, etld1, category, confidence, first_seen, last_seen) VALUES(?,?,?,?,?,?) "
        "ON CONFLICT(domain) DO UPDATE SET category=COALESCE(excluded.category, domain.category), confidence=COALESCE(excluded.confidence, domain.confidence), last_seen=excluded.last_seen",
        (domain, None, category, confidence, store.now(), store.now()),
    )


def _upsert_ip(store: Store, ip: str) -> None:
    store.upsert(
        "INSERT INTO ip(ip, ip_version, first_seen, last_seen) VALUES(?,?,?,?) "
        "ON CONFLICT(ip) DO UPDATE SET last_seen=excluded.last_seen",
        (ip, 6 if ":" in ip else 4, store.now(), store.now()),
    )


def import_privacy_proxy(store: Store, profile_id: str = "default") -> dict[str, int]:
    """Import browser-privacy-proxy tables into canonical wire_stripper tables.

    Reads:
    - tracking_domains, tracking_ips, whitelist, request_log, cookie_traffic

    Writes:
    - domain, ip, event, list_entry

    Notes:
    - This is co-location/ETL mode: we do not change the original proxy code yet.
    """

    counts = {"domain": 0, "ip": 0, "event": 0, "list_entry": 0}

    # whitelist -> list_entry white domain
    for row in store.conn.execute(
        "SELECT domain, added, reason FROM whitelist"
    ).fetchall():
        domain, added, reason = row
        entry_id = f"privacy:whitelist:{domain}"
        store.upsert(
            "INSERT OR IGNORE INTO list_entry(entry_id, profile_id, list_type, target_type, target_value, reason, created_at, created_by) VALUES(?,?,?,?,?,?,?,?)",
            (
                entry_id,
                profile_id,
                "white",
                "domain",
                domain,
                reason or "whitelist",
                added or store.now(),
                "privacy_proxy",
            ),
        )
        counts["list_entry"] += 1

    # tracking_domains -> domain + list_entry black (if blocked)
    for row in store.conn.execute(
        "SELECT domain, category, blocked, first_seen, last_seen, hit_count FROM tracking_domains"
    ).fetchall():
        domain, category, blocked, first_seen, last_seen, hit_count = row
        _upsert_domain(store, domain, category=category, confidence=None)
        counts["domain"] += 1

        if blocked:
            entry_id = f"privacy:tracking_domain:{domain}"
            store.upsert(
                "INSERT OR IGNORE INTO list_entry(entry_id, profile_id, list_type, target_type, target_value, reason, created_at, created_by) VALUES(?,?,?,?,?,?,?,?)",
                (
                    entry_id,
                    profile_id,
                    "black",
                    "domain",
                    domain,
                    f"tracking_domains blocked (hit_count={hit_count})",
                    last_seen or store.now(),
                    "privacy_proxy",
                ),
            )
            counts["list_entry"] += 1

    # tracking_ips -> ip + list_entry black (if blocked)
    for row in store.conn.execute(
        "SELECT ip_address, blocked, last_seen, associated_domain, hit_count FROM tracking_ips"
    ).fetchall():
        ip, blocked, last_seen, assoc_domain, hit_count = row
        if ip:
            _upsert_ip(store, ip)
            counts["ip"] += 1

        if blocked:
            entry_id = f"privacy:tracking_ip:{ip}"
            store.upsert(
                "INSERT OR IGNORE INTO list_entry(entry_id, profile_id, list_type, target_type, target_value, reason, created_at, created_by) VALUES(?,?,?,?,?,?,?,?)",
                (
                    entry_id,
                    profile_id,
                    "black",
                    "ip",
                    ip,
                    f"tracking_ips blocked (hit_count={hit_count}, associated_domain={assoc_domain})",
                    last_seen or store.now(),
                    "privacy_proxy",
                ),
            )
            counts["list_entry"] += 1

    # request_log -> event
    for row in store.conn.execute(
        "SELECT id, timestamp, method, url, host, ip_address, blocked, block_reason FROM request_log"
    ).fetchall():
        rid, ts, method, url, host, ip_address, blocked, block_reason = row
        event_id = f"privacy:request_log:{rid}"
        store.upsert(
            "INSERT OR IGNORE INTO event(event_id, ts, sensor, profile_id, url, hostname, method, resource_type, src_ip, dst_ip, dst_port, proto, bytes, headers_json, cookies_json, initiator_json) "
            "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                event_id,
                ts or store.now(),
                "privacy_proxy",
                profile_id,
                url,
                host,
                method,
                None,
                None,
                ip_address,
                None,
                "tcp",
                None,
                None,
                None,
                None,
            ),
        )
        counts["event"] += 1

        # If the proxy already decided to block, carry that into canonical list entries
        if blocked:
            if host:
                entry_id = f"privacy:blocked_host:{host}"
                store.upsert(
                    "INSERT OR IGNORE INTO list_entry(entry_id, profile_id, list_type, target_type, target_value, reason, created_at, created_by) VALUES(?,?,?,?,?,?,?,?)",
                    (
                        entry_id,
                        profile_id,
                        "black",
                        "domain",
                        host,
                        block_reason or "request_log blocked",
                        ts or store.now(),
                        "privacy_proxy",
                    ),
                )
                counts["list_entry"] += 1

    # cookie_traffic -> event
    for row in store.conn.execute(
        "SELECT id, timestamp, domain, cookie_name, ip_address, request_url, blocked FROM cookie_traffic"
    ).fetchall():
        rid, ts, domain, cookie_name, ip_address, request_url, blocked = row
        event_id = f"privacy:cookie_traffic:{rid}"
        store.upsert(
            "INSERT OR IGNORE INTO event(event_id, ts, sensor, profile_id, url, hostname, method, resource_type, src_ip, dst_ip, dst_port, proto, bytes, headers_json, cookies_json, initiator_json) "
            "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                event_id,
                ts or store.now(),
                "privacy_proxy",
                profile_id,
                request_url,
                domain,
                None,
                "cookie",
                None,
                ip_address,
                None,
                None,
                None,
                None,
                None,
                None,
            ),
        )
        counts["event"] += 1

        if blocked and domain:
            entry_id = f"privacy:cookie_block:{domain}:{cookie_name or ''}"
            store.upsert(
                "INSERT OR IGNORE INTO list_entry(entry_id, profile_id, list_type, target_type, target_value, reason, created_at, created_by) VALUES(?,?,?,?,?,?,?,?)",
                (
                    entry_id,
                    profile_id,
                    "grey",
                    "domain",
                    domain,
                    f"cookie traffic blocked (cookie_name={cookie_name})",
                    ts or store.now(),
                    "privacy_proxy",
                ),
            )
            counts["list_entry"] += 1

    return counts
