/**
 * Uni4Edu program satırı — `public.university_programs` ile uyumlu (snake_case).
 */
export type UniversityProgramDegreeLevel =
  | 'bachelor'
  | 'master'
  | 'doctoral'
  | 'other';

export interface UniversityProgram {
  id: string;
  university_id: string;
  program_name: string;
  degree_level: UniversityProgramDegreeLevel;
  faculty: string | null;
  min_sat_score: number | null;
  min_sat_math: number | null;
  min_sat_rw: number | null;
  min_ielts_score: number | null;
  min_ielts_subscore: number | null;
  min_gpa: string | null;
  /** YYYY-MM-DD veya null */
  application_deadline: string | null;
  english_waiver_policy: string | null;
}
