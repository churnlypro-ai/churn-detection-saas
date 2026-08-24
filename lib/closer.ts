// Même logique que isAdminEmail (lib/admin.ts) mais pour l'espace closer —
// une liste blanche distincte, jamais un rôle stocké en base ni modifiable
// depuis l'app. Un closer n'a besoin d'aucun profil business complet pour
// accéder à /closer : il se connecte via /login (Google ou lien magique),
// et c'est uniquement son email authentifié qui est vérifié ici.
export function isCloserEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const allowlist = (process.env.CLOSER_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  return allowlist.includes(email.toLowerCase());
}
