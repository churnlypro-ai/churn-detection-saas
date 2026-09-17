import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// Voir app/avis/page.tsx : permet d'afficher le bon état (formulaire vide ou
// "déjà en ligne, modifiable") selon ce que ce client a déjà soumis, sans
// jamais exposer les avis des autres utilisateurs (contrairement à GET
// /api/testimonials qui ne renvoie que les avis approuvés, tous comptes
// confondus). Sans token (visiteur anonyme, voir la note TEMPORAIRE dans
// /api/testimonials POST) : toujours "pas d'avis existant" plutôt qu'une
// erreur — un anonyme n'a de toute façon aucun avis à retrouver.
export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ testimonial: null });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from('testimonials')
    .select('id, author_name, company_name, role_title, rating, content, status, created_at')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'Chargement échoué.' }, { status: 500 });
  return NextResponse.json({ testimonial: data ?? null });
}
