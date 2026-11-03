-- assessment_type: repo snake_case + canlı uppercase alias

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'career_assessments'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%assessment%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.career_assessments DROP CONSTRAINT IF EXISTS %I',
      constraint_name
    );
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'career_assessments'
      AND column_name = 'assessment_type'
  ) THEN
    ALTER TABLE public.career_assessments
      ADD CONSTRAINT career_assessments_assessment_type_check CHECK (
        assessment_type IN (
          'quick_combo',
          'deep_riasec',
          'deep_big_five',
          'deep_cognitive',
          'QUICK_COMBO',
          'RIASEC',
          'BIG_FIVE',
          'COGNITIVE'
        )
      );
  END IF;
END $$;
