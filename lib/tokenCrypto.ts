import crypto from 'crypto';

// AES-256-GCM, clé fixe depuis l'environnement — générique malgré le nom de
// la variable d'origine (GMAIL_TOKEN_ENCRYPTION_KEY, premier secret protégé
// ainsi, voir la migration 20260820000000) : réutilisé tel quel pour les
// clés API Paddle et Lemon Squeezy (voir 20260907020000) plutôt que
// d'introduire une clé de chiffrement par intégration — un seul secret à
// protéger dans l'environnement, pas la peine d'un vault dédié par
// fournisseur.
function getKey(): Buffer {
  // .trim() + guillemets retirés : un copier-coller depuis un terminal ou
  // un gestionnaire de mots de passe ajoute facilement un retour à la ligne
  // ou des guillemets autour de la valeur collée dans Vercel.
  const raw = process.env.GMAIL_TOKEN_ENCRYPTION_KEY ?? '';
  const hex = raw.trim().replace(/^["']|["']$/g, '');
  if (!hex || hex.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(`GMAIL_TOKEN_ENCRYPTION_KEY invalide : ${hex.length} caractère(s) reçu(s), 64 attendus (hex uniquement). Valeur brute: "${raw.slice(0, 10)}..."`);
  }
  return Buffer.from(hex, 'hex');
}

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // iv.authTag.ciphertext, tout en base64 — un seul champ texte à stocker.
  return `${iv.toString('base64')}.${authTag.toString('base64')}.${encrypted.toString('base64')}`;
}

export function decryptSecret(stored: string): string {
  const [ivB64, authTagB64, dataB64] = stored.split('.');
  if (!ivB64 || !authTagB64 || !dataB64) throw new Error('Format de secret chiffré invalide.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
  return decrypted.toString('utf8');
}
