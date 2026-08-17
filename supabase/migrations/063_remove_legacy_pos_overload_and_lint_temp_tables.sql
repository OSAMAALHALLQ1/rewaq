-- Remove the obsolete eight-argument checkout overload left behind when
-- discounts, fees, and split payments were added. The application calls the
-- current twelve-argument overload exclusively.
drop function if exists public.pos_checkout_atomic(
  uuid, uuid, uuid, text, text, text, text, jsonb
);

-- plpgsql_check cannot infer tables created at function runtime. Inject its
-- supported string-only table pragmas into the current functions. At runtime
-- these statements only evaluate a text constant and do not call an extension.
do $$
declare
  v_checkout regprocedure :=
    'public.pos_checkout_atomic(uuid,uuid,uuid,text,text,text,text,jsonb,numeric,numeric,numeric,jsonb)'::regprocedure;
  v_refund regprocedure :=
    'public.pos_refund_v2_atomic(uuid,uuid,uuid,text,date,text,uuid,uuid,jsonb)'::regprocedure;
  v_definition text;
  v_updated text;
begin
  v_definition := pg_get_functiondef(v_checkout);
  v_updated := regexp_replace(
    v_definition,
    E'([\\r\\n]+)[[:space:]]*BEGIN([\\r\\n]+)',
    E'\\1BEGIN\\2  PERFORM ''PRAGMA: table: [pg_temp].pos_checkout_impacts(item_id uuid, quantity numeric(14,4), unit_cost numeric(12,4), total_cost numeric(12,4), is_negative_stock boolean, is_provisional_cost boolean)'';\\2',
    'i'
  );

  if v_updated = v_definition then
    raise exception 'Could not inject the checkout temp-table lint pragma';
  end if;
  execute v_updated;

  v_definition := pg_get_functiondef(v_refund);
  v_updated := regexp_replace(
    v_definition,
    E'([\\r\\n]+)[[:space:]]*BEGIN([\\r\\n]+)',
    E'\\1BEGIN\\2  PERFORM ''PRAGMA: table: [pg_temp].pos_refund_requested(catalog_item_id uuid, quantity numeric(14,4))'';\\2',
    'i'
  );

  if v_updated = v_definition then
    raise exception 'Could not inject the refund temp-table lint pragma';
  end if;
  execute v_updated;
end;
$$;

-- Validation after deployment:
-- 1. `supabase db lint --linked --level warning` must not report missing
--    pg_temp.pos_checkout_impacts or pg_temp.pos_refund_requested relations.
-- 2. The only checkout signature returned below must be the twelve-argument
--    version used by the API:
-- select p.oid::regprocedure
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public' and p.proname = 'pos_checkout_atomic';

-- Forward correction: restore either function from its latest defining
-- migration if plpgsql_check gains native runtime-temp-table inference.
