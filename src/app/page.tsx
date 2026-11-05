import { connection } from 'next/server';
import { getFeaturedUniversitiesForHomeAction } from '@/app/home/featured-universities-action';
import { loadRecentPublicPoolPreview } from '@/lib/public-library/load-public-pool-preview';
import HomePageClient from '@/app/HomePageClient';

export const instant = false;

export default async function Page() {
  await connection();

  const [featured, recentPublicLibraries] = await Promise.all([
    getFeaturedUniversitiesForHomeAction(),
    loadRecentPublicPoolPreview(4),
  ]);
  const featuredUniversities = featured.success ? featured.universities : [];

  return (
    <HomePageClient
      featuredUniversities={featuredUniversities}
      recentPublicLibraries={recentPublicLibraries}
    />
  );
}
