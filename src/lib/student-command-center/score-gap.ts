export function parseTargetNumber(
  value: number | string | undefined,
): number | null {
  if (value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

export function scoreGapProgress(
  current: number | null,
  target: number | null,
): {
  percent: number;
  remaining: number | null;
  exceeded: boolean;
} {
  if (target === null || target <= 0) {
    return { percent: 0, remaining: null, exceeded: false };
  }
  if (current === null) {
    return { percent: 0, remaining: target, exceeded: false };
  }
  if (current >= target) {
    return { percent: 100, remaining: 0, exceeded: true };
  }
  const percent = Math.min(100, Math.round((current / target) * 100));
  return { percent, remaining: target - current, exceeded: false };
}

export function motivationForProgress(percent: number, hasScore: boolean): string {
  if (!hasScore) {
    return 'İlk resmi denemeni tamamla; skor radarı burada canlanacak.';
  }
  if (percent >= 100) {
    return 'Kişisel hedefini yakaladın — üniversite barajlarını pin kartlarından izle.';
  }
  if (percent >= 75) {
    return 'Bitişe çok az kaldı; odaklı tekrarlar fark yaratır.';
  }
  if (percent >= 40) {
    return 'Yolun yarısından fazlasını geçtin — teşhis raporundaki boşluklara odaklan.';
  }
  return 'Güçlü bir temel için düzenli deneme + AI geri bildirimi en hızlı yol.';
}
