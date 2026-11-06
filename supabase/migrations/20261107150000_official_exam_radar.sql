-- FAZ E.2: Resmi sınav takvimi ve yetkili sınav merkezleri (Sınav Radarı).
-- Okuma: kimliği doğrulanmış kullanıcılar (öğrenci/öğretmen panelleri).

CREATE TABLE IF NOT EXISTS public.official_exam_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_name text NOT NULL,
  exam_type text,
  exam_date date NOT NULL,
  registration_open_date date,
  registration_close_date date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS official_exam_schedules_exam_date_idx
  ON public.official_exam_schedules (exam_date);

COMMENT ON TABLE public.official_exam_schedules IS
  'Yaklaşan resmi sınav oturumları (SAT, IELTS vb.); sınav radarı ve geri sayım için.';

CREATE TABLE IF NOT EXISTS public.exam_test_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_schedule_id uuid NOT NULL REFERENCES public.official_exam_schedules (id) ON DELETE CASCADE,
  city text NOT NULL,
  center_name text NOT NULL,
  address text,
  capacity_status text NOT NULL DEFAULT 'available'
    CHECK (capacity_status IN ('available', 'limited')),
  is_authorized boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS exam_test_centers_schedule_city_idx
  ON public.exam_test_centers (exam_schedule_id, city);

COMMENT ON TABLE public.exam_test_centers IS
  'Resmi sınav için yetkili test merkezleri; şehir ve kontenjan rozeti ile.';

ALTER TABLE public.official_exam_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_test_centers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS official_exam_schedules_select_authenticated
  ON public.official_exam_schedules;
CREATE POLICY official_exam_schedules_select_authenticated
  ON public.official_exam_schedules
  FOR SELECT
  TO authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS exam_test_centers_select_authenticated
  ON public.exam_test_centers;
CREATE POLICY exam_test_centers_select_authenticated
  ON public.exam_test_centers
  FOR SELECT
  TO authenticated
  USING (
    is_authorized = true
    AND EXISTS (
      SELECT 1
      FROM public.official_exam_schedules s
      WHERE s.id = exam_schedule_id
        AND s.is_active = true
    )
  );
