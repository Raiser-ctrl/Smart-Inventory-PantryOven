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

    (
        i.initial_stock +
        COALESCE(
            SUM(
                CASE
                    WHEN st.transaction_type = 'stock_in'
                        THEN st.quantity
                    WHEN st.transaction_type IN (
                        'stock_out',
                        'usage',
                        'waste'
                    )
                        THEN -st.quantity
                    ELSE 0
                END
            ),
            0
        )
    ) AS current_stock

FROM public.items i

LEFT JOIN public.stock_transactions st
    ON st.item_id = i.id

GROUP BY
    i.id,
    i.name,
    i.category,
    i.unit,
    i.initial_stock,
    i.minimum_stock;