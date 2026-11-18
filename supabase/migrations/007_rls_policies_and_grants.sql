
BEGIN;

-- Pastikan RLS aktif pada seluruh tabel aplikasi.
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_creation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_role_audit_logs ENABLE ROW LEVEL SECURITY;

-- Hapus policy lama jika migration dijalankan ulang.
DROP POLICY IF EXISTS "Users can read own profile"
ON public.profiles;

DROP POLICY IF EXISTS "Admins can read profiles"
ON public.profiles;

-- User hanya dapat membaca profil miliknya.
CREATE POLICY "Users can read own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  (SELECT auth.uid()) = id
);

-- Admin aktif dapat membaca seluruh profil.
CREATE POLICY "Admins can read profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  (SELECT public.is_active_admin())
);

-- Batasi akses langsung dari client.
REVOKE ALL ON TABLE
  public.items,
  public.stock_transactions,
  public.profiles,
  public.item_creation_requests,
  public.user_role_audit_logs
FROM PUBLIC, anon, authenticated;

-- Client hanya boleh membaca profil melalui policy.
GRANT SELECT ON TABLE public.profiles
TO authenticated;

COMMIT;
