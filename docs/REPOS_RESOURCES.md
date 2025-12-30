# repos/* resources

This repo keeps local clones under `repos/` as source material.

## Contents

- `repos/claude-code-plugin`
  - Provides the MCP tool router interception point for browser automation.
  - Key files:
    - `forwarding-server.js` (tool routing)
    - `browserbase-client.js` (Stagehand/CDP wrapper; current network logging via fetch/XHR patch)
    - `hooks/hooks.json` (SessionStart/PreToolUse hooks)

- `repos/DMBT`
  - Domain→IP→ASN→prefix enrichment + prefix blocklist workflow.
  - Key tables: `ip_map`, `asn_map`, `prefix_map`, `blocklist`, `flow_history`

- `repos/browser-privacy-proxy`
  - mitmproxy addon patterns for request logging, cookie suppression, fingerprint shaping.
  - Key tables: `tracking_domains`, `tracking_ips`, `cookie_traffic`, `request_log`, `whitelist`

## Important

These repos are not yet integrated as submodules; they are referenced for implementation.

Recommended future structure:
- Add them as git submodules rather than committing vendor copies.
- Keep `repos/` ignored from the published wire_stripper repo, but provide a bootstrap script that clones them.

