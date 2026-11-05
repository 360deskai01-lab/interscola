-- Seed script: bozuk test auth kayıtlarını service role RPC ile temizleme.
CREATE OR REPLACE FUNCTION public.cleanup_test_auth_users_emails(emails text[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM auth.identities
  WHERE user_id IN (
    SELECT id FROM auth.users
    WHERE lower(email) = ANY (SELECT lower(unnest(emails)))
  );

  DELETE FROM auth.users
  WHERE lower(email) = ANY (SELECT lower(unnest(emails)));

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_test_auth_users_emails(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_test_auth_users_emails(text[]) TO service_role;
