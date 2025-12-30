from __future__ import annotations

import argparse
import os
from pathlib import Path

from wire_stripper.db.store import Store
from wire_stripper.etl.import_all import import_all
from wire_stripper.etl.import_dmbt import import_dmbt
from wire_stripper.etl.import_privacy_proxy import import_privacy_proxy


def _default_root() -> str:
    return os.environ.get("WIRE_STRIPPER_ROOT", str(Path.cwd() / "data"))


def cmd_db_init(args: argparse.Namespace) -> int:
    store = Store(args.root)
    store.init_db()
    store.close()
    print(f"initialized db: {store.paths.db_path}")
    return 0


def _with_store(args: argparse.Namespace) -> Store:
    store = Store(args.root)
    store.init_db()
    return store


def cmd_etl_import_dmbt(args: argparse.Namespace) -> int:
    store = _with_store(args)
    counts = import_dmbt(store, profile_id=args.profile)
    store.close()
    print({"import": "dmbt", "counts": counts})
    return 0


def cmd_etl_import_privacy(args: argparse.Namespace) -> int:
    store = _with_store(args)
    counts = import_privacy_proxy(store, profile_id=args.profile)
    store.close()
    print({"import": "privacy_proxy", "counts": counts})
    return 0


def cmd_etl_import_all(args: argparse.Namespace) -> int:
    store = _with_store(args)
    counts = import_all(store, profile_id=args.profile)
    store.close()
    print({"import": "all", "counts": counts})
    return 0


def main() -> int:
    p = argparse.ArgumentParser(prog="wire-strip")
    p.add_argument("--root", default=_default_root(), help="data root (db location)")

    sub = p.add_subparsers(dest="cmd", required=True)

    dbp = sub.add_parser("db")
    dbsub = dbp.add_subparsers(dest="dbcmd", required=True)
    dbinit = dbsub.add_parser("init")
    dbinit.set_defaults(func=cmd_db_init)

    etlp = sub.add_parser("etl", help="import legacy tables into canonical tables")
    etlp.add_argument("--profile", default="default", help="policy/profile scope")
    etls = etlp.add_subparsers(dest="etlcmd", required=True)

    etd = etls.add_parser("import-dmbt")
    etd.set_defaults(func=cmd_etl_import_dmbt)

    etp = etls.add_parser("import-privacy")
    etp.set_defaults(func=cmd_etl_import_privacy)

    eta = etls.add_parser("import-all")
    eta.set_defaults(func=cmd_etl_import_all)

    args = p.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
