CREATE TABLE IF NOT EXISTS public.stock_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    item_id UUID NOT NULL
        REFERENCES public.items(id)
        ON DELETE RESTRICT,

    transaction_type VARCHAR(20) NOT NULL
        CHECK (
            transaction_type IN (
                'stock_in',
                'stock_out',
                'usage',
                'waste'
            )
        ),

    quantity NUMERIC(12, 2) NOT NULL
        CHECK (quantity > 0),

    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_transactions_item_id
ON public.stock_transactions(item_id);

CREATE INDEX IF NOT EXISTS idx_stock_transactions_created_at
ON public.stock_transactions(created_at);

ALTER TABLE public.stock_transactions
ENABLE ROW LEVEL SECURITY;