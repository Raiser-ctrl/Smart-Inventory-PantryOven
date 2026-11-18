
BEGIN;

-- Inventory: tidak membutuhkan hard delete.
GRANT SELECT, INSERT, UPDATE
ON TABLE public.items
TO service_role;

GRANT SELECT, INSERT
ON TABLE public.stock_transactions
TO service_role;

-- Profil: penghapusan mengikuti siklus akun Auth.
GRANT SELECT, INSERT, UPDATE
ON TABLE public.profiles
TO service_role;

-- Idempotency saat membuat item.
GRANT SELECT, INSERT, UPDATE
ON TABLE public.item_creation_requests
TO service_role;

-- Audit log hanya ditulis melalui RPC khusus.
REVOKE ALL
ON TABLE public.user_role_audit_logs
FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
