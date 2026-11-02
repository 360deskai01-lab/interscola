export type UniversityPublicationStatus = 'published' | 'draft' | 'archived';

export interface AdminUniversityRow {
  id: string;
  slug: string;
  name: string;
  country: string;
  city: string | null;
  minSatScore: number | null;
  minIeltsBand: number | null;
  minAlevel: string | null;
  websiteUrl: string | null;
  tuitionFeeRange: string | null;
  isFeatured: boolean;
  status: UniversityPublicationStatus;
  logoUrl: string | null;
  coverImageUrl: string | null;
  sourceUrl: string | null;
}

export interface AdminUniversitiesSummary {
  total: number;
  featuredCount: number;
  universities: AdminUniversityRow[];
}

export interface BulkUniversityImportRow {
  name: string;
  country: string;
  city: string;
  slug?: string;
  minSat?: number;
  minIelts?: number;
  minAlevel?: string;
  websiteUrl?: string;
  tuitionFeeRange?: string;
  disciplines?: string[];
  tuitionTier?: string;
  status?: UniversityPublicationStatus;
}

/** Manuel tekil ekleme / düzenleme (admin CMS). */
export interface UniversityUpsertInput {
  id?: string;
  name: string;
  country: string;
  city: string;
  slug?: string;
  minSatScore?: number | null;
  minIeltsBand?: number | null;
  minAlevel?: string | null;
  websiteUrl?: string | null;
  tuitionFeeRange?: string | null;
  status?: UniversityPublicationStatus;
}

/** JSON/CSV parse çıktısı — sunucu tarafında normalize edilir. */
export type UniversityImportRecord = BulkUniversityImportRow;
