# wire_stripper.app — full system writeup

This document describes wire_stripper as an application: its planes, sensors, storage, enrichment, policy, enforcement, and federation.

## 1) Statement

wire_stripper is a **local perimeter compiler**.

Inputs: high-entropy web + network activity.
Outputs: explainable allow/grey/deny policy, enforcement plans, and de-identified intel for an `ASN_BGP_SCAPE`.

## 2) Core insight: MCP-in-browser (reverse engineered)

### 2.1 What “Claude-in-Chrome” really is

Claude-in-Chrome is best understood as:
- a **browser-resident MCP server** that exposes a tool surface (navigate, read page, run JS, etc.)
- running *inside* the browser boundary, with access to browser context

Claude Code is:
- an **MCP client** calling typed tools (JSON args → JSON results)

This changes the privacy/security architecture completely.

A traditional proxy sees traffic after the browser has already decided.
A tool router sees:
- **intent** (what Claude asked the browser to do)
- **context** (which tab/frame/initiator)
- **consequences** (resulting network graph)

wire_stripper is built to exploit that advantage.

### 2.2 The actual interception point (validated via `claude-code-plugin`)

The repo `repos/claude-code-plugin` demonstrates the operational reality:

- Claude Code’s browser bridge speaks to a local socket.
- The plugin inserts a **ForwardingServer** that reads length-prefixed JSON messages and handles `execute_tool` with a `tool` name and `args`.
- Tools are dispatched in a `switch(tool)` router (navigate, javascript_tool, form_input, read_network_requests, etc.).

In other words: there is already a real-world **tool router** where you can inject policy.

### 2.3 Why this is the lever (the “wire stripping” move)

If you attach wire_stripper policy to the MCP router, you get capabilities a proxy cannot provide:

- **Preflight gating**: deny/quarantine `navigate` before any network is touched.
- **Least-privilege tools**: disable `javascript_tool` or file upload for specific profiles.
- **Argument redaction**: strip query params / identifiers *before* they hit logs or the DB.
- **Provenance**: attach decision IDs / trace IDs so each network event is attributable to an intent.

### 2.4 Correct capture model: do not confuse “tool actions” with “network truth” 

A second validated lesson from `claude-code-plugin`:
- Its current “network capture” is implemented by **injecting JS to patch fetch/XHR**.

That is insufficient for wire_stripper because it misses most real traffic and lacks remote IP.

The correct model is:
- tool router (MCP) = control plane
- CDP Network events = data plane sensor

We need CDP events that include remote IP/port so DMBT-style enrichment (IP→ASN→prefix) is real.

## 3) Planes

### Control plane (MCP)
- Start/stop capture
- Apply/preview policies
- Explain a domain/IP/ASN
- Export enforcement plans

### Data plane (events)
- Browser network events (CDP)
- Proxy HTTP events (mitmproxy)
- OS flows (future)

Data plane should be streamed via OTel/OTLP for universal UI.

## 4) Sensors

- Browser MCP/CDP sensor: captures full request graph with initiators.
- MITM proxy sensor: captures HTTP semantics and can strip cookies/headers.
- OS flow sensor (future): captures non-browser egress.

## 5) Storage: one SQLite backend

We use a single SQLite DB for:
- canonical facts/policy
- legacy tables for compatibility

Schema:
- `wire_stripper/db/schema.sql`

Conventions:
- WAL mode
- busy timeout
- append-only events (no mutation of raw observations)

## 6) Enrichment

Primary enrichment transforms:
- `hostname` → DNS resolution history
- `dst_ip` → local pfx2as LPM → `prefix` → `asn`
- `asn` → org/entity attribution

Rule: avoid per-IP whois on firehose.

## 7) Policy

Policy model:
- `list_entry(profile_id, list_type, target_type, target_value)`

Precedence:
- whitelist overrides
- blacklist blocks
- greylist quarantines/TTL

Escalation ladder:
- domain → eTLD+1 → ip → prefix → asn

## 8) Enforcement

Adapters (planned):
- Browser rules export (domain/eTLD+1)
- Proxy enforcement (header/cookie stripping)
- OS firewall plans (prefix with TTL and rollback)

## 9) Federation (ASN_BGP_SCAPE)

Goal:
- a decentralized corpus of entity/ASN/prefix/domain relationships

Privacy constraints:
- never publish raw URLs, cookie values
- publish relationship facts + confidence
- allow k-anonymized aggregates

Mechanism:
- outbox pattern (`federation_outbox`)
- signed batches

## 10) Current implementation status

Implemented:
- unified SQLite schema
- ETL importers
- CLI init + ETL
- docs + diagrams

Not yet implemented:
- CDP network capture
- local pfx2as
- OTLP emission
- enforcement adapters
