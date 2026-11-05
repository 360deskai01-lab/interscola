export type TargetCountry =
  | 'italy'
  | 'germany'
  | 'netherlands'
  | 'uk'
  | 'other_eu';

export type HouseholdIncomeBand =
  | 'under_15k'
  | '15_30k'
  | '30_55k'
  | 'over_55k';

export type PropertyOwnership = 'rent' | 'one_home' | 'multiple';

export type StudentsInFamily = '1' | '2' | '3_plus';

export type MaxFamilyContribution =
  | 'under_2k'
  | '2_5k'
  | '5_10k'
  | 'over_10k';

export type HighSchoolGpa = 'below_70' | '70_80' | '80_90' | '90_plus';

export type ExamStatus =
  | 'none'
  | 'sat_mid'
  | 'sat_high'
  | 'a_level'
  | 'ib';

export type EnglishProficiency =
  | 'none'
  | 'ielts_5'
  | 'ielts_6'
  | 'ielts_7_plus'
  | 'toefl_90_plus';

/** Tamamlanmış 8 parametre — misafir teşhis formu girdisi. */
export interface ScholarshipSimulatorInput {
  targetCountry: TargetCountry;
  householdIncome: HouseholdIncomeBand;
  propertyOwnership: PropertyOwnership;
  studentsInFamily: StudentsInFamily;
  maxFamilyContribution: MaxFamilyContribution;
  highSchoolGpa: HighSchoolGpa;
  examStatus: ExamStatus;
  englishProficiency: EnglishProficiency;
}

export interface ScholarshipMatch {
  id: string;
  name: string;
  country: string;
  institution: string;
  fitPercent: number;
  tagline: string;
}

export interface ScholarshipSimulatorLockedTeaser {
  iseeDocumentList: string[];
  consulateApostilleNotes: string[];
  applicationCalendar: string[];
}

export interface ScholarshipSimulatorResult {
  needBasedScore: number;
  meritBasedScore: number;
  summaryParagraph: string;
  matches: ScholarshipMatch[];
  lockedTeaser: ScholarshipSimulatorLockedTeaser;
}

export const SCHOLARSHIP_SIMULATOR_PATH = '/test-et/scholarship';

export const SCHOLARSHIP_REGISTER_HREF =
  '/auth/register?source=scholarship';
