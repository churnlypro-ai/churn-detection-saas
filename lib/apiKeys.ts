import crypto from 'crypto';

const KEY_PREFIX = 'churnly_live_';

// Comme un mot de passe : seul le hash est stocké en base
// (public.api_keys.key_hash), jamais la valeur en clair. generateApiKey()
// n'est appelée qu'à la création (voir /api/api-keys) — la clé en clair est
// renvoyée une seule fois dans la réponse HTTP, jamais persistée nulle part.
export function generateApiKey(): { plaintext: string; hash: string; prefix: string } {
  const random = crypto.randomBytes(24).toString('hex');
  const plaintext = `${KEY_PREFIX}${random}`;
  return {
    plaintext,
    hash: hashApiKey(plaintext),
    prefix: plaintext.slice(0, KEY_PREFIX.length + 6),
  };
}

export function hashApiKey(plaintext: string): string {
  return crypto.createHash('sha256').update(plaintext).digest('hex');
}
