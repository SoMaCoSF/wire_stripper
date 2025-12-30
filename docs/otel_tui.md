# OTel + TUI

Goal: the same telemetry stream is viewable in both an SPA and a TUI.

## Recommended baseline

- Emit OpenTelemetry (OTLP) from sensors/policy:
  - `mitmproxy` addon
  - browser MCP/CDP network capture
  - policy decisions
- View in terminal using `otel-tui` (receives OTLP gRPC :4317 and OTLP HTTP :4318).

## Contract (high signal)

- Logs: one log record per event/decision
  - `wire.sensor`, `wire.profile_id`, `url.full`, `url.domain`, `net.peer.ip`, `wire.decision.action`, `wire.enrich.asn`, `wire.enrich.prefix`
- Metrics: counters/histograms for dashboards
  - `wire_events_total{sensor,action}`
  - `wire_bytes_total{direction,sensor,action}`
  - `wire_policy_eval_latency_ms`
- Traces: pipeline spans (ingest/enrich/evaluate/export)

## Why MCP should not carry the OTLP firehose

MCP is the control plane; OTLP is the data plane.

- MCP: start/stop capture, apply policy, export rules
- OTLP: stream events/metrics/traces to viewers
