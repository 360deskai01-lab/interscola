-- FAZ 7.3: Admin üniversite vitrin ve yayın durumu
ALTER TABLE public.target_universities
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published';

COMMENT ON COLUMN public.target_universities.is_featured IS 'Anasayfa vitrin carousel''de göster';
COMMENT ON COLUMN public.target_universities.status IS 'published | draft';

CREATE INDEX IF NOT EXISTS target_universities_featured_idx
  ON public.target_universities (is_featured)
  WHERE is_featured = true;
