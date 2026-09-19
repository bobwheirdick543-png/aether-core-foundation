-- Remove the retired Battleversia production surface while preserving historical migration files.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name,
           p.proname AS function_name,
           pg_get_function_identity_arguments(p.oid) AS identity_args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND (p.proname LIKE 'bv_%' OR p.proname LIKE 'battleversia_%')
  LOOP
    EXECUTE format(
      'DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE',
      r.schema_name,
      r.function_name,
      r.identity_args
    );
  END LOOP;
END $$;

DROP TABLE IF EXISTS public.bv_events CASCADE;
DROP TABLE IF EXISTS public.bv_bids CASCADE;
DROP TABLE IF EXISTS public.bv_auction_players CASCADE;
DROP TABLE IF EXISTS public.bv_auctions CASCADE;
DROP TABLE IF EXISTS public.bv_match_players CASCADE;
DROP TABLE IF EXISTS public.bv_matches CASCADE;
DROP TABLE IF EXISTS public.bv_tournament_players CASCADE;
DROP TABLE IF EXISTS public.bv_tournaments CASCADE;
DROP TABLE IF EXISTS public.bv_character_ownership CASCADE;
DROP TABLE IF EXISTS public.bv_characters CASCADE;
DROP TABLE IF EXISTS public.bv_wallets CASCADE;
DROP TABLE IF EXISTS public.bv_servers CASCADE;
