-- Bozuk / SQL ile eklenmiş test auth kayıtlarını temizler.
-- Supabase Dashboard → SQL Editor'de bir kez çalıştırın, ardından:
--   npx tsx scripts/seed-test-accounts.ts

DELETE FROM auth.identities
WHERE user_id IN (
  SELECT id FROM auth.users
  WHERE lower(email) IN (
    lower('test.ogrenci@interscola.test'),
    lower('test.ogretmen@interscola.test'),
    lower('test.veli@interscola.test'),
    lower('test.kurum.merkez@interscola.test'),
    lower('test.kurum.sube@interscola.test')
  )
);

DELETE FROM auth.users
WHERE lower(email) IN (
  lower('test.ogrenci@interscola.test'),
  lower('test.ogretmen@interscola.test'),
  lower('test.veli@interscola.test'),
  lower('test.kurum.merkez@interscola.test'),
  lower('test.kurum.sube@interscola.test')
);
