
BEGIN;

-- Membuat profil otomatis saat user mendaftar.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.profiles (
    id,
    full_name,
    role,
    status
  )
  VALUES (
    NEW.id,
    LEFT(
      COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
      100
    ),
    'staff',
    'pending'
  );

  RETURN NEW;
END;
$function$;

-- Memperbarui timestamp profil.
CREATE OR REPLACE FUNCTION public.touch_profile_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Pemeriksaan admin aktif.
CREATE OR REPLACE FUNCTION public.is_active_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND role = 'admin'
      AND status = 'active'
  );
$function$;

-- Hak eksekusi helper admin.
REVOKE ALL ON FUNCTION public.is_active_admin()
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_active_admin()
TO authenticated;

-- Trigger pembuatan profil setelah registrasi.
DROP TRIGGER IF EXISTS on_auth_user_created
ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- Trigger updated_at pada profil.
DROP TRIGGER IF EXISTS on_profile_updated
ON public.profiles;

CREATE TRIGGER on_profile_updated
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.touch_profile_updated_at();

COMMIT;
