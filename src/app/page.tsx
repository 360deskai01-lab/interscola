import { connection } from 'next/server';
import { getFeaturedUniversitiesForHomeAction } from '@/app/home/featured-universities-action';
import HomePageClient from '@/app/HomePageClient';

export const instant = false;

export default async function Page() {
  await connection();

  const featured = await getFeaturedUniversitiesForHomeAction();
  const featuredUniversities = featured.success ? featured.universities : [];

  return <HomePageClient featuredUniversities={featuredUniversities} />;
}
