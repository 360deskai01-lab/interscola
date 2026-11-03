-- Misafir kariyer envanterini giriş yapan kullanıcıya zimmetle

CREATE OR REPLACE FUNCTION public.claim_guest_career_assessment(
  p_guest_session_id text,
  p_user_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  IF p_guest_session_id IS NULL OR length(trim(p_guest_session_id)) = 0 THEN
    RETURN 0;
  END IF;
  IF p_user_id IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.career_assessments
  SET
    user_id = p_user_id,
    guest_session_id = NULL
  WHERE guest_session_id = trim(p_guest_session_id)
    AND user_id IS NULL;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

COMMENT ON FUNCTION public.claim_guest_career_assessment(text, uuid) IS
  'guest_session_id ile kayıtlı career_assessments satırlarını user_id ile birleştirir.';
