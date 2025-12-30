# Development Diary — wire_stripper

Date: 2025-12-29

This diary is written as a handoff artifact: it records *what exists*, *why it exists*, and *what is missing*.

## 1) Vision checkpoint (non-negotiables)

wire_stripper is not “an adblocker” and not “just a proxy”. It is a **firehose governor**:

- Capture: observe all meaningful egress/ingress activity.
- Attribution: map observed traffic to *routing/ownership reality* (domain → IP → ASN → prefix → entity).
- Policy: mint explainable allow/grey/deny decisions.
- Enforcement: stage and export rules (browser → proxy → OS firewall).
- Federation: publish *safe-to-share* intel into an `ASN_BGP_SCAPE` without leaking personal browsing.

The differentiator is the reverse-engineered insight:

- Claude-in-Chrome is effectively an **MCP server inside the browser boundary**.
- Claude Code calls tools, not “UI automation”.
- The MCP tool router is a **policy choke point** that can gate/transform actions and attach provenance.

## 2) Repo layout (current)

Repo root:
- `D:\somacosf\outputs\wire_stripper`

Key folders:
- `wire_stripper/` — new Python package
- `docs/` — narrative/diagrams + handoff docs
- `repos/` — local clones used as source material:
  - `repos/DMBT`
  - `repos/browser-privacy-proxy`
  - `repos/claude-code-plugin`

## 3) What is implemented

### 3.1 Unified SQLite backend

File: `wire_stripper/db/schema.sql`

We implemented a single SQLite schema that intentionally co-locates:

- Canonical wire_stripper tables:
  - `event`, `domain`, `ip`, `asn`, `prefix`, `entity`
  - `list_entry` (white/grey/black)
  - `decision` (explainability)
  - `federation_outbox` (future)

- Legacy compatibility tables:
  - DMBT: `ip_map`, `asn_map`, `prefix_map`, `blocklist`, `flow_history`
  - Privacy Proxy: `tracking_domains`, `tracking_ips`, `cookie_traffic`, `request_log`, `whitelist`, `fingerprint_rotations`, `diary_entries`

DB initialization uses WAL, busy_timeout, etc.

File: `wire_stripper/db/store.py`

### 3.2 ETL mode (selected strategy)

We chose Strategy (1): **co-locate now, ETL into canonical**.

Importer modules:
- `wire_stripper/etl/import_dmbt.py`
- `wire_stripper/etl/import_privacy_proxy.py`
- `wire_stripper/etl/import_all.py`

ETL behavior:
- DMBT `blocklist` → canonical `list_entry` black/prefix
- DMBT `flow_history` → canonical `event`
- Privacy Proxy `whitelist` → canonical `list_entry` white/domain
- Privacy Proxy `tracking_domains/tracking_ips` → canonical facts + blacklist entries
- Privacy Proxy `request_log/cookie_traffic` → canonical `event`

### 3.3 CLI wiring

Module: `wire_stripper/__main__.py`

Commands:
- `python -m wire_stripper --root .\data db init`
- `python -m wire_stripper --root .\data etl --profile default import-all`

Note: flag ordering matters (`--root` must come before the subcommand).

### 3.4 Documentation

- `docs/narrative.md`
- `docs/diagrams.md` (Mermaid fixed to GitHub-compatible syntax)
- `docs/otel_tui.md`
- `docs/architecture.md`

### 3.5 Public gist

Canonical conceptual writeup is maintained as a gist.

Gist URL:
- `https://gist.github.com/SoMaCoSF/b03c3bf0ba9e98c063eba9ca8cc73bfb`

## 4) What is NOT implemented yet (gaps)

### 4.1 High-fidelity browser network capture

The `claude-code-plugin` provides a promising interception point, but currently:
- network capture is done by monkeypatching fetch/XHR in page context
- it does not provide reliable remote IP/port
- it misses most resource traffic (document, script, image, font, etc.)

For wire_stripper, we need CDP network events:
- `Network.requestWillBeSent`
- `Network.responseReceived` (remoteIPAddress/remotePort)
- `Network.loadingFinished`

### 4.2 pfx2as (local longest-prefix match)

DMBT currently uses per-IP Team Cymru whois. This will not scale.

The viability cliff:
- to ingest a firehose, we must do local pfx2as longest-prefix-match.

### 4.3 Policy preflight at MCP router

The power move is to enforce policy at the tool router:
- block / quarantine navigations at intent-time
- redact query params and IDs before persistence

This is not yet wired.

### 4.4 OTLP emission

We want the same stream visible in both:
- TUI (`otel-tui`)
- SPA (lightweight)

No OTel emitters are implemented yet.

### 4.5 Enforcement adapters

Not implemented:
- Chrome rule export
- hosts/dns sinkhole export
- Windows firewall prefix plan generation

## 5) Findings from reading `repos/claude-code-plugin`

Key files:
- `forwarding-server.js` — the tool router
- `browserbase-client.js` — Stagehand/CDP wrapper + current “network capture”
- `scripts/session-start.sh` — starts server, manages credentials

Issues:
- capture is fetch/XHR patching (insufficient)
- the router does not enforce policy
- it renames an existing socket to `.backup` but does not restore it
- it logs raw payload snippets (risk)
- it is unix/mac oriented (not Windows-ready)

## 6) Next work packages (handoff-ready)

- A) Replace network capture with CDP Network events (remote IP/port + initiator)
- B) Add local pfx2as dataset + LPM lookup
- C) Add policy preflight + redaction in the MCP router
- D) Emit OTLP logs/metrics/traces and validate via `otel-tui`

