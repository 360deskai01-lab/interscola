import type { MetadataRoute } from 'next';
import { getSiteOrigin } from '@/lib/seo/site-url';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteOrigin();

  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/universities'],
      disallow: ['/student/', '/teacher/', '/api/', '/admin/'],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
