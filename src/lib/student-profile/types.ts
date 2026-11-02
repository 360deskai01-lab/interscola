/** `public.profiles.target_scores` JSON sözleşmesi (ör. SAT, IELTS). */
export type StudentTargetScores = Record<string, number | string>;

export interface StudentUniversityOption {
  id: string;
  name: string;
  country: string;
  city: string | null;
}

export interface StudentOrganizationLink {
  organizationId: string;
  orgName: string;
}

export interface StudentGoalsContext {
  targetScores: StudentTargetScores;
  targetUniversityIds: string[];
  organization: StudentOrganizationLink | null;
  universities: StudentUniversityOption[];
  /** Hedef skor veya üniversite seçimi tanımlı mı? */
  hasGoals: boolean;
}

export interface UpdateStudentGoalsPayload {
  targetScores: StudentTargetScores;
  targetUniversityIds: string[];
}

export interface JoinOrganizationResult {
  success: boolean;
  message: string;
  orgName?: string;
}
