import type { TuitionTier } from '@/lib/universities/explorer-config';
import type { UniversityProgram } from '@/types/university';

export type { TuitionTier } from '@/lib/universities/explorer-config';

/** `public.target_universities` satır sözleşmesi (DB: min_sat_score, min_ielts_band, min_alevel, min_gpa). */
export interface University {
  id: string;
  slug: string;
  name: string;
  country: string;
  city: string | null;
  min_sat_score: number | null;
  min_ielts_band: number | null;
  /** Örn. AAB, A*AA (UK A-Level / CAIE offer) */
  min_alevel: string | null;
  /** Alternatif metin barajı (örn. A*AA) */
  min_gpa: string | null;
  tuition_fee_range: string | null;
  monthly_living_cost: string | null;
  accommodation_info: string | null;
  application_deadlines: string | null;
  description: string | null;
  scholarship_info: string | null;
  local_exam_requirements: string | null;
  website_url: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  disciplines?: string[];
  tuition_tier?: TuitionTier | string | null;
  /** CMS / DB genişlemesi: çift diploma vb. kısa rozet metni. */
  special_programs_badge?: string | null;
  /** Kurumda 1 yıllık Foundation / hazırlık programı var mı (`has_foundation_pathway`). */
  has_foundation_pathway?: boolean;
  /** `university_programs` — detay sayfasında dolar; liste sorgularında genelde yok. */
  programs?: UniversityProgram[];
}

export type UniversityCountryFilter =
  | 'ALL'
  | 'İtalya'
  | 'Hollanda'
  | 'Almanya'
  | 'İngiltere'
  | 'ABD';

export interface StudentLatestScores {
  satScore: number | null;
  ieltsBand: number | null;
  /** En güncel CAIE denemesinden parse edilen harf notu (A*, A, … U) */
  caieGrade: string | null;
}
