-- Canlı şema ile hizalama (assessment_type, scores, top_traits, ai_interpretation)

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'career_assessments'
      AND column_name = 'assessment_kind'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'career_assessments'
      AND column_name = 'assessment_type'
  ) THEN
    ALTER TABLE public.career_assessments
      RENAME COLUMN assessment_kind TO assessment_type;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'career_assessments'
      AND column_name = 'score_matrix'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'career_assessments'
      AND column_name = 'scores'
  ) THEN
    ALTER TABLE public.career_assessments
      RENAME COLUMN score_matrix TO scores;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'career_assessments'
      AND column_name = 'ai_report'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'career_assessments'
      AND column_name = 'ai_interpretation'
  ) THEN
    ALTER TABLE public.career_assessments
      RENAME COLUMN ai_report TO ai_interpretation;
  END IF;
END $$;

ALTER TABLE public.career_assessments
  ADD COLUMN IF NOT EXISTS top_traits text[] DEFAULT '{}';

COMMENT ON COLUMN public.career_assessments.assessment_type IS 'quick_combo | deep_riasec | deep_big_five | deep_cognitive';
COMMENT ON COLUMN public.career_assessments.scores IS 'AssessmentScoreMatrix jsonb';
COMMENT ON COLUMN public.career_assessments.top_traits IS 'Öne çıkan güçlü yön etiketleri';
COMMENT ON COLUMN public.career_assessments.ai_interpretation IS 'Opsiyonel AI yorum metni';
