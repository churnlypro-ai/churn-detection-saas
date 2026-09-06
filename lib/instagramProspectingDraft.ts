import Anthropic from '@anthropic-ai/sdk';

let anthropicClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

export interface ExtractedInstagramLead {
  contactName: string;
  instagramUrl: string;
  message: string;
}

// Ancré sur le protocole + le nom d'hôte (pas juste "contient la
// sous-chaîne") — même raison que LINKEDIN_URL_PATTERN dans
// linkedinProspectingDraft.ts : sans ça, un domaine comme
// "notinstagram.com/x" passe la vérification puisqu'il contient
// "instagram.com/" comme sous-chaîne. Le protocole est aussi obligatoire :
// window.open() sur une URL sans schéma l'interpréterait comme un chemin
// relatif sur churnly.fr au lieu d'ouvrir Instagram.
const INSTAGRAM_URL_PATTERN = /^https?:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9_.]+\/?(\?.*)?$/i;

// Parseur déterministe du même format "name:/url:/message:" séparé par ---
// que le collage en masse côté front (voir parseInstagramBulkBlocks dans
// app/admin/prospecting/page.tsx). Utilisé en priorité sur les fichiers
// importés — même raisonnement que pour LinkedIn : un lot déjà dans ce
// format n'a aucune raison de passer par un appel IA, et ça évite le risque
// de troncature du JSON sur de gros lots de messages longs.
export function parseStructuredInstagramBlocks(rawText: string): ExtractedInstagramLead[] {
  const blocks = rawText.split(/^---$/m).map((b) => b.trim()).filter(Boolean);
  const leads: ExtractedInstagramLead[] = [];
  for (const block of blocks) {
    const lines = block.split('\n');
    let contactName = '';
    let instagramUrl = '';
    const messageLines: string[] = [];
    let inMessage = false;
    for (const line of lines) {
      if (inMessage) { messageLines.push(line); continue; }
      if (line.toLowerCase().startsWith('name:')) contactName = line.slice(line.indexOf(':') + 1).trim();
      else if (line.toLowerCase().startsWith('url:') || line.toLowerCase().startsWith('instagram:')) instagramUrl = line.slice(line.indexOf(':') + 1).trim();
      else if (line.toLowerCase().startsWith('message:')) {
        inMessage = true;
        const rest = line.slice(line.indexOf(':') + 1);
        if (rest.trim()) messageLines.push(rest.trim());
      }
    }
    const message = messageLines.join('\n').trim();
    if (contactName && message && INSTAGRAM_URL_PATTERN.test(instagramUrl)) {
      leads.push({ contactName, instagramUrl, message });
    }
  }
  return leads;
}

// Contrairement à la prospection email, le message est déjà rédigé par
// l'admin dans le fichier source — on l'extrait tel quel, sans jamais le
// réécrire, le raccourcir ou le compléter, pour ne jamais envoyer un
// message qui n'est pas exactement celui qu'il a validé.
const EXTRACT_SYSTEM_PROMPT = `Tu extrais une liste de prospects Instagram à partir de données brutes (tableau CSV converti depuis Excel, liste Markdown, notes libres, texte copié-collé).

Pour CHAQUE personne distincte, extrais :
- contactName: le nom ou pseudo de la personne.
- instagramUrl: son URL de profil Instagram — UNIQUEMENT si elle apparaît explicitement, texto, dans les données fournies (un lien contenant "instagram.com/"). Ne déduis et n'invente JAMAIS une URL. Si aucune URL Instagram n'est présente pour une personne, ignore-la entièrement — ne l'inclus pas dans le résultat.
- message: le message de prospection déjà rédigé pour cette personne, recopié EXACTEMENT tel qu'il apparaît dans les données, sans le modifier, le raccourcir, le traduire ou le compléter. Si aucun message n'est présent pour une personne, ignore-la entièrement.

Réponds UNIQUEMENT avec un JSON valide, un tableau d'objets exactement dans ce format, sans texte autour :
[{"contactName": "...", "instagramUrl": "...", "message": "..."}]

Si aucune personne exploitable n'est trouvée, réponds avec un tableau vide [].`;

export async function extractInstagramLeadsFromRawText(rawText: string): Promise<ExtractedInstagramLead[]> {
  const trimmed = rawText.trim();
  if (!trimmed) return [];

  const client = getClient();
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    // Relevé au-dessus du défaut : ce chemin ne sert plus qu'aux fichiers
    // non structurés (voir parseStructuredInstagramBlocks, essayé en
    // premier), mais un lot de leads avec des messages déjà longs peut
    // quand même dépasser 8192 tokens en sortie et tronquer le JSON avant
    // sa fermeture.
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
      instagramUrl: String((item as Record<string, unknown>)?.instagramUrl ?? '').trim(),
      message: String((item as Record<string, unknown>)?.message ?? '').trim(),
    }))
    .filter((lead) => lead.contactName && lead.message && INSTAGRAM_URL_PATTERN.test(lead.instagramUrl));
}
