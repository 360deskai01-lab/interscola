-- FAZ 8.1: Kaynak sayfası hash izleme ve istihbarat uyarıları

ALTER TABLE public.target_universities
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS source_content_hash text,
  ADD COLUMN IF NOT EXISTS last_checked_at timestamptz;

COMMENT ON COLUMN public.target_universities.source_url IS 'Resmi kabul şartları / admissions sayfası URL';
COMMENT ON COLUMN public.target_universities.source_content_hash IS 'source_url HTML gövdesinin SHA-256 özeti (normalize edilmiş)';
COMMENT ON COLUMN public.target_universities.last_checked_at IS 'Son otonom kaynak taraması zamanı';

CREATE TABLE IF NOT EXISTS public.intelligence_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL REFERENCES public.target_universities (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  source_url text NOT NULL,
  previous_content_hash text,
  new_content_hash text NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS intelligence_alerts_status_idx
  ON public.intelligence_alerts (status, detected_at DESC);

CREATE INDEX IF NOT EXISTS intelligence_alerts_university_idx
  ON public.intelligence_alerts (university_id, detected_at DESC);

CREATE INDEX IF NOT EXISTS target_universities_source_url_idx
  ON public.target_universities (source_url)
  WHERE source_url IS NOT NULL;
