# Gamification: turning real ASN/IP/entity intelligence into an interactive perimeter game

This page is the *design spec* for the Vercel wire_stripper “power map” experience.

It is based on the real-world AEGIS / Unified Power Intelligence model:
- entities (companies, politicians, institutions)
- network ownership (ASNs, prefixes)
- corporate hierarchy (subsidiaries)
- risk signals (data broker / ad-tech / surveillance)
- composite power scoring

The goal is to make **operational network defense** feel like a strategy game, without losing fidelity.

---

## 1) What the player is actually doing

You are an edge device trying to **govern your firehose**.

You do not “win” by blocking everything.
You win by:
- minimizing tracking exposure
- minimizing collateral damage
- building attribution certainty
- escalating enforcement cautiously (domain → eTLD+1 → ip → prefix → ASN)

This maps perfectly to gameplay loops.

---

## 2) Core mechanics

### 2.1 Inspect → Attribute → Decide → Enforce

Each node (entity, ASN) has:
- `threat` (privacy risk)
- `power` (infrastructure control)
- `tier` (power tier)
- `category` tags (data_broker, ad_tech, surveillance, cloud, cdn)

Player actions:
- **Inspect** (gain intel; increases confidence)
- **Quarantine** (greylist; time-boxed)
- **Block** (denylist)
- **Allow** (whitelist override)

### 2.2 Escalation ladder as a “skill tree”

You start with lightweight controls:
- block domains / eTLD+1

Unlock stronger abilities:
- block IP
- block prefix

“ASN block” is a late-game ability with severe penalties.

---

## 3) Scoring system (XP) — optimized for real-world behavior

The scoring should reward *correct, low-collateral decisions*.

- +5 XP: inspect a node
- +15 XP: identify a subsidiary chain (parent → child)
- +25 XP: block a high-threat node (threat ≥ 0.8)
- +40 XP: block an entity’s ASN cluster *without* breaking allowlisted dependencies
- -50 XP: over-block (block a CDN/Cloud ASN without allowlist exceptions)

A “Heat” meter tracks **unblocked threat**:
- Heat is the sum of threat scores of nodes reachable from the player.
- Goal is to reduce Heat while keeping “Availability” above a threshold.

---

## 4) Achievements (high-signal, not gimmicks)

- **First Blood**: first block action
- **Data Broker Hunter**: block 3 data_broker entities
- **Ad-Tech Surgeon**: block 10 ad_tech nodes without blocking a CDN
- **No Collateral**: complete a mission with zero Availability penalties
- **Tier-2 Takedown**: reduce exposure to a TIER_2 entity (e.g., Meta/Google) below a threshold using targeted actions

---

## 5) Missions (quests) generated from real topology

Missions should be graph-derived:

### Mission type A: “Chain Cut”
- Identify and neutralize a tracking chain:
  `Parent company → subsidiary → ASN(s)`

Example (from seed data):
- Alphabet → Google → (AS15169, AS36040, AS36384)

### Mission type B: “Contain the Broker”
- Reduce exposure to entities tagged `data_broker` below a threshold.

Example:
- Meta Platforms (data_broker)

### Mission type C: “Collateral-safe hardening”
- Minimize heat without blocking CDNs.

---

## 6) What makes this powerful vs toy gamification

The game is not fictional.

It trains the operator to internalize:
- corporate hierarchy (ownership chains)
- infrastructure reality (ASNs/prefixes)
- safe enforcement ladders
- tradeoffs between privacy and availability

Over time, your local edge devices become sensors feeding the `ASN_BGP_SCAPE`.

---

## 7) UI concepts for the Vercel SPA

- Force-directed graph map (entities + ASNs)
- Click node → right-side inspector panel
- Buttons: Inspect / Block / Unblock / Quarantine
- HUD:
  - XP + Level
  - Heat (exposure)
  - Availability (collateral)
  - Current mission

All actions persist locally (LocalStorage) in the web demo.
In the real system, actions map to:
- SQLite list_entry mutations
- export plans (browser rules / firewall)

