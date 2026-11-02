export type UniversityPublicationStatus = 'published' | 'draft';

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
  minSat?: number;
  minIelts?: number;
  minAlevel?: string;
  websiteUrl?: string;
}
