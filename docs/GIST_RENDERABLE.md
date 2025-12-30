# wire_stripper — control your firehose (MCP-in-browser × DMBT × Privacy Proxy)

This is the public-facing conceptual contract for wire_stripper.

Core idea: Claude-in-Chrome is an MCP server inside the browser boundary. If you control the tool router (MCP interception), you control intent, context, and the resulting network graph. That is strictly more powerful than a proxy-only design.

## Canonical system writeup

(Kept in-repo at `docs/WIRE_STRIPPER_APP.md`.)

---

## Architecture diagrams

```mermaid
flowchart LR
  subgraph CP["Control plane (MCP)"]
    CC["Claude Code (MCP client)"]
    FW["Tool router / interceptor\n(claude-code-plugin pattern)"]
    WS["wire_stripper policy engine"]
    EXT["Browser tool host\n(MCP server in browser)"]
  end

  subgraph DP["Data plane (events)"]
    CDP["CDP Network events\n(remote IP + initiator)"]
    MITM["MITM proxy events\n(headers/cookies)"]
    DB["SQLite (single backend)"]
    OTEL["OTLP stream"]
    TUI["otel-tui"]
    SPA["SPA"]
  end

  CC -->|"execute_tool"| FW
  FW -->|"preflight"| WS
  WS -->|"allow/deny/quarantine"| FW
  FW -->|"forward"| EXT

  CDP --> DB
  MITM --> DB
  DB --> OTEL
  OTEL --> TUI
  OTEL --> SPA
```

```mermaid
sequenceDiagram
  participant CC as Claude Code
  participant FW as Tool router / interceptor
  participant WS as wire_stripper
  participant EX as MCP server (browser)
  participant CD as CDP network stream
  participant DB as SQLite

  CC->>FW: execute_tool(tool="navigate", args={url})
  FW->>WS: policy.preflight(url)
  WS-->>FW: allow|deny|quarantine
  alt allow
    FW->>EX: forward navigate
  else deny
    FW-->>CC: error (policy)
  else quarantine
    FW-->>CC: needs approval
  end

  par observation
    CD->>WS: request/response events
  end

  WS->>DB: append + enrich + decide
```

## Repo

Local consolidated repo:
- `D:\somacosf\outputs\wire_stripper`

Public gist URL:
- https://gist.github.com/SoMaCoSF/b03c3bf0ba9e98c063eba9ca8cc73bfb
