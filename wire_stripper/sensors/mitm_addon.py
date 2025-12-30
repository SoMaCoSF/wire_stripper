from __future__ import annotations

import json
import uuid
from urllib.parse import urlparse

from typing import TYPE_CHECKING, Any

try:
    from mitmproxy import http  # type: ignore
except Exception:  # pragma: no cover
    http = None  # type: ignore

if TYPE_CHECKING:  # pragma: no cover
    from mitmproxy import http as mhttp  # type: ignore

from wire_stripper.db.store import Store
from wire_stripper.policy.engine import PolicyEngine


def _host_from_url(url: str) -> str | None:
    try:
        return urlparse(url).netloc or None
    except Exception:
        return None


class WireStripperAddon:
    """mitmproxy addon: logs, strips, and enforces policy.

    v0 behavior:
    - records request metadata as events
    - runs policy engine (domain/ip) and blocks if action==block

    Future:
    - cookie/header stripping (port from browser-privacy-proxy)
    - attribution (domain->ip->asn->prefix) via local pfx2as
    """

    def __init__(self, store: Store, profile_id: str = "default"):
        self.store = store
        self.policy = PolicyEngine(store, profile_id=profile_id)

    def request(self, flow: "mhttp.HTTPFlow") -> None:
        assert http is not None
        url = flow.request.pretty_url
        hostname = _host_from_url(url)
        dst_ip = (
            flow.server_conn.address[0]
            if flow.server_conn and flow.server_conn.address
            else None
        )

        event_id = str(uuid.uuid4())
        self.store.insert_event(
            {
                "event_id": event_id,
                "ts": self.store.now(),
                "sensor": "mitmproxy",
                "profile_id": self.policy.profile_id,
                "url": url,
                "hostname": hostname,
                "method": flow.request.method,
                "resource_type": None,
                "src_ip": None,
                "dst_ip": dst_ip,
                "dst_port": flow.server_conn.address[1]
                if flow.server_conn and flow.server_conn.address
                else None,
                "proto": "tcp",
                "bytes": None,
                "headers_json": json.dumps(dict(flow.request.headers)),
                "cookies_json": None,
                "initiator_json": None,
            }
        )

        result = self.policy.evaluate(hostname=hostname, dst_ip=dst_ip)
        self.policy.record_decision(
            url=url, hostname=hostname, dst_ip=dst_ip, result=result
        )

        if result.action == "block":
            flow.response = http.Response.make(
                451,
                b"blocked by wire_stripper policy",
                {"Content-Type": "text/plain"},
            )
