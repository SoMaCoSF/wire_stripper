# HexaphexaH (official): wire_stripper tower defense

HexaphexaH is the canonical geometry/UX language.

This Vercel build is a playable, lightweight hex tower defense themed as network defense:

- **Hex grid (axial coordinates)**: same math as HexaphexaH
- **A\*** pathfinding: attacks route around towers
- **Factions**: ASNs/entities represented as territories (visual only in demo)
- **Creeps**: network attacks (DDoS, credential stuffing, exfiltration, malware drop)
- **Towers**: wire stripping controls (filter, quarantine, sniper, firewall)

The deeper wire_stripper pipeline will generate these maps from real data:
- CDP network events → dst_ip
- pfx2as longest-prefix match → prefix/asn
- entity graph attribution → faction territories

For now, the game is a training simulator that teaches the safe escalation ladder:
- isolate and filter before you hard-block.
