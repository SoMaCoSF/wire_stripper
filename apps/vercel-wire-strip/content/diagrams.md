# Diagrams

## 1) Control plane vs data plane

```mermaid
flowchart LR
  subgraph CP["Control plane (low volume)"]
    CC["Claude Code (MCP client)"]
    MCP["MCP tool host (browser extension / bridge)"]
    WS["wire_stripper policy API"]
  end

  subgraph DP["Data plane (firehose)"]
    S1["Browser sensor events"]
    S2["MITM proxy events"]
    S3["OS flow events"]
    OTEL["OpenTelemetry (OTLP)"]
    TUI["otel-tui / other TUI"]
    SPA["SPA dashboard"]
  end

  CC -->|"tool calls"| MCP
  MCP -->|"policy hooks"| WS

  S1 --> OTEL
  S2 --> OTEL
  S3 --> OTEL

  OTEL --> TUI
  OTEL --> SPA
```

## 2) End-to-end wire stripping (swimlane)

```mermaid
sequenceDiagram
  participant B as Browser (MCP/CDP)
  participant P as MITM Proxy
  participant W as wire_stripper
  participant DB as SQLite
  participant L as Lists (white/grey/black)
  participant E as Enforcers
  participant F as Federation

  alt Browser event
    B->>W: event(url, host, initiator, type)
  else Proxy event
    P->>W: event(req/res headers, cookies, dst_ip)
  end

  W->>DB: append raw event
  W->>W: normalize(host/eTLD+1)
  W->>W: enrich(domain->ip->asn->prefix->entity)
  W->>DB: upsert facts (domain/ip/asn/prefix/entity)
  W->>L: evaluate policy (white/grey/black)
  L-->>W: decision(action, reason, confidence)
  W->>DB: record decision

  opt enforce
    W->>E: apply domain rule / prefix plan
  end

  opt federate
    W->>F: publish de-identified intel
  end
```

## 3) Policy precedence

```mermaid
flowchart TD
  A["Candidate: hostname + dst_ip"] --> B{"Whitelist match?"}
  B -- "yes" --> ALLOW["Allow"]
  B -- "no" --> C{"Blacklist match?"}
  C -- "yes" --> BLOCK["Block"]
  C -- "no" --> D{"Greylist match?"}
  D -- "yes" --> Q["Quarantine / Ask / TTL"]
  D -- "no" --> OBS["Allow + Observe"]
```

## 4) Escalation ladder

```mermaid
flowchart LR
  D["domain"] --> ET["eTLD+1"] --> IP["ip"] --> PX["prefix"] --> AS["asn"]
```

## 5) ETL mode flow

```mermaid
flowchart LR
  subgraph Legacy["Legacy (co-located tables)"]
    DMBT["DMBT: ip_map/prefix_map/blocklist/flow_history"]
    PP["Privacy Proxy: tracking_domains/request_log/cookie_traffic"]
  end

  subgraph Canonical["Canonical (wire_stripper)"]
    WS["event/domain/ip/asn/prefix/list_entry"]
  end

  DMBT -->|"etl import"| WS
  PP -->|"etl import"| WS
```
