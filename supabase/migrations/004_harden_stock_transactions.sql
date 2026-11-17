BEGIN;

-- Nullable untuk mempertahankan transaksi lama.
ALTER TABLE public.stock_transactions
  ADD COLUMN IF NOT EXISTS idempotency_key uuid;

CREATE UNIQUE INDEX IF NOT EXISTS
  idx_stock_transactions_idempotency_key
ON public.stock_transactions (idempotency_key);

-- RESTRICT mencegah penghapusan jika masih ada dependency database.
DROP FUNCTION IF EXISTS public.create_stock_transaction(
  uuid, character varying, numeric, text
) RESTRICT;

CREATE OR REPLACE FUNCTION public.create_stock_transaction(
  p_item_id uuid,
  p_transaction_type character varying,
  p_quantity numeric,
  p_notes text DEFAULT NULL,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_item public.items%ROWTYPE;
  v_existing public.stock_transactions%ROWTYPE;
  v_current_stock numeric;
  v_transaction_id uuid;
  v_notes text;
BEGIN
  IF p_item_id IS NULL THEN
    RAISE EXCEPTION 'ITEM_NOT_FOUND';
  END IF;

  IF p_transaction_type IS NULL
     OR p_transaction_type NOT IN (
       'stock_in', 'stock_out', 'usage', 'waste'
     )
  THEN
    RAISE EXCEPTION 'INVALID_TRANSACTION_TYPE';
  END IF;

  IF p_quantity IS NULL
     OR p_quantity::text IN ('NaN', 'Infinity', '-Infinity')
     OR p_quantity <= 0
     OR p_quantity > 1000000000
  THEN
    RAISE EXCEPTION 'INVALID_QUANTITY';
  END IF;

  -- Tolak pembulatan diam-diam saat masuk NUMERIC(12,2).
  IF p_quantity <> pg_catalog.round(p_quantity, 2) THEN
    RAISE EXCEPTION 'INVALID_QUANTITY_PRECISION';
  END IF;

  IF p_notes IS NOT NULL AND length(p_notes) > 500 THEN
    RAISE EXCEPTION 'INVALID_NOTES';
  END IF;

  IF p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'INVALID_IDEMPOTENCY_KEY';
  END IF;

  v_notes := NULLIF(btrim(p_notes), '');

  -- Request dengan key yang sama diproses bergantian.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_idempotency_key::text, 0)
  );

  SELECT *
  INTO v_existing
  FROM public.stock_transactions
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    IF v_existing.item_id IS DISTINCT FROM p_item_id
       OR v_existing.transaction_type
          IS DISTINCT FROM p_transaction_type
       OR v_existing.quantity IS DISTINCT FROM p_quantity
       OR v_existing.notes IS DISTINCT FROM v_notes
    THEN
      RAISE EXCEPTION 'IDEMPOTENCY_KEY_CONFLICT';
    END IF;

    RETURN v_existing.id;
  END IF;

  -- Semua pencatatan stok item ini harus melalui jalur terkunci ini.
  SELECT *
  INTO v_item
  FROM public.items
  WHERE id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ITEM_NOT_FOUND';
  END IF;

  IF v_item.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'ITEM_ARCHIVED';
  END IF;

  SELECT
    v_item.initial_stock
    + COALESCE(
        SUM(
          CASE
            WHEN transaction_type = 'stock_in' THEN quantity
            ELSE -quantity
          END
        ),
        0
      )
  INTO v_current_stock
  FROM public.stock_transactions
  WHERE item_id = p_item_id;

  IF p_transaction_type IN ('stock_out', 'usage', 'waste')
     AND v_current_stock < p_quantity
  THEN
    RAISE EXCEPTION 'INSUFFICIENT_STOCK';
  END IF;

  INSERT INTO public.stock_transactions (
    item_id,
    transaction_type,
    quantity,
    notes,
    idempotency_key
  )
  VALUES (
    p_item_id,
    p_transaction_type,
    p_quantity,
    v_notes,
    p_idempotency_key
  )
  RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_stock_transaction(
  uuid, character varying, numeric, text, uuid
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_stock_transaction(
  uuid, character varying, numeric, text, uuid
) TO service_role;

COMMIT;