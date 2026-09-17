import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

const MESSAGES = {
  fr: {
    missingFields: 'Merci de remplir votre nom et votre avis.',
    contentTooShort: 'Votre avis doit contenir au moins 20 caractères.',
    contentTooLong: 'Votre avis est limité à 600 caractères.',
    invalidRating: 'La note doit être entre 1 et 5 étoiles.',
    saveFailed: 'Impossible d\'enregistrer votre avis pour le moment.',
  },
  en: {
    missingFields: 'Please fill in your name and your review.',
    contentTooShort: 'Your review must be at least 20 characters.',
    contentTooLong: 'Your review is limited to 600 characters.',
    invalidRating: 'The rating must be between 1 and 5 stars.',
    saveFailed: 'Could not save your review right now.',
  },
} as const;

// Public : les avis affichés sur la page d'accueil (voir la section
// témoignages dans app/page.tsx). Publiés immédiatement à la soumission —
// pas d'étape de relecture (voir la note dans POST ci-dessous) — donc ce
// filtre sur 'approved' ne fait plus qu'écarter un éventuel avis que
// l'admin voudrait un jour dépublier sans le supprimer.
export async function GET() {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from('testimonials')
    .select('id, author_name, company_name, role_title, rating, content, created_at')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(24);

  if (error) return NextResponse.json({ error: 'Chargement échoué.' }, { status: 500 });
  return NextResponse.json({ testimonials: data ?? [] });
}

// Soumission (et re-soumission) d'un avis — voir app/avis/page.tsx. Publié
// immédiatement (status 'approved' direct, pas de relecture admin requise).
//
// TEMPORAIRE (demande explicite du 17/09, "pour ce soir" — à revenir en
// arrière dans les jours qui suivent) : le token d'auth est optionnel. Un
// visiteur sans compte peut soumettre un avis directement (user_id NULL,
// jamais dédupliqué contre un autre anonyme). Un client connecté garde le
// comportement normal : une seule ligne par compte, un index unique partiel
// sur user_id (voir la migration 20260917010000) empêche un même client de
// créer plusieurs lignes, donc on sélectionne d'abord une ligne existante
// puis on l'UPDATE plutôt qu'un upsert Postgres classique — un upsert avec
// ON CONFLICT ne matche pas un index unique PARTIEL (il ne s'applique qu'aux
// lignes où user_id n'est pas NULL, pour laisser les avis ajoutés à la main
// par un admin, ou par un visiteur anonyme le temps de ce soir, coexister
// sans contrainte).
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  const supabaseAdmin = getSupabaseAdmin();

  let userId: string | null = null;
  if (token) {
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }
    userId = userData.user.id;
  }

  const body = await req.json().catch(() => ({}));
  const language = body?.language === 'en' ? 'en' : 'fr';
  const m = MESSAGES[language];

  const authorName = typeof body?.authorName === 'string' ? body.authorName.trim() : '';
  const companyName = typeof body?.companyName === 'string' ? body.companyName.trim() : '';
  const roleTitle = typeof body?.roleTitle === 'string' ? body.roleTitle.trim() : '';
  const content = typeof body?.content === 'string' ? body.content.trim() : '';
  const rating = Number(body?.rating);

  if (!authorName || !content) {
    return NextResponse.json({ error: m.missingFields }, { status: 400 });
  }
  if (content.length < 20) {
    return NextResponse.json({ error: m.contentTooShort }, { status: 400 });
  }
  if (content.length > 600) {
    return NextResponse.json({ error: m.contentTooLong }, { status: 400 });
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: m.invalidRating }, { status: 400 });
  }

  const existing = userId
    ? (await supabaseAdmin.from('testimonials').select('id').eq('user_id', userId).maybeSingle()).data
    : null;

  const row = {
    user_id: userId,
    author_name: authorName,
    company_name: companyName || null,
    role_title: roleTitle || null,
    rating,
    content,
    status: 'approved',
    updated_at: new Date().toISOString(),
    reviewed_at: new Date().toISOString(),
  };

  const { data, error } = existing
    ? await supabaseAdmin.from('testimonials').update(row).eq('id', existing.id).select('id, status').single()
    : await supabaseAdmin.from('testimonials').insert(row).select('id, status').single();

  if (error) {
    console.error('[testimonials] save failed', JSON.stringify({ userId, error }));
    return NextResponse.json({ error: m.saveFailed }, { status: 500 });
  }

  return NextResponse.json({ success: true, testimonial: data });
}
