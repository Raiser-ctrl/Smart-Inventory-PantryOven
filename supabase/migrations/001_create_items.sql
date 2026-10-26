CREATE TABLE IF NOT EXISTS public.items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(150) NOT NULL,

    category VARCHAR(20) NOT NULL
        CHECK (category IN ('raw_material', 'finished_product')),

    unit VARCHAR(20) NOT NULL,

    initial_stock NUMERIC(12, 2) NOT NULL DEFAULT 0
        CHECK (initial_stock >= 0),

    minimum_stock NUMERIC(12, 2) NOT NULL DEFAULT 0
        CHECK (minimum_stock >= 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;