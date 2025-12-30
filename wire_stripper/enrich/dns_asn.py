from __future__ import annotations

import ipaddress
import socket
from dataclasses import dataclass


@dataclass(frozen=True)
class ResolvedIp:
    ip: str
    version: int


def resolve_domain(domain: str) -> list[ResolvedIp]:
    try:
        infos = socket.getaddrinfo(domain, None)
    except Exception:
        return []

    ips: list[ResolvedIp] = []
    seen: set[str] = set()
    for ai in infos:
        raw = ai[4][0]
        if not isinstance(raw, str):
            continue
        ip = raw
        if ip in seen:
            continue
        seen.add(ip)
        version = 6 if ":" in ip else 4
        ips.append(ResolvedIp(ip=ip, version=version))

    return sorted(ips, key=lambda x: (x.version, x.ip))


def is_ip(value: str) -> bool:
    try:
        ipaddress.ip_address(value)
        return True
    except Exception:
        return False
