export type ActivityCategory =
  | 'leadership'
  | 'community_service'
  | 'athletics'
  | 'arts_music'
  | 'academic_competitions'
  | 'internship_work'
  | 'other';

export type ActivityGradeLevel = '9' | '10' | '11' | '12';

export const ACTIVITY_GRADE_LEVELS: ActivityGradeLevel[] = [
  '9',
  '10',
  '11',
  '12',
];

export const ACTIVITY_CATEGORIES: ActivityCategory[] = [
  'leadership',
  'community_service',
  'athletics',
  'arts_music',
  'academic_competitions',
  'internship_work',
  'other',
];

export interface ActivityItem {
  id: string;
  category: ActivityCategory;
  title: string;
  organization: string;
  role: string;
  grades: ActivityGradeLevel[];
  hoursPerWeek: number;
  weeksPerYear: number;
  impactDescription: string;
  certificateUrl?: string;
  createdAt: string;
}

export interface ActivityPassportData {
  items: ActivityItem[];
  updatedAt?: string;
}

export const IMPACT_DESCRIPTION_MAX_LENGTH = 150;

export function createEmptyActivityPassport(): ActivityPassportData {
  return { items: [] };
}
