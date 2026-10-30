-- Enables pg_trgm (a trusted Postgres contrib extension, available on Neon,
-- RDS and Supabase without elevated privileges) and a trigram GIN index on
-- test_case.name, so Aeris's case-titles context can be ranked by similarity
-- to the user's message instead of only "most recently updated" once a
-- project has more active cases than CONTEXT_CASE_LIMIT.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "test_case_name_trgm_idx" ON "test_case" USING gin (name gin_trgm_ops);
