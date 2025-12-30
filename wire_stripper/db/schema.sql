-- wire_stripper unified schema (v0)
-- Single SQLite backend backing:
-- - wire_stripper core facts/policy
-- - DMBT tables (ip→asn→prefix + blocklist)
-- - browser-privacy-proxy tables (tracking/cookies/fingerprint)

-- ------------------------------------------------------------------------------
-- wire_stripper core (canonical)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS entity (
  entity_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  entity_type TEXT,
  parent_entity_id TEXT,
  notes TEXT,
  first_seen DATETIME,
  last_seen DATETIME
);

CREATE TABLE IF NOT EXISTS domain (
  domain TEXT PRIMARY KEY,
  etld1 TEXT,
  entity_id TEXT,
  category TEXT,
  confidence REAL DEFAULT 0.5,
  first_seen DATETIME,
  last_seen DATETIME
);

CREATE TABLE IF NOT EXISTS asn (
  asn TEXT PRIMARY KEY,
  org_name TEXT,
  entity_id TEXT,
  rir TEXT,
  first_seen DATETIME,
  last_seen DATETIME
);

CREATE TABLE IF NOT EXISTS ip (
  ip TEXT PRIMARY KEY,
  ip_version INTEGER,
  asn TEXT,
  asn_name TEXT,
  entity_id TEXT,
  first_seen DATETIME,
  last_seen DATETIME
);

CREATE TABLE IF NOT EXISTS prefix (
  prefix TEXT PRIMARY KEY,
  asn TEXT,
  entity_id TEXT,
  source TEXT,
  first_seen DATETIME,
  last_seen DATETIME
);

CREATE TABLE IF NOT EXISTS event (
  event_id TEXT PRIMARY KEY,
  ts DATETIME NOT NULL,
  sensor TEXT NOT NULL,
  profile_id TEXT,
  url TEXT,
  hostname TEXT,
  method TEXT,
  resource_type TEXT,
  src_ip TEXT,
  dst_ip TEXT,
  dst_port INTEGER,
  proto TEXT,
  bytes INTEGER,
  headers_json TEXT,
  cookies_json TEXT,
  initiator_json TEXT
);

CREATE TABLE IF NOT EXISTS list_entry (
  entry_id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  list_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_value TEXT NOT NULL,
  reason TEXT,
  created_at DATETIME,
  created_by TEXT,
  expires_at DATETIME,
  UNIQUE(profile_id, list_type, target_type, target_value)
);

CREATE TABLE IF NOT EXISTS decision (
  decision_id TEXT PRIMARY KEY,
  ts DATETIME NOT NULL,
  profile_id TEXT,
  url TEXT,
  hostname TEXT,
  dst_ip TEXT,
  effective_action TEXT,
  matched_rule TEXT,
  explanation TEXT,
  confidence REAL
);

CREATE TABLE IF NOT EXISTS federation_outbox (
  id TEXT PRIMARY KEY,
  ts DATETIME,
  kind TEXT,
  payload_json TEXT,
  privacy_level TEXT,
  status TEXT
);

CREATE INDEX IF NOT EXISTS idx_event_ts ON event(ts);
CREATE INDEX IF NOT EXISTS idx_event_host ON event(hostname);
CREATE INDEX IF NOT EXISTS idx_list_profile ON list_entry(profile_id);

-- ------------------------------------------------------------------------------
-- DMBT compatibility tables (kept as-is so the original scripts can be ported)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ip_map(
  domain TEXT,
  ip TEXT,
  ip_version INTEGER,
  asn TEXT,
  asn_name TEXT,
  source TEXT,
  seen_at DATETIME,
  PRIMARY KEY(domain, ip)
);

CREATE TABLE IF NOT EXISTS asn_map(
  asn TEXT PRIMARY KEY,
  org_name TEXT,
  first_seen DATETIME,
  last_seen DATETIME
);

CREATE TABLE IF NOT EXISTS prefix_map(
  prefix TEXT PRIMARY KEY,
  asn TEXT,
  source TEXT,
  first_seen DATETIME,
  last_seen DATETIME
);

CREATE TABLE IF NOT EXISTS blocklist(
  prefix TEXT PRIMARY KEY,
  asn TEXT,
  reason TEXT,
  added_at DATETIME
);

CREATE TABLE IF NOT EXISTS flow_history(
  ts DATETIME,
  src_ip TEXT,
  dst_ip TEXT,
  dst_port INTEGER,
  proto TEXT,
  bytes INTEGER,
  hostname TEXT
);

CREATE INDEX IF NOT EXISTS idx_ip_map_domain ON ip_map(domain);
CREATE INDEX IF NOT EXISTS idx_ip_map_ip ON ip_map(ip);
CREATE INDEX IF NOT EXISTS idx_prefix_map_asn ON prefix_map(asn);
CREATE INDEX IF NOT EXISTS idx_flow_history_ts ON flow_history(ts);

-- ------------------------------------------------------------------------------
-- browser-privacy-proxy compatibility tables (kept as-is so code ports cleanly)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tracking_domains (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT UNIQUE NOT NULL,
    first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    hit_count INTEGER DEFAULT 1,
    blocked BOOLEAN DEFAULT 1,
    category TEXT DEFAULT 'tracker',
    notes TEXT
);

CREATE TABLE IF NOT EXISTS tracking_ips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_address TEXT UNIQUE NOT NULL,
    first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    hit_count INTEGER DEFAULT 1,
    blocked BOOLEAN DEFAULT 1,
    associated_domain TEXT,
    notes TEXT,
    FOREIGN KEY (associated_domain) REFERENCES tracking_domains(domain)
);

CREATE TABLE IF NOT EXISTS cookie_traffic (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    domain TEXT NOT NULL,
    cookie_name TEXT,
    cookie_value TEXT,
    ip_address TEXT,
    request_url TEXT,
    blocked BOOLEAN DEFAULT 1
);

CREATE TABLE IF NOT EXISTS fingerprint_rotations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_agent TEXT,
    platform TEXT,
    accept_language TEXT,
    accept_encoding TEXT,
    referer_policy TEXT,
    rotation_trigger TEXT
);

CREATE TABLE IF NOT EXISTS request_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    method TEXT,
    url TEXT,
    host TEXT,
    ip_address TEXT,
    fingerprint_id INTEGER,
    blocked BOOLEAN DEFAULT 0,
    block_reason TEXT,
    FOREIGN KEY (fingerprint_id) REFERENCES fingerprint_rotations(id)
);

CREATE TABLE IF NOT EXISTS diary_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    entry_type TEXT,
    title TEXT,
    content TEXT,
    agent_id TEXT
);

CREATE TABLE IF NOT EXISTS whitelist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT UNIQUE NOT NULL,
    added TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_tracking_domains_domain ON tracking_domains(domain);
CREATE INDEX IF NOT EXISTS idx_tracking_ips_ip ON tracking_ips(ip_address);
CREATE INDEX IF NOT EXISTS idx_cookie_traffic_domain ON cookie_traffic(domain);
CREATE INDEX IF NOT EXISTS idx_cookie_traffic_timestamp ON cookie_traffic(timestamp);
CREATE INDEX IF NOT EXISTS idx_request_log_timestamp ON request_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_request_log_host ON request_log(host);
