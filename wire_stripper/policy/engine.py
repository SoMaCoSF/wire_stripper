from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from typing import Optional

from wire_stripper.db.store import Store


@dataclass(frozen=True)
class DecisionResult:
    action: str  # allow|block|quarantine
    matched_rule: str | None
    explanation: str
    confidence: float


class PolicyEngine:
    def __init__(self, store: Store, profile_id: str = "default"):
        self.store = store
        self.profile_id = profile_id

    def _match_list(
        self, list_type: str, target_type: str, target_value: str
    ) -> Optional[str]:
        row = self.store.conn.execute(
            "SELECT entry_id FROM list_entry WHERE profile_id=? AND list_type=? AND target_type=? AND target_value=?",
            (self.profile_id, list_type, target_type, target_value),
        ).fetchone()
        return row[0] if row else None

    def evaluate(self, hostname: str | None, dst_ip: str | None) -> DecisionResult:
        # Precedence: whitelist overrides everything.
        if hostname:
            wl = self._match_list("white", "domain", hostname)
            if wl:
                return DecisionResult("allow", wl, "whitelisted domain", 1.0)

            bl = self._match_list("black", "domain", hostname)
            if bl:
                return DecisionResult("block", bl, "blocked domain", 0.95)

            gl = self._match_list("grey", "domain", hostname)
            if gl:
                return DecisionResult("quarantine", gl, "greylisted domain", 0.7)

        if dst_ip:
            wl = self._match_list("white", "ip", dst_ip)
            if wl:
                return DecisionResult("allow", wl, "whitelisted ip", 1.0)

            bl = self._match_list("black", "ip", dst_ip)
            if bl:
                return DecisionResult("block", bl, "blocked ip", 0.9)

        return DecisionResult("allow", None, "no matching rule", 0.5)

    def record_decision(
        self,
        url: str | None,
        hostname: str | None,
        dst_ip: str | None,
        result: DecisionResult,
    ) -> str:
        decision_id = str(uuid.uuid4())
        self.store.upsert(
            "INSERT INTO decision(decision_id, ts, profile_id, url, hostname, dst_ip, effective_action, matched_rule, explanation, confidence) "
            "VALUES(?,?,?,?,?,?,?,?,?,?)",
            (
                decision_id,
                self.store.now(),
                self.profile_id,
                url,
                hostname,
                dst_ip,
                result.action,
                result.matched_rule,
                result.explanation,
                result.confidence,
            ),
        )
        return decision_id

    def add_list_entry(
        self,
        list_type: str,
        target_type: str,
        target_value: str,
        reason: str,
        created_by: str = "user",
    ) -> str:
        entry_id = str(uuid.uuid4())
        self.store.upsert(
            "INSERT OR IGNORE INTO list_entry(entry_id, profile_id, list_type, target_type, target_value, reason, created_at, created_by) "
            "VALUES(?,?,?,?,?,?,?,?)",
            (
                entry_id,
                self.profile_id,
                list_type,
                target_type,
                target_value,
                reason,
                self.store.now(),
                created_by,
            ),
        )
        return entry_id
