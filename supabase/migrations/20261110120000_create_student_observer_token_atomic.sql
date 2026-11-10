-- FAZ 14.2: Veli observer token üretimi — TOCTOU önleyici atomik RPC.

CREATE OR REPLACE FUNCTION public.create_student_observer_token_atomic(
  p_student_id uuid,
  p_token text,
  p_label text DEFAULT 'Veli / Gözlemci',
  p_expires_in_days int DEFAULT 90
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_count int;
  v_expires_at timestamptz;
  v_label text;
  v_row public.student_observer_tokens%ROWTYPE;
  v_max_active constant int := 5;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_student_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'UNAUTHORIZED',
      'message', 'Bu işlem yalnızca oturum sahibi öğrenci için çalıştırılabilir.'
    );
  END IF;

  IF p_token IS NULL OR p_token !~ '^[a-f0-9]{32}$' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_TOKEN',
      'message', 'Token formatı geçersiz.'
    );
  END IF;

  IF p_expires_in_days IS NULL OR p_expires_in_days < 1 OR p_expires_in_days > 365 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_TTL',
      'message', 'Geçerlilik süresi geçersiz.'
    );
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_student_id::text));

  SELECT COUNT(*)::int
  INTO v_active_count
  FROM public.student_observer_tokens t
  WHERE t.student_id = p_student_id
    AND t.is_active = true
    AND t.expires_at > now();

  IF v_active_count >= v_max_active THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'MAKSIMUM_AKTIF_TOKEN_LIMITI_ASILDI',
      'message',
      'En fazla 5 aktif veli bağlantısı oluşturabilirsiniz. Lütfen eskilerden birini iptal edin.'
    );
  END IF;

  v_expires_at := now() + make_interval(days => p_expires_in_days);
  v_label := NULLIF(trim(p_label), '');
  IF v_label IS NOT NULL AND char_length(v_label) > 80 THEN
    v_label := left(v_label, 80);
  END IF;

  INSERT INTO public.student_observer_tokens (
    student_id,
    token,
    label,
    is_active,
    expires_at
  )
  VALUES (
    p_student_id,
    p_token,
    v_label,
    true,
    v_expires_at
  )
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'success', true,
    'row', jsonb_build_object(
      'id', v_row.id,
      'token', v_row.token,
      'label', v_row.label,
      'is_active', v_row.is_active,
      'expires_at', v_row.expires_at,
      'last_accessed_at', v_row.last_accessed_at,
      'created_at', v_row.created_at
    )
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'DUPLICATE_TOKEN',
      'message', 'Bu token zaten kayıtlı; lütfen yeniden deneyin.'
    );
END;
$$;

COMMENT ON FUNCTION public.create_student_observer_token_atomic IS
  'Öğrenci başına aktif veli token kotasını advisory lock ile atomik uygular ve kayıt ekler.';

REVOKE ALL ON FUNCTION public.create_student_observer_token_atomic(uuid, text, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_student_observer_token_atomic(uuid, text, text, int)
  TO authenticated, service_role;
