import { GoogleGenAI } from '@google/genai';
import type { AssessmentScoreMatrix } from '@/types/assessment';
import { RIASEC_LABELS } from '@/lib/assessment/scoring';

export const CAREER_ASSESSMENT_DISCLAIMER =
  'Bu rapor pedagojik rehberlik amaçlıdır; tıbbi, psikiyatrik veya klinik teşhis yerine geçmez. ' +
  'Üniversite ve sınav kararlarınızı resmi danışmanlık ve kurum kaynaklarıyla birlikte değerlendirin.';

function formatMatrixForPrompt(scores: AssessmentScoreMatrix): string {
  const riasecLines = Object.entries(scores.riasec)
    .map(([code, dim]) => `${code} (${RIASEC_LABELS[code as keyof typeof RIASEC_LABELS]}): %${dim.percent}`)
    .join('\n');

  const bigFiveLines = Object.entries(scores.bigFive)
    .map(([key, dim]) => `${key}: ortalama ${dim.average.toFixed(1)}/5 (%${dim.percent})`)
    .join('\n');

  const cognitiveLines = Object.entries(scores.cognitive)
    .map(([key, dim]) => `${key}: ortalama ${dim.average.toFixed(1)}/5 (%${dim.percent})`)
    .join('\n');

  return [
    `Holland kodu: ${scores.hollandCode} — ${scores.hollandTitle}`,
    'RIASEC:',
    riasecLines,
    'Big Five / çalışma stili:',
    bigFiveLines,
    'Bilişsel güçler:',
    cognitiveLines,
  ].join('\n');
}

/**
 * Kayıtlı öğrenciler için Gemini destekli rehberlik metni.
 * Girdi skorları önceden TypeScript ile hesaplanmış olmalıdır.
 */
export async function generateCareerGuidanceReport(
  scores: AssessmentScoreMatrix,
): Promise<{ success: true; report: string } | { success: false; error: string }> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return {
      success: false,
      error: 'GEMINI_API_KEY tanımlı değil.',
    };
  }

  const ai = new GoogleGenAI({ apiKey });
  const matrixText = formatMatrixForPrompt(scores);

  const prompt = `Sen Interscola kariyer pusulası pedagojik danışmanısın. Aşağıdaki deterministik puan matrisine dayanarak Türkçe bir rehberlik raporu yaz.

KURALLAR:
- Tıbbi veya klinik teşhis dili KULLANMA (ör. depresyon, anksiyete bozukluğu, ADHD teşhisi).
- Çalışma alışkanlıkları, sınav hazırlığı (SAT, IELTS, CAIE), hedef üniversite barajları ve bölüm uyumu odaklı yaz.
- Bocconi, Politecnico di Milano, TU Munich gibi örnekler verilebilir; kesin kabul garantisi verme.
- 4-6 kısa paragraf + 3 maddelik aksiyon listesi.
- Son paragrafta yasal feragatname metnini aynen ekle: "${CAREER_ASSESSMENT_DISCLAIMER}"

PUAN MATRİSİ:
${matrixText}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
    });

    const text = response.text?.trim();
    if (!text) {
      return { success: false, error: 'Model boş yanıt döndü.' };
    }

    const report = text.includes(CAREER_ASSESSMENT_DISCLAIMER)
      ? text
      : `${text}\n\n${CAREER_ASSESSMENT_DISCLAIMER}`;

    return { success: true, report };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[career-ai] Rapor üretilemedi:', message);
    return { success: false, error: 'AI raporu oluşturulamadı.' };
  }
}
