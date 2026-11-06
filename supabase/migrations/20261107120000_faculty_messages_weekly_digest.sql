-- FAZ D.4: çapraz öğretmen mesaj bağlamı ve haftalık özet taslakları

-- ---------------------------------------------------------------------------
-- 1) Mesajlarda öğrenci bağlamı (öğretmen ↔ öğretmen konuşmaları)
-- ---------------------------------------------------------------------------
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS student_context_id uuid REFERENCES auth.users (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.messages.student_context_id IS
  'İki öğretmen aynı öğrenci hakkında konuşurken thread’i ayırmak için öğrenci kullanıcı kimliği.';

CREATE INDEX IF NOT EXISTS messages_student_context_pair_idx
  ON public.messages (student_context_id, sender_id, receiver_id)
  WHERE student_context_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2) Öğretmen uzmanlık alanı (faculty board listesi)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS teaching_expertise text;

COMMENT ON COLUMN public.profiles.teaching_expertise IS
  'Öğretmenin kısa akademik uzmanlık / branş özeti (faculty board).';

-- ---------------------------------------------------------------------------
-- 3) Haftalık gelişim taslağı
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.teacher_weekly_digests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published')),
  week_start date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS teacher_weekly_digests_teacher_student_week_idx
  ON public.teacher_weekly_digests (teacher_id, student_id, week_start DESC);

COMMENT ON TABLE public.teacher_weekly_digests IS
  'Öğretmen tarafından üretilen haftalık pedagojik özet; önce taslak, onayda yayınlanır.';

-- Aynı hafta için yalnızca bir taslak (yeniden üretimde eski taslağın üzerine yazılabilir).
CREATE UNIQUE INDEX IF NOT EXISTS teacher_weekly_digests_draft_week_unique
  ON public.teacher_weekly_digests (teacher_id, student_id, week_start)
  WHERE status = 'draft';
