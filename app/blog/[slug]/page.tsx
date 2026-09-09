import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Navigation from '@/components/Navigation';
import { blogPosts, getBlogPost, type BlogBlock } from '@/lib/blog';
import { ArrowRight } from 'lucide-react';

export function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const post = getBlogPost(params.slug);
  if (!post) return {};
  return {
    title: `${post.title} — Churnly`,
    description: post.description,
    openGraph: { title: post.title, description: post.description, type: 'article' },
    twitter: { card: 'summary_large_image', title: post.title, description: post.description },
  };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function Block({ block }: { block: BlogBlock }) {
  if (block.type === 'h2') {
    return <h2 className="mt-8 text-xl font-semibold text-slate-900 dark:text-white">{block.text}</h2>;
  }
  if (block.type === 'ul') {
    return (
      <ul className="mt-4 space-y-2 text-slate-600 dark:text-slate-300">
        {block.items.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-brand-500">•</span> {item}
          </li>
        ))}
      </ul>
    );
  }
  return <p className="mt-4 leading-relaxed text-slate-600 dark:text-slate-300">{block.text}</p>;
}

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = getBlogPost(params.slug);
  if (!post) notFound();

  return (
    <>
      <Navigation user={null} />
      <main className="mx-auto max-w-2xl px-6 py-16">
        <Link href="/blog" className="text-sm font-medium text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
          ← Blog
        </Link>
        <p className="mt-4 text-xs font-medium text-slate-400 dark:text-slate-500">{formatDate(post.publishedAt)}</p>
        <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{post.title}</h1>

        <article className="mt-6">
          {post.blocks.map((block, i) => (
            <Block key={i} block={block} />
          ))}
        </article>

        <div className="mt-12 rounded-2xl border border-brand-100 bg-brand-50/50 p-6 text-center dark:border-brand-500/20 dark:bg-brand-500/5">
          <p className="font-semibold text-slate-900 dark:text-white">Voyez votre vrai taux de churn en 2 minutes</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Premier scan gratuit, sans carte bancaire.</p>
          <Link
            href="/signup"
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800 dark:bg-brand-600 dark:hover:bg-brand-500"
          >
            Essayer gratuitement <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </main>
    </>
  );
}
