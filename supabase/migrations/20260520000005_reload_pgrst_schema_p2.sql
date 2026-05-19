-- Migration 20260520000005: Force PostgREST schema cache reload (Phase 2)
--
-- Same rationale as Phase 1 migration 0008: supabase db push applies GRANTs to
-- PostgreSQL but does NOT automatically notify PostgREST to refresh its in-memory
-- schema cache. Without this NOTIFY, PostgREST keeps serving the old cached schema
-- and returns "permission denied for table X" even after the GRANT migration runs.
-- This migration is idempotent — NOTIFY is fire-and-forget with no side effects.

NOTIFY pgrst, 'reload schema';
