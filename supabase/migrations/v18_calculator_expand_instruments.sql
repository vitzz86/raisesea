-- ═══════════════════════════════════════════════════════════════
-- v18_calculator_expand_instruments.sql
-- Chunk 12.7.5: expand safe_scenarios.instrument CHECK constraint
-- to allow 'equity' and 'debt' alongside the original SAFE/Note values.
--
-- We're keeping the table name 'safe_scenarios' for back-compat —
-- renaming would touch RLS policies, indexes, and 5+ code paths.
-- Table comment updated to reflect its broader scope.
-- ═══════════════════════════════════════════════════════════════

-- 1. Drop the old constraint (Postgres auto-named it on the original CREATE TABLE).
--    Find and drop by introspecting; the constraint name was generated.

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'safe_scenarios'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) LIKE '%instrument%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.safe_scenarios DROP CONSTRAINT %I', constraint_name);
    RAISE NOTICE 'Dropped old instrument constraint: %', constraint_name;
  ELSE
    RAISE NOTICE 'No existing instrument CHECK constraint found — skipping drop';
  END IF;
END $$;

-- 2. Add the new, broader constraint.
ALTER TABLE public.safe_scenarios
  ADD CONSTRAINT safe_scenarios_instrument_check
  CHECK (instrument IN ('safe_post', 'safe_pre', 'note', 'equity', 'debt'));

-- 3. Update the table comment to reflect that it now holds Equity + Debt + SAFE scenarios.
COMMENT ON TABLE public.safe_scenarios IS
  'Saved calculator scenarios — covers Equity rounds, Debt amortization, and SAFE/Note conversions (chunk 12.7.5).';

-- Sanity check: verify the constraint accepts all 5 values
DO $$
BEGIN
  PERFORM 1 WHERE 'equity' IN ('safe_post', 'safe_pre', 'note', 'equity', 'debt');
  PERFORM 1 WHERE 'debt'   IN ('safe_post', 'safe_pre', 'note', 'equity', 'debt');
  RAISE NOTICE '✓ Migration complete — safe_scenarios.instrument now accepts: safe_post, safe_pre, note, equity, debt';
END $$;
