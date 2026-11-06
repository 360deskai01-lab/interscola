-- FAZ E.1: program/bölüm bazlı kabul kriterleri (Uni4Edu derinliği)

CREATE TABLE IF NOT EXISTS public.university_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL REFERENCES public.target_universities (id) ON DELETE CASCADE,
  program_name text NOT NULL,
  degree_level text NOT NULL
    CHECK (degree_level IN ('bachelor', 'master', 'doctoral', 'other')),
  faculty text,
  min_sat_score integer,
  min_sat_math integer,
  min_sat_rw integer,
  min_ielts_score numeric(3,1),
  min_ielts_subscore numeric(3,1),
  min_gpa text,
  application_deadline date,
  english_waiver_policy text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS university_programs_university_id_idx
  ON public.university_programs (university_id);

CREATE INDEX IF NOT EXISTS university_programs_degree_level_idx
  ON public.university_programs (university_id, degree_level);

COMMENT ON TABLE public.university_programs IS
  'Üniversiteye bağlı program/bölüm satırları; kabul barajları ve başvuru takvimi (Uni4Edu).';

ALTER TABLE public.university_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY university_programs_select_published
  ON public.university_programs
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.target_universities tu
      WHERE tu.id = university_programs.university_id
        AND tu.status = 'published'
    )
  );
