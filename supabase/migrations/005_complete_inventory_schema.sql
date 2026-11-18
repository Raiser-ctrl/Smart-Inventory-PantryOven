
BEGIN;

-- Tambahkan soft archive pada inventory.
ALTER TABLE public.items
ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_items_archived_at
ON public.items (archived_at);

-- Tabel profil pengguna.
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name text NOT NULL DEFAULT '',
    avatar_path text,
    role text NOT NULL DEFAULT 'staff'
        CHECK (role IN ('admin', 'staff')),
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'active', 'suspended')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Penyimpanan idempotency saat membuat item.
CREATE TABLE IF NOT EXISTS public.item_creation_requests (
    idempotency_key uuid PRIMARY KEY,
    request_payload jsonb NOT NULL,
    response_payload jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Audit perubahan role pengguna.
CREATE TABLE IF NOT EXISTS public.user_role_audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    target_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    old_role text NOT NULL,
    new_role text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    actor_name_snapshot text,
    target_name_snapshot text
);

CREATE INDEX IF NOT EXISTS idx_user_role_audit_logs_target
ON public.user_role_audit_logs (target_id);

CREATE INDEX IF NOT EXISTS idx_user_role_audit_logs_created
ON public.user_role_audit_logs (created_at);

-- Idempotency untuk transaksi stok.
ALTER TABLE public.stock_transactions
ADD COLUMN IF NOT EXISTS idempotency_key uuid;

CREATE UNIQUE INDEX IF NOT EXISTS
idx_stock_transactions_idempotency_key
ON public.stock_transactions (idempotency_key);

-- Aktifkan RLS secara eksplisit.
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_creation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_role_audit_logs ENABLE ROW LEVEL SECURITY;

COMMIT;
