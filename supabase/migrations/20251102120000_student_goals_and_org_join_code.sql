-- AŞAMA 2: Öğrenci hedef profili + B2B katılım kodu (public şema)
-- assessment_attempts / sınav motoru tablolarına dokunulmaz.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS target_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS target_university_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

COMMENT ON COLUMN public.profiles.target_scores IS 'Hedef sınav skorları (ör. SAT, IELTS) JSON.';
COMMENT ON COLUMN public.profiles.target_university_ids IS 'Hedef üniversite UUID listesi (target_universities.id).';

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS join_code text;

COMMENT ON COLUMN public.organizations.join_code IS '6 haneli öğrenci katılım kodu (B2B).';

CREATE UNIQUE INDEX IF NOT EXISTS organizations_join_code_unique
  ON public.organizations (join_code)
  WHERE join_code IS NOT NULL;
