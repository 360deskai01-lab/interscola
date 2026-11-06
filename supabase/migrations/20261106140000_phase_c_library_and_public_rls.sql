-- FAZ C: ikili kütüphane (exam_format / origin_type), foundation göstergesi ve
-- FAZ B herkese açık sayfaları için güvenli anonim okuma (RPC).

-- ---------------------------------------------------------------------------
-- 1) public.libraries
-- ---------------------------------------------------------------------------
ALTER TABLE public.libraries
  ADD COLUMN IF NOT EXISTS exam_format text NOT NULL DEFAULT 'drill'
    CHECK (exam_format IN ('drill', 'mini_mock', 'full_mock')),
  ADD COLUMN IF NOT EXISTS origin_type text NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.libraries.exam_format IS
  'drill (3–5 soru) | mini_mock (10–12 soru) | full_mock (resmi tam simülasyon).';
COMMENT ON COLUMN public.libraries.origin_type IS
  'system | teacher | user_uploaded — materyalin kaynağı.';
COMMENT ON COLUMN public.libraries.created_by IS
  'Materyali oluşturan kullanıcı (öğrenci stüdyosu için auth.uid()).';

-- Geriye dönük sınıflandırma (yalnızca hâlâ varsayılan değerde olan satırlar).
UPDATE public.libraries
SET exam_format = CASE
  WHEN jsonb_typeof(exam_payload -> 'questions') = 'array'
       AND jsonb_array_length(exam_payload -> 'questions') >= 20 THEN 'full_mock'
  WHEN jsonb_typeof(exam_payload -> 'questions') = 'array'
       AND jsonb_array_length(exam_payload -> 'questions') >= 8 THEN 'mini_mock'
  ELSE 'drill'
END
WHERE exam_format = 'drill'
  AND exam_payload IS NOT NULL;

UPDATE public.libraries
SET origin_type = 'teacher'
WHERE origin_type = 'system'
  AND teacher_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS libraries_public_format_idx
  ON public.libraries (exam_format, curriculum)
  WHERE is_public = true;

-- ---------------------------------------------------------------------------
-- 2) public.target_universities
-- ---------------------------------------------------------------------------
ALTER TABLE public.target_universities
  ADD COLUMN IF NOT EXISTS has_foundation_pathway boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.target_universities.has_foundation_pathway IS
  'Kurumda 1 yıllık Foundation / hazırlık programı seçeneği var mı?';

-- ---------------------------------------------------------------------------
-- 3) FAZ B açık sayfaları — RLS'i gevşetmeden güvenli anonim okuma
--
-- NEDEN RPC: RLS satır bazlıdır; `USING (public_portfolio_slug IS NOT NULL)` gibi
-- bir anon SELECT politikası, e-posta dahil TÜM sütunları ve tüm satırları
-- numaralandırmaya açar. Bunun yerine `profiles` tablosunda anon için doğrudan
-- erişim verilmez; yalnızca token/slug bilen istemci, SECURITY DEFINER fonksiyonla
-- sınırlı alanları (ad, lise, aktivite özeti) okuyabilir.
-- ---------------------------------------------------------------------------
REVOKE ALL ON TABLE public.profiles FROM anon;

CREATE OR REPLACE FUNCTION public.get_observer_snapshot(p_token uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'display_name',
      COALESCE(
        NULLIF(btrim(concat_ws(' ', p.first_name, p.last_name)), ''),
        NULLIF(btrim(p.full_name), ''),
        'Öğrenci'
      ),
    'high_school_name', p.high_school_name,
    'graduation_year', p.graduation_year,
    'activity_count',
      CASE
        WHEN jsonb_typeof(p.activity_passport -> 'items') = 'array'
          THEN jsonb_array_length(p.activity_passport -> 'items')
        ELSE 0
      END
  )
  FROM public.profiles p
  WHERE p.observer_link_token = p_token
    AND p.role = 'student'
    AND p.status = 'approved'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_public_portfolio(p_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'display_name',
      COALESCE(
        NULLIF(btrim(concat_ws(' ', p.first_name, p.last_name)), ''),
        NULLIF(btrim(p.full_name), ''),
        'Öğrenci'
      ),
    'high_school_name', p.high_school_name,
    'external_portfolio_url', p.external_portfolio_url,
    'items',
      COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', item ->> 'id',
              'title', item ->> 'title',
              'organization', item ->> 'organization',
              'category', item ->> 'category'
            )
          )
          FROM (
            SELECT item
            FROM jsonb_array_elements(
              CASE
                WHEN jsonb_typeof(p.activity_passport -> 'items') = 'array'
                  THEN p.activity_passport -> 'items'
                ELSE '[]'::jsonb
              END
            ) AS item
            LIMIT 24
          ) limited
        ),
        '[]'::jsonb
      )
  )
  FROM public.profiles p
  WHERE p.public_portfolio_slug = p_slug
    AND p.role = 'student'
    AND p.status = 'approved'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_observer_snapshot(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_portfolio(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_observer_snapshot(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_portfolio(text) TO anon, authenticated, service_role;
