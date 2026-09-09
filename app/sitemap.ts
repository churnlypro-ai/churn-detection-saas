import type { MetadataRoute } from 'next';
import { blogPosts } from '@/lib/blog';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://churnly.fr';

// Canal SEO : sans sitemap, Google découvre les nouvelles pages (surtout
// /blog/*) par exploration classique, ce qui prend plus de temps qu'un
// sitemap déclaré explicitement — voir la discussion sur les canaux
// marketing accessibles à ce stade.
export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE_URL}/pricing`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE_URL}/blog`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/signup`, changeFrequency: 'monthly', priority: 0.6 },
  ];

  const blogPages: MetadataRoute.Sitemap = blogPosts.map((post) => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    lastModified: post.publishedAt,
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  return [...staticPages, ...blogPages];
}
