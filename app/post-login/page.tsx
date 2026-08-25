'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// Point de passage unique après connexion (mot de passe, lien magique ou
// Google) sur /login : avant d'atterrir sur l'espace "next" prévu pour un
// client normal (dashboard, onboarding…), on vérifie si l'email connecté
// est un closer ou un ambassadeur — auquel cas on redirige directement vers
// son espace dédié, qui n'a rien à voir avec l'interface client de base.
function PostLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    (async () => {
      const next = searchParams.get('next') || '/dashboard';

      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) { router.replace('/login'); return; }

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) { router.replace(next); return; }

      const [closerCheck, adminCheck] = await Promise.all([
        fetch('/api/closer/check', { headers: { Authorization: `Bearer ${token}` } })
          .then((r) => r.json()).catch(() => ({ isCloser: false })),
        fetch('/api/admin/check', { headers: { Authorization: `Bearer ${token}` } })
          .then((r) => r.json()).catch(() => ({ isAdmin: false })),
      ]);

      if (closerCheck.isCloser) { router.replace('/closer'); return; }
      if (adminCheck.isAdmin) { router.replace('/admin'); return; }
      router.replace(next);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
    </main>
  );
}

export default function PostLogin() {
  return (
    <Suspense fallback={null}>
      <PostLoginContent />
    </Suspense>
  );
}
