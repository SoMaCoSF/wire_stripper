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

- Unified SQLite schema (canonical + legacy co-located)
- ETL importers legacy → canonical
- CLI init + ETL
- Docs + diagrams

## 4) What’s missing

- CDP-level network capture with remote IP/port
- Local `pfx2as` longest-prefix match
- Policy preflight in MCP router
- OTLP emission to `otel-tui`
- Enforcement adapters
