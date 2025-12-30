# claude-code-plugin analysis (for wire_stripper)

Repo path:
- `repos/claude-code-plugin`

This doc captures what matters for wire_stripper: how Claude’s Chrome actions are routed and what network capture you do/do not get.

## 1) What this plugin actually is

From `repos/claude-code-plugin/README.md`:
- Intercepts Claude Code browser automation commands (`mcp__claude-in-chrome__*`).
- Forwards them to Browserbase cloud browsers.
- Uses a local forwarding server (Unix socket) and a Browserbase/Stagehand CDP layer.

In wire_stripper terms:
- It is a **tool router / interception point** (control plane).
- It is not, by itself, a complete wire capture system.

## 2) Tool routing (control plane) — where policy should live

File: `repos/claude-code-plugin/forwarding-server.js`

- Listens on a local Unix socket and reads length-prefixed JSON.
- Only accepts `payload.method === "execute_tool"`.
- Routes by `params.tool` (switch-case) into handlers.

Why it matters:
- This is the best place to enforce **preflight policy**: deny/quarantine navigation or high-risk tools before they execute.
- This is also the best place to do **redaction** before anything hits logs.

## 3) Capture design (data plane) — what it currently does

File: `repos/claude-code-plugin/browserbase-client.js`

Current “network capture” is implemented by injecting page scripts that:
- monkeypatch `window.fetch`
- monkeypatch `XMLHttpRequest.open` + `XMLHttpRequest.send`
- store a rolling array `window.__networkRequests`

This yields partial visibility:
- Captures *some* JS-level HTTP calls.
- Does not capture browser-native resource loading (document, scripts, images, CSS, fonts).
- Does not capture non-fetch protocols (websocket, webrtc) properly.
- Does not give reliable remote IP/port → blocks DMBT’s IP→ASN→prefix mapping.

## 4) Why this is a problem for wire_stripper

wire_stripper needs attribution-grade facts:
- dst_ip
- dst_port
- resource type
- initiator context

Fetch/XHR monkeypatching misses too much and can be bypassed. It’s not a true firehose sensor.

## 5) Required upgrade for wire_stripper

Replace monkeypatch network logging with CDP/Playwright network events:
- `Network.requestWillBeSent`
- `Network.responseReceived` (remote IP/port)
- `Network.loadingFinished`

Emit structured events:
- url, method, status
- resourceType
- initiator/frame/tab
- remoteIPAddress, remotePort

Then wire_stripper can:
- enrich dst_ip→pfx2as→asn→prefix→entity
- mint list entries

## 6) Other risks to address

- Socket lifecycle: it renames an existing socket to `.backup` but does not restore it on shutdown.
- Logging: it logs raw payload snippets; this can leak tokens/URLs.
- Platform mismatch: scripts assume bash + macOS Chrome directory.

## 7) Integration recommendation

Treat this plugin as:
- **control plane router** (policy gating + redaction + provenance)

But do NOT treat it as the sole data plane. Use CDP network events for the data plane.
