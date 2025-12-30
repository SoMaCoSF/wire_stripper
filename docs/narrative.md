# Narrative: why wire_stripper exists

## The user story

You’re not trying to “block ads”. You’re trying to **control your firehose**.

That means:
- Every outbound touch becomes a *recorded fact* (what happened).
- Every fact becomes *attributed* (who owns the pipe).
- Every attribution becomes *actionable* (allow/grey/deny).
- Every action becomes *enforceable* at the right layer (browser, proxy, OS).
- Every enforcement becomes *reversible* (no self-DOS).
- Every safe-to-share discovery becomes part of a **decentralized ASN/BGP commons**.

This is wire stripping: turning the chaotic perimeter into structured, replayable, evolvable policy.

## The power of this level of “wire stripping”

1) **Identity-centric control**
- You can run multiple profiles (devices, browser personas, edge nodes).
- Each profile has its own allow/grey/deny sets and its own evidence trail.

2) **Attribution beyond domains**
- Domains are cheap to rotate.
- ASNs, prefixes, and corporate ownership are harder to fake.
- The system escalates from domain-level blocks to prefix-level blocks only when evidence warrants it.

3) **Feedback loops instead of static lists**
- The system is driven by sensors that observe the real world.
- Lists become derivatives of observed traffic + enrichment + policy, not manual curation.

4) **Composability of sensors**
- Browser MCP sensor provides context (initiator, tab, resource type).
- MITM proxy sensor provides HTTP semantics (headers, cookies, fingerprint surface).
- OS flow sensor (future) provides coverage (all processes).

5) **Federation without leaking your life**
- Share entity/ASN/prefix facts and confidence, not raw URLs or cookie values.
- Your edge devices become “radars” feeding an `ASN_BGP_SCAPE`.

## ETL mode (Phase 1)

In this phase, we do not rewrite DMBT or browser-privacy-proxy.

We co-locate all tables in one SQLite file and run ETL:
- DMBT tables → canonical facts + list entries
- Privacy Proxy tables → canonical facts + list entries

This gives immediate unification, without breaking existing tools.

## Next phases

- Replace per-IP Cymru lookups with local `pfx2as` LPM (scale).
- Make the MCP interception point (claude-code-plugin) enforce policy pre-flight.
- Export rule plans to browser rules + OS firewall (safe staged rollout).
- Add OTLP emission and use `otel-tui` for an always-available terminal dashboard.
