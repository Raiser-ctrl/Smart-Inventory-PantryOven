
BEGIN;

-- =====================================================
-- 1. CREATE INVENTORY ITEM
-- SECURITY INVOKER: hanya service_role
-- =====================================================

CREATE OR REPLACE FUNCTION public.create_inventory_item(
    p_name text,
    p_category text,
    p_unit text,
    p_initial_stock numeric,
    p_minimum_stock numeric,
    p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $function$
DECLARE
    v_name text;
    v_payload jsonb;
    v_saved public.item_creation_requests%ROWTYPE;
    v_item public.items%ROWTYPE;
    v_response jsonb;
    v_claimed integer;
BEGIN
    v_name := pg_catalog.btrim(p_name);

    IF p_idempotency_key IS NULL THEN
        RAISE EXCEPTION 'INVALID_IDEMPOTENCY_KEY';
    END IF;

    IF v_name IS NULL
       OR pg_catalog.length(v_name) < 1
       OR pg_catalog.length(v_name) > 150
       OR p_category IS NULL
       OR p_category NOT IN ('raw_material', 'finished_product')
       OR p_unit IS NULL
       OR p_unit NOT IN ('kg', 'pcs', 'liter', 'gram')
       OR p_initial_stock IS NULL
       OR p_initial_stock < 0
       OR p_initial_stock > 1000000000
       OR p_minimum_stock IS NULL
       OR p_minimum_stock < 0
       OR p_minimum_stock > 1000000000
    THEN
        RAISE EXCEPTION 'INVALID_ITEM_INPUT';
    END IF;

    v_payload := pg_catalog.jsonb_build_object(
        'name', v_name,
        'category', p_category,
        'unit', p_unit,
        'initial_stock', p_initial_stock,
        'minimum_stock', p_minimum_stock
    );

    INSERT INTO public.item_creation_requests (
        idempotency_key,
        request_payload
    )
    VALUES (
        p_idempotency_key,
        v_payload
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    GET DIAGNOSTICS v_claimed = ROW_COUNT;

    IF v_claimed = 0 THEN
        SELECT *
        INTO v_saved
        FROM public.item_creation_requests
        WHERE idempotency_key = p_idempotency_key;

        IF NOT FOUND OR v_saved.response_payload IS NULL THEN
            RAISE EXCEPTION 'IDEMPOTENCY_RETRY_REQUIRED';
        END IF;

        IF v_saved.request_payload IS DISTINCT FROM v_payload THEN
            RAISE EXCEPTION 'IDEMPOTENCY_KEY_CONFLICT';
        END IF;

        RETURN pg_catalog.jsonb_build_object(
            'item', v_saved.response_payload,
            'replayed', true
        );
    END IF;

    INSERT INTO public.items (
        name,
        category,
        unit,
        initial_stock,
        minimum_stock
    )
    VALUES (
        v_name,
        p_category,
        p_unit,
        p_initial_stock,
        p_minimum_stock
    )
    RETURNING * INTO v_item;

    v_response := pg_catalog.jsonb_build_object(
        'id', v_item.id,
        'name', v_item.name,
        'category', v_item.category,
        'unit', v_item.unit,
        'initial_stock', v_item.initial_stock,
        'minimum_stock', v_item.minimum_stock
    );

    UPDATE public.item_creation_requests
    SET response_payload = v_response
    WHERE idempotency_key = p_idempotency_key;

    RETURN pg_catalog.jsonb_build_object(
        'item', v_response,
        'replayed', false
    );
END;
$function$;


-- =====================================================
-- 2. UPDATE INVENTORY ITEM
-- SECURITY INVOKER: hanya service_role
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_inventory_item(
    p_item_id uuid,
    p_name text,
    p_category text,
    p_unit text,
    p_minimum_stock numeric
)
RETURNS public.items
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $function$
DECLARE
    v_item public.items%ROWTYPE;
BEGIN
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

    IF p_name IS NULL
       OR pg_catalog.length(pg_catalog.btrim(p_name)) = 0
       OR pg_catalog.length(pg_catalog.btrim(p_name)) > 150
       OR p_category IS NULL
       OR p_category NOT IN ('raw_material', 'finished_product')
       OR p_unit IS NULL
       OR p_unit NOT IN ('kg', 'pcs', 'liter', 'gram')
       OR p_minimum_stock IS NULL
       OR p_minimum_stock < 0
       OR p_minimum_stock > 1000000000
    THEN
        RAISE EXCEPTION 'INVALID_ITEM_INPUT';
    END IF;

    IF p_unit IS DISTINCT FROM v_item.unit
       AND EXISTS (
           SELECT 1
           FROM public.stock_transactions
           WHERE item_id = p_item_id
       )
    THEN
        RAISE EXCEPTION 'UNIT_CHANGE_HAS_TRANSACTIONS';
    END IF;

    UPDATE public.items
    SET
        name = pg_catalog.btrim(p_name),
        category = p_category,
        unit = p_unit,
        minimum_stock = p_minimum_stock,
        updated_at = pg_catalog.now()
    WHERE id = p_item_id
    RETURNING * INTO v_item;

    RETURN v_item;
END;
$function$;


-- =====================================================
-- 3. ARCHIVE INVENTORY ITEM
-- SECURITY INVOKER: hanya service_role
-- =====================================================

CREATE OR REPLACE FUNCTION public.archive_inventory_item(
    p_item_id uuid
)
RETURNS public.items
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $function$
DECLARE
    v_item public.items%ROWTYPE;
BEGIN
    SELECT *
    INTO v_item
    FROM public.items
    WHERE id = p_item_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ITEM_NOT_FOUND';
    END IF;

    IF v_item.archived_at IS NOT NULL THEN
        RAISE EXCEPTION 'ITEM_ALREADY_ARCHIVED';
    END IF;

    UPDATE public.items
    SET
        archived_at = pg_catalog.now(),
        updated_at = pg_catalog.now()
    WHERE id = p_item_id
    RETURNING * INTO v_item;

    RETURN v_item;
END;
$function$;


-- =====================================================
-- 4. RESTORE INVENTORY ITEM
-- SECURITY INVOKER: hanya service_role
-- =====================================================

CREATE OR REPLACE FUNCTION public.restore_inventory_item(
    p_item_id uuid
)
RETURNS public.items
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $function$
DECLARE
    v_item public.items%ROWTYPE;
BEGIN
    SELECT *
    INTO v_item
    FROM public.items
    WHERE id = p_item_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ITEM_NOT_FOUND';
    END IF;

    IF v_item.archived_at IS NULL THEN
        RAISE EXCEPTION 'ITEM_ALREADY_ACTIVE';
    END IF;

    UPDATE public.items
    SET
        archived_at = NULL,
        updated_at = pg_catalog.now()
    WHERE id = p_item_id
    RETURNING * INTO v_item;

    RETURN v_item;
END;
$function$;

-- =====================================================
-- 5. CHANGE USER ROLE
-- SECURITY DEFINER: hanya authenticated
-- Pemeriksaan admin dilakukan di dalam fungsi.
-- =====================================================

CREATE OR REPLACE FUNCTION public.change_user_role(
    p_target_id uuid,
    p_new_role text
)
RETURNS TABLE (
    id uuid,
    full_name text,
    role text,
    status text,
    updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_actor_id uuid;
    v_actor_name text;
    v_target public.profiles%ROWTYPE;
    v_active_admin_count integer;
BEGIN
    v_actor_id := (SELECT auth.uid());

    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED';
    END IF;

    IF p_new_role IS NULL
       OR p_new_role NOT IN ('admin', 'staff')
    THEN
        RAISE EXCEPTION 'INVALID_ROLE';
    END IF;

    IF p_target_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_TARGET';
    END IF;

    IF v_actor_id = p_target_id THEN
        RAISE EXCEPTION 'SELF_ROLE_CHANGE_FORBIDDEN';
    END IF;

    PERFORM pg_catalog.pg_advisory_xact_lock(724103, 202611);

    SELECT p.full_name
    INTO v_actor_name
    FROM public.profiles AS p
    WHERE p.id = v_actor_id
      AND p.role = 'admin'
      AND p.status = 'active';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ADMIN_REQUIRED';
    END IF;

    SELECT p.*
    INTO v_target
    FROM public.profiles AS p
    WHERE p.id = p_target_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'USER_NOT_FOUND';
    END IF;

    IF v_target.role NOT IN ('admin', 'staff')
       OR v_target.status NOT IN ('pending', 'active', 'suspended')
    THEN
        RAISE EXCEPTION 'INVALID_PROFILE_STATE';
    END IF;

    IF p_new_role = 'admin'
       AND v_target.status <> 'active'
    THEN
        RAISE EXCEPTION 'TARGET_MUST_BE_ACTIVE';
    END IF;

    IF v_target.role = p_new_role THEN
        RETURN QUERY
        SELECT
            p.id,
            p.full_name::text,
            p.role::text,
            p.status::text,
            p.updated_at
        FROM public.profiles AS p
        WHERE p.id = p_target_id;

        RETURN;
    END IF;

    IF v_target.role = 'admin'
       AND v_target.status = 'active'
       AND p_new_role = 'staff'
    THEN
        SELECT count(*)::integer
        INTO v_active_admin_count
        FROM public.profiles AS p
        WHERE p.role = 'admin'
          AND p.status = 'active';

        IF v_active_admin_count <= 1 THEN
            RAISE EXCEPTION 'LAST_ACTIVE_ADMIN';
        END IF;
    END IF;

    UPDATE public.profiles AS p
    SET
        role = p_new_role,
        updated_at = pg_catalog.now()
    WHERE p.id = p_target_id;

    INSERT INTO public.user_role_audit_logs (
        actor_id,
        target_id,
        old_role,
        new_role,
        actor_name_snapshot,
        target_name_snapshot
    )
    VALUES (
        v_actor_id,
        p_target_id,
        v_target.role,
        p_new_role,
        v_actor_name,
        v_target.full_name
    );

    RETURN QUERY
    SELECT
        p.id,
        p.full_name::text,
        p.role::text,
        p.status::text,
        p.updated_at
    FROM public.profiles AS p
    WHERE p.id = p_target_id;
END;
$function$;


-- =====================================================
-- FUNCTION PRIVILEGES
-- =====================================================

REVOKE ALL ON FUNCTION public.create_inventory_item(
    text, text, text, numeric, numeric, uuid
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_inventory_item(
    text, text, text, numeric, numeric, uuid
) TO service_role;


REVOKE ALL ON FUNCTION public.update_inventory_item(
    uuid, text, text, text, numeric
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.update_inventory_item(
    uuid, text, text, text, numeric
) TO service_role;


REVOKE ALL ON FUNCTION public.archive_inventory_item(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.archive_inventory_item(uuid)
TO service_role;


REVOKE ALL ON FUNCTION public.restore_inventory_item(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.restore_inventory_item(uuid)
TO service_role;


REVOKE ALL ON FUNCTION public.change_user_role(uuid, text)
FROM PUBLIC, anon, service_role;

GRANT EXECUTE ON FUNCTION public.change_user_role(uuid, text)
TO authenticated;

COMMIT;
