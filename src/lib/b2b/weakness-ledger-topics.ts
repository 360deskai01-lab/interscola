function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Deneme `evaluations` gövdesinden Weakness Ledger / remedial konu etiketleri. */
export function extractWeaknessTopicsFromEvaluation(
  evaluations: unknown,
): string[] {
  if (!isRecord(evaluations)) return [];
  const topics: string[] = [];
  const remedial = evaluations.remedialTopics;
  if (Array.isArray(remedial)) {
    for (const item of remedial) {
      if (typeof item === 'string' && item.trim()) topics.push(item.trim());
    }
  }
  const ledger = evaluations.weakness_ledger;
  if (Array.isArray(ledger)) {
    for (const item of ledger) {
      if (typeof item === 'string' && item.trim()) topics.push(item.trim());
      if (isRecord(item) && typeof item.topic === 'string' && item.topic.trim()) {
        topics.push(item.topic.trim());
      }
    }
  }
  return topics;
}

export type WeaknessTopicCount = {
  topic: string;
  occurrenceCount: number;
};

export function topWeaknessTopics(
  topicCounts: Map<string, number>,
  limit: number,
): WeaknessTopicCount[] {
  return [...topicCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'tr'))
    .slice(0, Math.max(0, limit))
    .map(([topic, occurrenceCount]) => ({ topic, occurrenceCount }));
}
