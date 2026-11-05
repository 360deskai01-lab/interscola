-- Adım 5.1: Common App / UCAS tarzı aktivite pasaportu (JSONB)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS activity_passport jsonb NOT NULL DEFAULT '{"items":[]}'::jsonb;

COMMENT ON COLUMN public.profiles.activity_passport IS
  'Öğrenci extracurricular aktiviteleri (ActivityPassportData: items[], updatedAt).';
