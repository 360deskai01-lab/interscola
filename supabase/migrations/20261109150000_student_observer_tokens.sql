-- FAZ 13.1: Veli / gözlemci salt-okunur takip bağlantıları (90 gün TTL, çoklu token).

CREATE TABLE IF NOT EXISTS public.student_observer_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  token text NOT NULL,
  label text,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz NOT NULL,
  last_accessed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_observer_tokens_token_format CHECK (token ~ '^[a-f0-9]{32}$')
);

COMMENT ON TABLE public.student_observer_tokens IS
  'Öğrencinin veli/gözlemci için ürettiği salt-okunur bağlantı tokenları.';

CREATE UNIQUE INDEX IF NOT EXISTS student_observer_tokens_token_key
  ON public.student_observer_tokens (token);

CREATE INDEX IF NOT EXISTS student_observer_tokens_student_id_idx
  ON public.student_observer_tokens (student_id, created_at DESC);

ALTER TABLE public.student_observer_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS student_observer_tokens_select_own ON public.student_observer_tokens;
CREATE POLICY student_observer_tokens_select_own
  ON public.student_observer_tokens
  FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

DROP POLICY IF EXISTS student_observer_tokens_insert_own ON public.student_observer_tokens;
CREATE POLICY student_observer_tokens_insert_own
  ON public.student_observer_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS student_observer_tokens_update_own ON public.student_observer_tokens;
CREATE POLICY student_observer_tokens_update_own
  ON public.student_observer_tokens
  FOR UPDATE
  TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());
