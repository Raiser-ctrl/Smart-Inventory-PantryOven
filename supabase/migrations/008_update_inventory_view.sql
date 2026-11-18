
BEGIN;

CREATE OR REPLACE VIEW public.inventory_current_stock
WITH (security_invoker = true)
AS
SELECT
    i.id,
    i.name,
    i.category,
    i.unit,
    i.initial_stock,
    i.minimum_stock,

    -- Pertahankan posisi current_stock dari view lama.
    i.initial_stock
      + COALESCE(
          SUM(
              CASE
                  WHEN st.transaction_type = 'stock_in'
                      THEN st.quantity
                  WHEN st.transaction_type IN (
                      'stock_out', 'usage', 'waste'
                  )
                      THEN -st.quantity
                  ELSE 0
              END
          ),
          0
      ) AS current_stock,

    -- Kolom tambahan diletakkan setelah current_stock.
    i.created_at,
    i.updated_at,
    i.archived_at

FROM public.items i
LEFT JOIN public.stock_transactions st
    ON st.item_id = i.id

GROUP BY
    i.id,
    i.name,
    i.category,
    i.unit,
    i.initial_stock,
    i.minimum_stock,
    i.created_at,
    i.updated_at,
    i.archived_at;

GRANT SELECT ON public.inventory_current_stock TO service_role;

COMMIT;
