# Gamification: HexaphexaH wire_stripper (tower defense)

This Vercel game is a *training simulator* for real wire stripping.

Instead of abstract “nodes”, you play a hex-based tower defense:
- **Creeps** = network attacks
- **Towers** = wire-stripping controls
- **Pathfinding** = how attacks route around your defenses

The objective is to reduce risk without self-DOS.

---

## 1) Core loop

1) Observe attacks entering your network perimeter
2) Place controls (towers) to mitigate
3) Maintain availability by avoiding overblocking
4) Earn gold and score by neutralizing threats

---

## 2) Attack (creep) types

All attacks have: `health`, `speed`, `reward`, `baseDamage`, `tags`.

- **DDoS Swarm**
  - Many fast, low-HP creeps
  - Teaches: rate limiting and AOE defenses

- **Credential Stuffing**
  - Medium HP, medium speed
  - Teaches: targeted controls and prioritization

- **Exfiltration**
  - Tanky, slow-ish, high base damage
  - Teaches: early detection + sniper controls

- **Malware Drop**
  - Slow, high HP
  - Teaches: layered defense and choke points

---

## 3) Tower (control) types

- **Filter (baseline)**
  - Medium range, medium damage
  - Represents basic allow/deny filtering

- **Quarantine (slow)**
  - Applies slow within range
  - Represents greylist/quarantine and inspection delay

- **Sniper (precision)**
  - Long range, high damage, slow rate
  - Represents targeted block based on high-confidence attribution

- **Firewall (AOE)**
  - Short range, splash damage
  - Represents coarse perimeter controls (powerful but collateral risk)

---

## 4) Real-world mapping

This is not fantasy — each “country” on the hex map can represent:
- an ASN
- a company entity
- a subsidiary cluster

In the real system:
- territories are generated from observed CDP network events enriched by DMBT (IP→ASN→prefix)
- attack waves are generated from real traffic classifications (tracker beacons, C2, brute force)

---

## 5) Scoring (the training incentive)

- +score for killing threats
- +gold for kills (build more controls)
- penalty if too many attacks reach base

The scoring is designed to reward:
- correct defenses
- early interception
- minimal collateral

---

## 6) Why hex + A*

Hex grids produce clean, legible choke points.
A* pathfinding makes defenses meaningful:
- you can build funnels
- you can force reroutes
- you can test "does this block everything?" as a safety mechanic
