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
