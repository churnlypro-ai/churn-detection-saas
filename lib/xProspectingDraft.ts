import Anthropic from '@anthropic-ai/sdk';

let anthropicClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

export interface ExtractedXLead {
  contactName: string;
  xUrl: string;
  message: string;
}

// Ancré sur le protocole + le nom d'hôte (pas juste "contient la
// sous-chaîne") — même raison que INSTAGRAM_URL_PATTERN dans
// instagramProspectingDraft.ts. Les deux domaines (x.com et twitter.com)
// pointent toujours vers les mêmes profils depuis le renommage de la
// plateforme, donc les deux sont acceptés.
const X_URL_PATTERN = /^https?:\/\/(www\.)?(x\.com|twitter\.com)\/[a-zA-Z0-9_]+\/?(\?.*)?$/i;

// Parseur déterministe du même format "name:/url:/message:" séparé par ---
// que le collage en masse côté front (voir parseXBulkBlocks dans
// app/admin/prospecting/page.tsx). Utilisé en priorité sur les fichiers
// importés — même raisonnement que pour LinkedIn/Instagram : un lot déjà
// dans ce format n'a aucune raison de passer par un appel IA, et ça évite
// le risque de troncature du JSON sur de gros lots de messages longs.
export function parseStructuredXBlocks(rawText: string): ExtractedXLead[] {
  const blocks = rawText.split(/^---$/m).map((b) => b.trim()).filter(Boolean);
  const leads: ExtractedXLead[] = [];
  for (const block of blocks) {
    const lines = block.split('\n');
    let contactName = '';
    let xUrl = '';
    const messageLines: string[] = [];
    let inMessage = false;
    for (const line of lines) {
      if (inMessage) { messageLines.push(line); continue; }
      if (line.toLowerCase().startsWith('name:')) contactName = line.slice(line.indexOf(':') + 1).trim();
      else if (line.toLowerCase().startsWith('url:') || line.toLowerCase().startsWith('x:') || line.toLowerCase().startsWith('twitter:')) xUrl = line.slice(line.indexOf(':') + 1).trim();
      else if (line.toLowerCase().startsWith('message:')) {
        inMessage = true;
        const rest = line.slice(line.indexOf(':') + 1);
        if (rest.trim()) messageLines.push(rest.trim());
      }
    }
    const message = messageLines.join('\n').trim();
    if (contactName && message && X_URL_PATTERN.test(xUrl)) {
      leads.push({ contactName, xUrl, message });
    }
  }
  return leads;
}

// Contrairement à la prospection email, le message est déjà rédigé par
// l'admin dans le fichier source — on l'extrait tel quel, sans jamais le
// réécrire, le raccourcir ou le compléter, pour ne jamais envoyer un
// message qui n'est pas exactement celui qu'il a validé.
const EXTRACT_SYSTEM_PROMPT = `Tu extrais une liste de prospects X (anciennement Twitter) à partir de données brutes (tableau CSV converti depuis Excel, liste Markdown, notes libres, texte copié-collé).

Pour CHAQUE personne distincte, extrais :
- contactName: le nom ou pseudo de la personne.
- xUrl: son URL de profil X ou Twitter — UNIQUEMENT si elle apparaît explicitement, texto, dans les données fournies (un lien contenant "x.com/" ou "twitter.com/"). Ne déduis et n'invente JAMAIS une URL. Si aucune URL X/Twitter n'est présente pour une personne, ignore-la entièrement — ne l'inclus pas dans le résultat.
- message: le message de prospection déjà rédigé pour cette personne, recopié EXACTEMENT tel qu'il apparaît dans les données, sans le modifier, le raccourcir, le traduire ou le compléter. Si aucun message n'est présent pour une personne, ignore-la entièrement.

Réponds UNIQUEMENT avec un JSON valide, un tableau d'objets exactement dans ce format, sans texte autour :
[{"contactName": "...", "xUrl": "...", "message": "..."}]

Si aucune personne exploitable n'est trouvée, réponds avec un tableau vide [].`;

export async function extractXLeadsFromRawText(rawText: string): Promise<ExtractedXLead[]> {
  const trimmed = rawText.trim();
  if (!trimmed) return [];

  const client = getClient();
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    // Relevé au-dessus du défaut : ce chemin ne sert plus qu'aux fichiers
    // non structurés (voir parseStructuredXBlocks, essayé en premier),
    // mais un lot de leads avec des messages déjà longs peut quand même
    // dépasser 8192 tokens en sortie et tronquer le JSON avant sa
    // fermeture.
    max_tokens: 16000,
    system: EXTRACT_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: trimmed.slice(0, 80_000),
      },
    ],
  });

  const textBlock = message.content.find(
    (block): block is Anthropic.TextBlock => block.type === 'text',
  );
  if (!textBlock) return [];

  const match = textBlock.text.match(/\[[\s\S]*\]/);
  if (!match) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((item) => ({
      contactName: String((item as Record<string, unknown>)?.contactName ?? '').trim(),
      xUrl: String((item as Record<string, unknown>)?.xUrl ?? '').trim(),
      message: String((item as Record<string, unknown>)?.message ?? '').trim(),
    }))
    .filter((lead) => lead.contactName && lead.message && X_URL_PATTERN.test(lead.xUrl));
}
