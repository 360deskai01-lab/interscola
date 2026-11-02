-- Kariyer pusulası (Hızlı Kombo + derin testler)
CREATE TABLE IF NOT EXISTS public.career_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_session_id text,
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  assessment_kind text NOT NULL
    CHECK (
      assessment_kind IN (
        'quick_combo',
        'deep_riasec',
        'deep_big_five',
        'deep_cognitive'
      )
    ),
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  score_matrix jsonb NOT NULL DEFAULT '{}'::jsonb,
  holland_code text,
  ai_report text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT career_assessments_actor_check CHECK (
    guest_session_id IS NOT NULL OR user_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS career_assessments_guest_idx
  ON public.career_assessments (guest_session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS career_assessments_user_idx
  ON public.career_assessments (user_id, created_at DESC);
