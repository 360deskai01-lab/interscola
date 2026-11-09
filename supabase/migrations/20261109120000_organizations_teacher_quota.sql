-- FAZ 11.2: Kurumsal öğretmen lisans kotası (öğrenci kotasına simetrik).

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS teacher_quota integer;

COMMENT ON COLUMN public.organizations.teacher_quota IS
  'Aktif öğretmen üye üst sınırı; null ise uygulama student_quota/10 fallback kullanır.';
