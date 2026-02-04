-- TrustGraph D1 Schema
-- Edition 1: Foundation Layer

-- Claims table: stores all claims submitted for validation
CREATE TABLE IF NOT EXISTS claims (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    source_id TEXT,
    submitted_at INTEGER NOT NULL,
    intent_hash TEXT,
    embedding_id TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'validated', 'rejected', 'disputed'))
);

-- Validations table: stores validation results from agents
CREATE TABLE IF NOT EXISTS validations (
    id TEXT PRIMARY KEY,
    claim_id TEXT NOT NULL REFERENCES claims(id),
    agent_type TEXT NOT NULL CHECK (agent_type IN ('consistency', 'source', 'temporal', 'math', 'drift')),
    valid INTEGER NOT NULL, -- 0 or 1
    confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    reasoning TEXT,
    validated_at INTEGER NOT NULL
);

-- Sources table: tracks source reputation
CREATE TABLE IF NOT EXISTS sources (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    trust_score REAL DEFAULT 0.5 CHECK (trust_score >= 0 AND trust_score <= 1),
    verified_claims INTEGER DEFAULT 0,
    false_claims INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Votes table: quadratic voting on disputed claims
CREATE TABLE IF NOT EXISTS votes (
    id TEXT PRIMARY KEY,
    claim_id TEXT NOT NULL REFERENCES claims(id),
    voter_id TEXT NOT NULL,
    weight INTEGER NOT NULL, -- quadratic: cost = weight^2
    direction INTEGER NOT NULL CHECK (direction IN (-1, 1)), -- -1 = reject, 1 = accept
    voted_at INTEGER NOT NULL,
    UNIQUE(claim_id, voter_id)
);

-- Editions table: version control for trust graph state
CREATE TABLE IF NOT EXISTS editions (
    id TEXT PRIMARY KEY,
    version INTEGER NOT NULL,
    parent_id TEXT REFERENCES editions(id),
    merkle_root TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    finalized INTEGER DEFAULT 0
);

-- Intent alignments table: gossip protocol state
CREATE TABLE IF NOT EXISTS intent_alignments (
    id TEXT PRIMARY KEY,
    intent_hash TEXT NOT NULL,
    source_agent TEXT NOT NULL,
    neighbor_agent TEXT NOT NULL,
    similarity REAL NOT NULL CHECK (similarity >= 0 AND similarity <= 1),
    aligned_at INTEGER NOT NULL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_source ON claims(source_id);
CREATE INDEX IF NOT EXISTS idx_validations_claim ON validations(claim_id);
CREATE INDEX IF NOT EXISTS idx_validations_agent ON validations(agent_type);
CREATE INDEX IF NOT EXISTS idx_votes_claim ON votes(claim_id);
CREATE INDEX IF NOT EXISTS idx_editions_version ON editions(version);
CREATE INDEX IF NOT EXISTS idx_intent_hash ON intent_alignments(intent_hash);
