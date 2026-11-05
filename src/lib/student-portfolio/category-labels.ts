import type { ActivityCategory } from '@/lib/student-portfolio/types';

export const CATEGORY_LABELS_TR: Record<ActivityCategory, string> = {
  leadership: 'Liderlik',
  community_service: 'Gönüllülük',
  athletics: 'Spor',
  arts_music: 'Sanat & Müzik',
  academic_competitions: 'Olimpiyat / Yarışma',
  internship_work: 'Staj & İş',
  other: 'Diğer',
};

export type PortfolioFilterId =
  | 'all'
  | 'leadership'
  | 'community_service'
  | 'athletics'
  | 'arts_music'
  | 'academic_competitions'
  | 'internship_work';

export const PORTFOLIO_FILTERS: {
  id: PortfolioFilterId;
  label: string;
}[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'leadership', label: 'Liderlik' },
  { id: 'community_service', label: 'Gönüllülük' },
  { id: 'athletics', label: 'Spor' },
  { id: 'arts_music', label: 'Sanat' },
  { id: 'academic_competitions', label: 'Olimpiyat / Yarışma' },
  { id: 'internship_work', label: 'Staj' },
];

export function categoryBadgeClass(category: ActivityCategory): string {
  switch (category) {
    case 'leadership':
      return 'border-violet-400/40 bg-violet-500/15 text-violet-100';
    case 'community_service':
      return 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100';
    case 'athletics':
      return 'border-orange-400/40 bg-orange-500/15 text-orange-100';
    case 'arts_music':
      return 'border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-100';
    case 'academic_competitions':
      return 'border-amber-400/40 bg-amber-500/15 text-amber-100';
    case 'internship_work':
      return 'border-cyan-400/40 bg-cyan-500/15 text-cyan-100';
    default:
      return 'border-slate-400/40 bg-slate-500/15 text-slate-200';
  }
}
