import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isAdminEmail } from '@/lib/admin';

// Endpoint léger, séparé de /api/admin/overview (qui charge tous les
// comptes) : les pages client (dashboard, settings) n'ont besoin que d'un
// booléen pour savoir s'il faut rediriger vers /admin, pas du détail.
export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ isAdmin: false }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData } = await supabaseAdmin.auth.getUser(token);

  return NextResponse.json({ isAdmin: isAdminEmail(userData?.user?.email) });
}
