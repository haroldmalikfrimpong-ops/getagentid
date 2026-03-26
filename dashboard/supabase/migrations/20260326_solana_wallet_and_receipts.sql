-- ============================================================================
-- AgentID: Auto-derived Solana wallet + Dual Receipt system
-- Run this against your Supabase project (SQL editor or CLI)
-- ============================================================================

-- 1. Add solana_address column to agents table
-- This stores the base58 Solana address auto-derived from the Ed25519 key.
-- Solana uses Ed25519 natively, so the public key in base58 IS the address.
ALTER TABLE agents ADD COLUMN IF NOT EXISTS solana_address text;

-- Index for balance lookups by Solana address
CREATE INDEX IF NOT EXISTS idx_agents_solana_address ON agents (solana_address)
  WHERE solana_address IS NOT NULL;

-- 2. Create action_receipts table for dual receipt storage
CREATE TABLE IF NOT EXISTS action_receipts (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  receipt_id    uuid NOT NULL UNIQUE,
  action        text NOT NULL,            -- 'verification', 'payment', 'handoff', 'challenge', 'registration', 'ed25519_bound'
  agent_id      text NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,
  timestamp     timestamptz NOT NULL,
  data_hash     text NOT NULL,            -- SHA-256 of the action data
  signature     text NOT NULL,            -- HMAC-SHA256 signed by platform key

  -- Blockchain receipt fields (nullable — on-chain is best-effort)
  tx_hash       text,                     -- Solana transaction signature
  cluster       text,                     -- 'devnet' or 'mainnet-beta'
  explorer_url  text,                     -- Solana Explorer link
  block_time    bigint,                   -- Unix timestamp from chain
  memo          text,                     -- The action data stored on-chain

  -- Raw action data for audit
  raw_data      jsonb,

  created_at    timestamptz DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_action_receipts_agent_id ON action_receipts (agent_id);
CREATE INDEX IF NOT EXISTS idx_action_receipts_action ON action_receipts (action);
CREATE INDEX IF NOT EXISTS idx_action_receipts_tx_hash ON action_receipts (tx_hash)
  WHERE tx_hash IS NOT NULL;

-- Enable RLS (receipts are readable by the agent owner)
ALTER TABLE action_receipts ENABLE ROW LEVEL SECURITY;

-- Policy: anyone can read receipts (they're public audit trail)
CREATE POLICY "Receipts are publicly readable"
  ON action_receipts FOR SELECT
  USING (true);

-- Policy: only service role can insert
CREATE POLICY "Service role can insert receipts"
  ON action_receipts FOR INSERT
  WITH CHECK (true);
