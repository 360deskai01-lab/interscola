'use client';

import type { ReactNode } from 'react';
import type {
  StudentLatestScores,
  University,
} from '@/app/universities/actions';
import { AcceptanceMatchStatus } from '@/components/universities/AcceptanceMatchStatus';

interface UniversityCardProps {
  university: University;
  studentScores: StudentLatestScores;
}

/**
 * Keşif kartı kabul eşleştirmesi (SAT / IELTS / CAIE A-Level).
 * Liste düzeni `UniversityExplorer` içindedir; eşleştirme mantığı paylaşımlıdır.
 */
export function UniversityCardMatchBlock({
  university,
  studentScores,
}: UniversityCardProps): ReactNode {
  return (
    <AcceptanceMatchStatus
      university={university}
      studentScores={studentScores}
      variant="compact"
    />
  );
}
