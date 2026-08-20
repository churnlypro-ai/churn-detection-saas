const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';

function redirectUri(): string {
  return `${process.env.NEXT_PUBLIC_APP_URL}/api/admin/gmail/callback`;
}

// access_type=offline + prompt=consent : sans ça, Google ne renvoie un
// refresh_token qu'à la toute première autorisation d'un compte donné —
// une reconnexion (ex: après expiration à 7 jours en mode Testing, voir
// l'app/admin/prospecting/page.tsx) n'en renverrait plus aucun.
export function buildGmailAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_GMAIL_CLIENT_ID ?? '',
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: GMAIL_SEND_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export async function exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_GMAIL_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_GMAIL_CLIENT_SECRET ?? '',
      redirect_uri: redirectUri(),
      grant_type: 'authorization_code',
    }),
  });
  if (!response.ok) {
    throw new Error(`Échange du code Google échoué (${response.status}): ${await response.text()}`);
  }
  return response.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_GMAIL_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_GMAIL_CLIENT_SECRET ?? '',
      grant_type: 'refresh_token',
    }),
  });
  if (!response.ok) {
    throw new Error(`Rafraîchissement du token Google échoué (${response.status}): ${await response.text()}`);
  }
  const data: GoogleTokenResponse = await response.json();
  return data.access_token;
}

function base64Url(input: string | Buffer): string {
  const base64 = (typeof input === 'string' ? Buffer.from(input, 'utf8') : input).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Encodage RFC 2047 pour le sujet (accents) — sinon "Émail" arrive corrompu
// côté destinataire selon le client mail.
function encodeSubject(subject: string): string {
  return `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;
}

export async function sendGmailMessage(params: {
  accessToken: string;
  fromEmail: string;
  to: string;
  subject: string;
  body: string;
}): Promise<void> {
  const mime = [
    `From: ${params.fromEmail}`,
    `To: ${params.to}`,
    `Subject: ${encodeSubject(params.subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    params.body,
  ].join('\r\n');

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: base64Url(mime) }),
  });

  if (!response.ok) {
    throw new Error(`Envoi Gmail échoué (${response.status}): ${await response.text()}`);
  }
}
