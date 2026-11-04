export type StakeholderSection = {
  id: string;
  kicker: string;
  title: string;
  subtitle: string;
  bullets: string[];
  mockupLabel: string;
};

export const STAKEHOLDER_SECTIONS: StakeholderSection[] = [
  {
    id: 'ogrenci',
    kicker: 'Bölüm 1',
    title: 'Öğrenci',
    subtitle: 'Kişisel öğrenme ve ölçülebilir ilerleme',
    bullets: [
      'Adaptif pratik ve teşhis köprüsü',
      'Anlık karne ve konu kırılımı',
      'Kişisel zayıflık haritası ve hedef baraj takibi',
      'Kariyer pusulası ve üniversite eşleşmesi',
    ],
    mockupLabel: 'Öğrenci panel mockup',
  },
  {
    id: 'ogretmen',
    kicker: 'Bölüm 2',
    title: 'Öğretmen',
    subtitle: 'Sınıf yönetimi ve pedagojik denetim',
    bullets: [
      'Ödev ve materyal atama',
      'Kütüphane oluşturma ve sınav üretimi',
      'Cambridge rubrik denetimi ve geri bildirim',
      'Öğrenci kariyer ve yetkinlik özeti',
    ],
    mockupLabel: 'Öğretmen panel mockup',
  },
  {
    id: 'kurum',
    kicker: 'Bölüm 3',
    title: 'Kurum',
    subtitle: 'Okul ve şube ölçeğinde yönetim',
    bullets: [
      'Okul ve şube yönetimi',
      'Lisanslama ve üye davet akışları',
      'Toplu başarı radarı ve denetim',
      'Kurumsal raporlama (yol haritası)',
    ],
    mockupLabel: 'Kurum yönetim mockup',
  },
  {
    id: 'universite',
    kicker: 'Bölüm 4',
    title: 'Üniversite',
    subtitle: 'Kabul şartları ve profil uyumu',
    bullets: [
      'Kabul şartları eşleşmesi',
      'Min SAT / IELTS / A-Level baremleri',
      'Yayınlanmış üniversite rehberi entegrasyonu',
      'Öğrenci hedef pinleme senaryoları',
    ],
    mockupLabel: 'Üniversite keşif mockup',
  },
  {
    id: 'burs',
    kicker: 'Bölüm 5',
    title: 'Burs / Destek',
    subtitle: 'Fonlama ve profil uygunluğu',
    bullets: [
      'Yurt dışı fonlama kriterleri özeti',
      'Başarı eşikleri ve profil uygunluğu',
      'Burs & destek modülü (genişletme fazı)',
      'Veli ve danışman paylaşım raporları',
    ],
    mockupLabel: 'Burs & destek mockup',
  },
];
