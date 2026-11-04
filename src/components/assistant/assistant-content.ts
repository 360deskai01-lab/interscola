import type { QuickChipId } from '@/components/assistant/types';
import { STUDENT_DIAGNOSTIC_EXPLORE_PATH } from '@/lib/safe-next-path';

export type QuickChip = {
  id: QuickChipId;
  label: string;
};

export const QUICK_CHIPS: QuickChip[] = [
  { id: 'diagnostic', label: '15 Dk Teşhis Testi Nedir?' },
  { id: 'exams', label: 'Digital SAT & IELTS Farkı' },
  { id: 'corporate', label: 'Kurum/Okul Lisansı Nasıl Alınır?' },
  { id: 'booking', label: '📅 Uzmanla Online Görüşme Planla' },
];

export type ChipReply = {
  userEcho: string;
  assistantText: string;
  link?: { href: string; label: string };
  startBooking?: boolean;
};

export function replyForChip(chipId: QuickChipId): ChipReply {
  switch (chipId) {
    case 'diagnostic':
      return {
        userEcho: '15 Dk Teşhis Testi Nedir?',
        assistantText:
          '15 dakikalık teşhis, güçlü ve gelişime açık konu alanlarınızı hızlıca ölçen kısa bir denemedir. Keşfet sekmesinden veya atanan materyallerden başlatılır; sonuç anında karne olarak görünür.',
        link: {
          href: '/help',
          label: 'SSS: Teşhis nasıl çalışır?',
        },
      };
    case 'exams':
      return {
        userEcho: 'Digital SAT & IELTS Farkı',
        assistantText:
          'Digital SAT, College Board mantığına yakın çoktan seçmeli bölümler ve skor projeksiyonu sunar. IELTS Academic ise band ölçekli dört beceri (okuma, yazma, dinleme, konuşma) ve rubrik geri bildirimi içerir. Her ikisi de hazırlık amaçlıdır; resmî sınav yerine geçmez.',
        link: {
          href: '/sistem',
          label: 'Sistem & motorlar',
        },
      };
    case 'corporate':
      return {
        userEcho: 'Kurum/Okul Lisansı Nasıl Alınır?',
        assistantText:
          'Okul ve kurs merkezleri kampüs/şube lisansı ile öğretmen koordinasyonu ve ortak kütüphane kullanır. Demo ve teklif için iletişim formundan “Kurumsal Lisans / Demo” konusunu seçebilirsiniz.',
        link: {
          href: '/solutions?tab=kurum',
          label: 'Kurum çözümleri',
        },
      };
    case 'booking':
      return {
        userEcho: '📅 Uzmanla Online Görüşme Planla',
        assistantText:
          'Harika — uygun bir görüşme slotu planlayalım. Lütfen ad soyad, e-posta ve telefonunuzu girin; ardından takvimden gün ve saat seçin.',
        startBooking: true,
      };
    default: {
      const _exhaustive: never = chipId;
      return _exhaustive;
    }
  }
}

export type KeywordReply = {
  assistantText: string;
  link?: { href: string; label: string };
  startBooking?: boolean;
};

/** tr-TR küçük harf + Latin akronim eşleştirmesi (I→ı yerine i). */
export function normalizeAssistantQuery(raw: string): string {
  return raw
    .trim()
    .toLocaleLowerCase('tr')
    .replace(/\u0131/g, 'i');
}

/** Basit anahtar kelime eşleştirme (küçük harf, Türkçe karakter toleranslı). */
export function matchFreeTextQuery(raw: string): KeywordReply | null {
  const q = normalizeAssistantQuery(raw);
  if (!q) return null;

  if (/randevu|görüşme|gorusme|meeting|uzman|takvim/.test(q)) {
    return {
      assistantText:
        'Online görüşme planlamak için iletişim bilgilerinizi alıp müsait slot seçmeniz yeterli.',
      startBooking: true,
    };
  }

  if (/fiyat|ücret|ucret|paket|abonelik|pricing/.test(q)) {
    return {
      assistantText:
        'Bireysel, veli, öğretmen ve kurumsal paket katmanlarımız /pricing sayfasında özetlenir. Deneme katmanı 15 günlük sınırlı keşif sunar.',
      link: { href: '/pricing', label: 'Paketleri incele' },
    };
  }

  if (/iletişim|iletisim|adres|telefon|mail|e-posta|ofis|bursa/.test(q)) {
    return {
      assistantText:
        'Nilüfer / Bursa merkez ofisimiz ve info@interscola.com adresi üzerinden bize ulaşabilirsiniz. Form ile mesaj da iletebilirsiniz.',
      link: { href: '/contact', label: 'İletişim formu' },
    };
  }

  if (/sat|digital sat|college board/.test(q)) {
    return {
      assistantText:
        'Digital SAT modülü bölüm bazlı pratik ve skor projeksiyonu sağlar. Detaylı motor tanımı Sistem sayfasında.',
      link: { href: '/sistem', label: 'Digital SAT motoru' },
    };
  }

  if (/ielts|band|british|idp/.test(q)) {
    return {
      assistantText:
        'IELTS Academic modülünde rubrik mantığına yakın band geri bildirimi üretilir. Resmî IELTS sınavı değildir.',
      link: { href: '/help', label: 'IELTS puanlama SSS' },
    };
  }

  if (/teşhis|teshis|diagnostic|15/.test(q)) {
    return {
      assistantText:
        'Teşhis testi kısa sürede konu dağılımınızı ölçer. Giriş yaptıktan sonra keşfet sekmesinden başlatabilirsiniz.',
      link: {
        href: STUDENT_DIAGNOSTIC_EXPLORE_PATH,
        label: 'Teşhis keşfet',
      },
    };
  }

  if (/kurum|okul|lisans|license|demo/.test(q)) {
    return {
      assistantText:
        'Kurumsal lisans için çözümler hub ve iletişim formunu kullanın; demo talebi en kısa sürede yanıtlanır.',
      link: { href: '/contact', label: 'Kurumsal demo talebi' },
    };
  }

  if (/burs|scholarship|bursu|burslar/.test(q)) {
    return {
      assistantText:
        'Burs ve finansman rehberliği için çözümler hub’daki burs sekmesinde program özetlerini inceleyebilirsiniz.',
      link: { href: '/solutions?tab=burs', label: 'Burs çözümleri' },
    };
  }

  if (/yardım|yardim|sss|help|nasıl|nasil/.test(q)) {
    return {
      assistantText: 'Sık sorulan sorular ve arama destekli yardım merkezimiz hazır.',
      link: { href: '/help', label: 'Yardım merkezi' },
    };
  }

  return null;
}

export const GENERIC_FALLBACK_REPLY =
  'Sorunuz için en iyi yanıtı bulamadım. Yardım merkezine göz atabilir veya uzman görüşmesi planlayabilirsiniz.';
