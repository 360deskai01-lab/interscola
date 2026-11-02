export function parseSatScoreFromAttempt(row: {
  raw_score: unknown;
  scaled_result: unknown;
}): number | null {
  if (typeof row.raw_score === 'number' && Number.isFinite(row.raw_score)) {
    return Math.round(row.raw_score);
  }
  if (typeof row.scaled_result === 'string') {
    const matched = row.scaled_result.match(/^(\d{3,4})/);
    if (matched?.[1]) {
      const parsed = Number.parseInt(matched[1], 10);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

export function parseIeltsBandFromAttempt(row: {
  raw_score: unknown;
  scaled_result: unknown;
}): number | null {
  if (typeof row.raw_score === 'number' && Number.isFinite(row.raw_score)) {
    return row.raw_score;
  }
  if (typeof row.scaled_result === 'string') {
    const matched = row.scaled_result.match(/Band\s+([\d.]+)/i);
    if (matched?.[1]) {
      const parsed = Number.parseFloat(matched[1]);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

export interface StudentRecentScores {
  satScore: number | null;
  ieltsBand: number | null;
}

type AttemptRow = {
  curriculum?: string;
  raw_score: unknown;
  scaled_result: unknown;
  created_at?: string;
};

/** En son tamamlanan denemeden müfredat bazlı skor (kronolojik). */
export function extractRecentScoresFromAttempts(
  rows: AttemptRow[],
): StudentRecentScores {
  let satScore: number | null = null;
  let ieltsBand: number | null = null;

  for (const row of rows) {
    const curriculum =
      typeof row.curriculum === 'string' ? row.curriculum.toUpperCase() : '';

    if (curriculum === 'SAT' && satScore === null) {
      satScore = parseSatScoreFromAttempt(row);
    }
    if (curriculum === 'IELTS' && ieltsBand === null) {
      ieltsBand = parseIeltsBandFromAttempt(row);
    }
    if (satScore !== null && ieltsBand !== null) break;
  }

  return { satScore, ieltsBand };
}
