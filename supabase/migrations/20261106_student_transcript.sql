-- Adım 4.1: Lise transkripti (10–12) ve WES/4.0 GPA özeti (JSONB)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS academic_transcript jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.profiles.academic_transcript IS
  '10–12. sınıf yıl sonu ortalamaları, ders satırları ve kümülatif GPA/WES özeti (AcademicTranscriptData).';
