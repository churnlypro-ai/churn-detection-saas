import type { Metadata } from 'next';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import { blogPosts } from '@/lib/blog';
import { ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Blog — Churnly',
  description:
    "Rétention client, churn SaaS, prédiction de désabonnement : articles pratiques pour les fondateurs et équipes SaaS qui veulent garder leurs clients plus longtemps.",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function BlogIndexPage() {
  const posts = [...blogPosts].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  return (
    <>
      <Navigation user={null} />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Blog</h1>
        <p className="mt-3 text-slate-500 dark:text-slate-400">
          Rétention client et churn SaaS, expliqués simplement — sans chiffres inventés.
        </p>

        <div className="mt-10 space-y-8">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="block rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition hover:border-brand-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-500/40"
            >
              <p className="text-xs font-medium text-slate-400 dark:text-slate-500">{formatDate(post.publishedAt)}</p>
              <h2 className="mt-1.5 text-xl font-semibold text-slate-900 dark:text-white">{post.title}</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{post.description}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-600 dark:text-brand-400">
                Lire l&apos;article <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
