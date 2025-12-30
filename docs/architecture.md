# Architecture

## User story (why this matters)

You don’t want to “block ads”. You want to **control your firehose**.

Wire stripping means:
- every network touch becomes an attributable, explainable *fact*
- every fact is enriched into **who really owns this pipe** (domain → IP → ASN → prefix → entity)
- every policy action is staged (allow/grey/deny) and reversible
- every decision is exportable to enforcement layers (browser, proxy, OS)
- every safe-to-share discovery becomes part of a **decentralized ASN/BGP intelligence commons**

## Swimlane: data plane + control plane

```mermaid
flowchart LR
  subgraph S[Sensor Plane]
    MCP[Browser MCP Sensor]
    MITM[mitmproxy Sensor]
    OSF[OS Flow Sensor]
  end

  subgraph W[wire_stripper Core]
    N[Normalize]
    E[Enrich: DNS + pfx2as + entity graph]
    P[Policy: white/grey/black]
    X[Export: rules + intel]
  end

  subgraph D[Storage]
    DB[(SQLite)]
  end

  subgraph F[Federation]
    OUT[Outbox]
    NET[Decentralized Intel Network]
  end

  MCP --> N
  MITM --> N
  OSF --> N

  N --> DB
  N --> E --> DB
  DB --> P --> DB
  P --> X
  X --> OUT --> NET
```

## Filter logic precedence

```mermaid
flowchart TD
  A[Event: url/host/dst_ip] --> B{Whitelist?}
  B -- yes --> ALLOW[Allow]
  B -- no --> C{Blacklist?}
  C -- yes --> BLOCK[Block]
  C -- no --> D{Greylist?}
  D -- yes --> Q[Quarantine / Ask / TTL]
  D -- no --> E[Allow + Observe]
```

## Notes on viability

- Real-time IP→ASN must use local pfx2as LPM; per-IP whois does not scale.
- Prefix/ASN enforcement must be staged to avoid collateral damage.
