# Handoff Prompt — wire_stripper

You are an agent joining an active build.

## Context

Project: `wire_stripper` — a local firehose governor.

Repo:
- `D:\somacosf\outputs\wire_stripper`

Local source repos:
- `D:\somacosf\outputs\wire_stripper\repos\DMBT`
- `D:\somacosf\outputs\wire_stripper\repos\browser-privacy-proxy`
- `D:\somacosf\outputs\wire_stripper\repos\claude-code-plugin`

## The non-negotiable insight

Claude-in-Chrome is an MCP server living inside the browser boundary.
The MCP tool router is the policy choke point.

We are building an intent-aware, context-aware wire stripper by:
- capturing browser actions and network events
- enriching to IP/ASN/prefix/entity
- generating explainable allow/grey/deny rules
- exporting enforcement plans

## What exists already

- Single SQLite schema (canonical + legacy co-located): `wire_stripper/db/schema.sql`
- ETL importers legacy → canonical: `wire_stripper/etl/*`
- CLI:
  - `python -m wire_stripper --root .\data db init`
  - `python -m wire_stripper --root .\data etl --profile default import-all`

## Your task options (pick one)

### Task A: Replace network capture in claude-code-plugin

Problem:
- `repos/claude-code-plugin/browserbase-client.js` captures only fetch/XHR via injected monkeypatch.
- This misses most traffic and lacks remote IP.

Goal:
- Implement CDP-level network capture (or Stagehand-supported equivalent) and expose it via the existing tool surface (`read_network_requests`), producing structured events with:
  - url, method, status
  - resource type
  - initiator (if available)
  - remote ip/port (critical)

Deliverable:
- A patch in `repos/claude-code-plugin` plus a note on how wire_stripper should ingest the stream.

### Task B: Implement local pfx2as longest-prefix-match

Goal:
- Add a local prefix table and an LPM lookup function.
- Make it callable from wire_stripper enrichment.

Deliverable:
- Python module + schema changes if needed.

### Task C: Policy preflight in the tool router

Goal:
- In `repos/claude-code-plugin/forwarding-server.js`, before executing high-risk tools (`navigate`, `javascript_tool`, `form_input`):
  - call a local policy function (stub ok)
  - deny or quarantine before forwarding
  - redact URLs before logging

Deliverable:
- Router patch + minimal redaction logic.

## Constraints

- Do not break legacy DMBT or browser-privacy-proxy in Phase 1.
- Do not publish secrets.
- Prefer minimal diffs.

## Where to write your notes

- Add your work notes to `docs/DEV_DIARY.md` and create a section with date and your initials.

