import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isAdminEmail } from '@/lib/admin';

// Modération des avis avant publication sur la page d'accueil — voir
// app/admin/testimonials/page.tsx et la note dans la migration
// 20260917000000_add_testimonials.sql sur pourquoi rien n'est public par
// défaut.
export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !isAdminEmail(userData?.user?.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from('testimonials')
    .select('id, user_id, author_name, company_name, role_title, rating, content, status, created_at, reviewed_at')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Chargement échoué.' }, { status: 500 });
  return NextResponse.json({ testimonials: data ?? [] });
}

// Ajout manuel d'un avis directement par un admin (ex: retour reçu par
// email ou en appel, pas soumis via /avis) — user_id reste NULL, voir la
// migration 20260917010000 pour pourquoi ça n'entre pas en conflit avec
// l'unicité "un avis par client" des soumissions réelles.
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !isAdminEmail(userData?.user?.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const authorName = typeof body?.authorName === 'string' ? body.authorName.trim() : '';
  const companyName = typeof body?.companyName === 'string' ? body.companyName.trim() : '';
  const roleTitle = typeof body?.roleTitle === 'string' ? body.roleTitle.trim() : '';
  const content = typeof body?.content === 'string' ? body.content.trim() : '';
  const rating = Number(body?.rating);

  if (!authorName || !content) return NextResponse.json({ error: 'Nom et avis requis.' }, { status: 400 });
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Note entre 1 et 5 requise.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('testimonials')
    .insert({
      user_id: null,
      author_name: authorName,
      company_name: companyName || null,
      role_title: roleTitle || null,
      rating,
      content,
      status: 'approved',
      reviewed_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: 'Ajout échoué.' }, { status: 500 });
  return NextResponse.json({ success: true, id: data.id });
}
