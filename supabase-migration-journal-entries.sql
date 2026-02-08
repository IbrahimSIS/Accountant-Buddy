-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: Create journal_entries table for double-entry accounting
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id),
  debit NUMERIC DEFAULT 0,
  credit NUMERIC DEFAULT 0,
  date DATE NOT NULL,
  notes TEXT,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast balance lookups
CREATE INDEX IF NOT EXISTS idx_journal_entries_client_date
  ON journal_entries (client_id, date);

CREATE INDEX IF NOT EXISTS idx_journal_entries_transaction
  ON journal_entries (transaction_id);

CREATE INDEX IF NOT EXISTS idx_journal_entries_account
  ON journal_entries (account_id);

-- Enable Row Level Security
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can manage journal entries for their own clients
CREATE POLICY "Users can manage their journal entries"
  ON journal_entries
  FOR ALL
  USING (
    client_id IN (
      SELECT id FROM clients WHERE owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT id FROM clients WHERE owner_user_id = auth.uid()
    )
  );

-- Also allow access via client_access table (shared clients)
CREATE POLICY "Shared users can manage journal entries"
  ON journal_entries
  FOR ALL
  USING (
    client_id IN (
      SELECT client_id FROM client_access WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT client_id FROM client_access WHERE user_id = auth.uid()
    )
  );
