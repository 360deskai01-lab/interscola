import type { MetadataRoute } from 'next';
import { getSiteOrigin } from '@/lib/seo/site-url';
import {
  listTargetUniversitySeoEntries,
  universitySitemapPath,
} from '@/lib/universities/sitemap-data';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteOrigin();
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${siteUrl}/`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${siteUrl}/universities`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${siteUrl}/auth/login`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${siteUrl}/auth/register`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
  ];

  const universities = await listTargetUniversitySeoEntries();
  const universityRoutes: MetadataRoute.Sitemap = universities.map(
    ({ slug, lastModified }) => ({
      url: `${siteUrl}${universitySitemapPath(slug)}`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.8,
    }),
  );

  return [...staticRoutes, ...universityRoutes];
}
