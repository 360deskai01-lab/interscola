-- FAZ B: Öğrenci hub — hedef ilgi alanları, akademik pasaport alanları, veli/gözlemci ve herkese açık portfolyo.

-- Hedef meslek / disiplin etiketleri (UI tag çipleri)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS target_interest_tags text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.profiles.target_interest_tags IS
  'Öğrencinin hedef meslek ve disiplin etiketleri (ör. Yapay Zeka, Finans).';

-- Akademik pasaport formu (ad/soyad ayrı; isteğe bağlı sosyal ve okul bilgisi)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS high_school_name text,
  ADD COLUMN IF NOT EXISTS graduation_year smallint,
  ADD COLUMN IF NOT EXISTS linkedin_url text,
  ADD COLUMN IF NOT EXISTS external_portfolio_url text,
  ADD COLUMN IF NOT EXISTS instagram_handle text,
  ADD COLUMN IF NOT EXISTS alumni_network_opt_in boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.first_name IS 'Akademik profilde görünen ad (full_name ile uyumlu tutulabilir).';
COMMENT ON COLUMN public.profiles.last_name IS 'Akademik profilde görünen soyad.';
COMMENT ON COLUMN public.profiles.high_school_name IS 'Öğrencinin lisesi.';
COMMENT ON COLUMN public.profiles.graduation_year IS 'Mezuniyet yılı (ör. 2026).';
COMMENT ON COLUMN public.profiles.linkedin_url IS 'LinkedIn profil URL (isteğe bağlı).';
COMMENT ON COLUMN public.profiles.external_portfolio_url IS 'Harici portfolyo / kişisel site (isteğe bağlı).';
COMMENT ON COLUMN public.profiles.instagram_handle IS 'Instagram kullanıcı adı veya @ ile tam URL (isteğe bağlı).';
COMMENT ON COLUMN public.profiles.alumni_network_opt_in IS 'Üniversite yerleşiminde Interscola Mezunlar Ağı''na katılım onayı.';

-- Veli/gözlemci güvenli bağlantı (token ile /observe/[token])
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS observer_link_token uuid NOT NULL DEFAULT gen_random_uuid();

COMMENT ON COLUMN public.profiles.observer_link_token IS 'Veli/gözlemci salt okunur takip sayfası için benzersiz token.';

CREATE UNIQUE INDEX IF NOT EXISTS profiles_observer_link_token_key
  ON public.profiles (observer_link_token);

-- Herkese açık dijital portfolyo kısa yolu (/portfolio/public/[slug])
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS public_portfolio_slug text;

COMMENT ON COLUMN public.profiles.public_portfolio_slug IS 'Herkese açık aktivite portfolyosu için kısa slug (benzersiz).';

CREATE UNIQUE INDEX IF NOT EXISTS profiles_public_portfolio_slug_key
  ON public.profiles (public_portfolio_slug)
  WHERE public_portfolio_slug IS NOT NULL;
