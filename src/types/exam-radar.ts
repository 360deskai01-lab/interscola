/** `public.official_exam_schedules` — radarda gösterilen sınav özeti. */
export interface OfficialExamScheduleSummary {
  id: string;
  examName: string;
  examType: string | null;
  /** ISO tarih (YYYY-MM-DD). */
  examDate: string;
  registrationOpenDate: string | null;
  registrationCloseDate: string | null;
  /** Yerel takvim günü farkı (bugünden sınav gününe, 0 = bugün). */
  daysRemaining: number;
  /** DB kaydı yokken `load-exam-radar` deterministik projeksiyonu. */
  isProjected?: boolean;
}

/** `public.exam_test_centers` — yetkili merkez satırı. */
export interface ExamTestCenterSummary {
  id: string;
  city: string;
  centerName: string;
  address: string | null;
  capacityStatus: 'available' | 'limited';
}

/** `getOfficialExamRadarAction` çıktı sözleşmesi. */
export interface OfficialExamRadarData {
  nearestExam: OfficialExamScheduleSummary | null;
  centers: ExamTestCenterSummary[];
  /** Radarın bağlandığı şehir (metadata veya parametre). */
  userCity: string | null;
}
