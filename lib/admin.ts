// Liste blanche d'emails "ambassadeur" — jamais un rôle stocké en base ni
// modifiable depuis l'app, pour qu'aucun utilisateur ne puisse jamais se
// l'attribuer lui-même. Voir ADMIN_EMAILS dans les variables d'env Vercel.
export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const allowlist = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  return allowlist.includes(email.toLowerCase());
}
