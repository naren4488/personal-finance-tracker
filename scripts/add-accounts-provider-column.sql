-- =============================================================================
-- Fix: ERROR: column "provider" of relation "accounts" does not exist (42703)
-- =============================================================================
-- Run this against the SAME PostgreSQL database your Go API uses (expense_tracjer).
-- Wrong DB = column still "missing" and POST /accounts keeps returning 500.
--
-- psql example (replace connection string):
--   psql "postgresql://USER:PASS@localhost:5432/DBNAME" -f scripts/add-accounts-provider-column.sql
--
-- Verify:
--   \d accounts
--   You should see a "provider" column.
-- =============================================================================

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT '';
