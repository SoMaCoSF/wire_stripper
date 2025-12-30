from __future__ import annotations

import os
import sqlite3
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable, Mapping


@dataclass(frozen=True)
class StorePaths:
    root: Path
    db_name: str = "wire_stripper.sqlite"

    @property
    def db_path(self) -> Path:
        return self.root / self.db_name

    @property
    def schema_path(self) -> Path:
        return Path(__file__).with_name("schema.sql")


class Store:
    def __init__(
        self,
        root: str | os.PathLike[str],
        db_name: str | None = None,
    ):
        # Allow hard override for legacy tools expecting a specific filename.
        db_name = (
            db_name or os.environ.get("WIRE_STRIPPER_DB_NAME") or "wire_stripper.sqlite"
        )

        self.paths = StorePaths(root=Path(root), db_name=db_name)
        self.paths.root.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(str(self.paths.db_path), check_same_thread=False)
        self._conn.row_factory = sqlite3.Row

    @property
    def conn(self) -> sqlite3.Connection:
        return self._conn

    def init_db(self) -> None:
        # Concurrency + sanity defaults for a shared local SQLite backend.
        try:
            self._conn.execute("PRAGMA journal_mode=WAL;")
            self._conn.execute("PRAGMA synchronous=NORMAL;")
            self._conn.execute("PRAGMA foreign_keys=ON;")
            self._conn.execute("PRAGMA busy_timeout=5000;")
            self._conn.execute("PRAGMA temp_store=MEMORY;")
        except Exception:
            # Pragmas are best-effort; schema init should still proceed.
            pass

        schema = self.paths.schema_path.read_text(encoding="utf-8")
        self._conn.executescript(schema)
        self._conn.commit()

    def upsert(self, sql: str, params: Iterable[Any]) -> None:
        self._conn.execute(sql, tuple(params))
        self._conn.commit()

    def insert_event(self, row: Mapping[str, Any]) -> None:
        cols = [
            "event_id",
            "ts",
            "sensor",
            "profile_id",
            "url",
            "hostname",
            "method",
            "resource_type",
            "src_ip",
            "dst_ip",
            "dst_port",
            "proto",
            "bytes",
            "headers_json",
            "cookies_json",
            "initiator_json",
        ]
        values = [row.get(c) for c in cols]
        self._conn.execute(
            f"INSERT INTO event ({','.join(cols)}) VALUES ({','.join('?' for _ in cols)})",
            values,
        )
        self._conn.commit()

    def now(self) -> str:
        return datetime.utcnow().isoformat(timespec="seconds")

    def close(self) -> None:
        self._conn.close()
