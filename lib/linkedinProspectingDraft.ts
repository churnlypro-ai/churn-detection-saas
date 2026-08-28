import Anthropic from '@anthropic-ai/sdk';

let anthropicClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

export interface ExtractedLinkedInLead {
  contactName: string;
  linkedinUrl: string;
  message: string;
}

// Ancré sur le protocole + le nom d'hôte (pas juste "contient la
// sous-chaîne") — sans ça, un domaine comme "notlinkedin.com/in/x" passe la
// vérification puisqu'il contient "linkedin.com/in/" comme sous-chaîne.
// Le protocole est aussi obligatoire : window.open() sur une URL sans
// schéma (ex: "linkedin.com/in/x") l'interpréterait comme un chemin
// relatif sur churnly.fr au lieu d'ouvrir LinkedIn.
const LINKEDIN_URL_PATTERN = /^https?:\/\/([a-z0-9-]+\.)?linkedin\.com\/(in|company)\//i;

// Parseur déterministe du même format "name:/url:/message:" séparé par ---
// que le collage en masse côté front (voir parseLinkedInBulkBlocks dans
// app/admin/prospecting/page.tsx). Utilisé en priorité sur les fichiers
// importés : un lot de contacts déjà écrits dans ce format n'a aucune
// raison de passer par un appel IA — en plus d'être inutile, ça a un vrai
// coût de fiabilité. Avec des messages personnalisés longs (~700 mots),
// faire recopier chaque message mot pour mot par le modèle dans sa sortie
// JSON peut dépasser max_tokens avant que le tableau ne se referme,
// produisant un JSON tronqué et donc 0 contact extrait — silencieusement,
// sans erreur visible. Le parseur déterministe n'a pas cette limite.
export function parseStructuredLinkedInBlocks(rawText: string): ExtractedLinkedInLead[] {
  const blocks = rawText.split(/^---$/m).map((b) => b.trim()).filter(Boolean);
  const leads: ExtractedLinkedInLead[] = [];
  for (const block of blocks) {
    const lines = block.split('\n');
    let contactName = '';
    let linkedinUrl = '';
    const messageLines: string[] = [];
    let inMessage = false;
    for (const line of lines) {
      if (inMessage) { messageLines.push(line); continue; }
      if (line.toLowerCase().startsWith('name:')) contactName = line.slice(line.indexOf(':') + 1).trim();
      else if (line.toLowerCase().startsWith('url:') || line.toLowerCase().startsWith('linkedin:')) linkedinUrl = line.slice(line.indexOf(':') + 1).trim();
      else if (line.toLowerCase().startsWith('message:')) {
        inMessage = true;
        const rest = line.slice(line.indexOf(':') + 1);
        if (rest.trim()) messageLines.push(rest.trim());
      }
    }
    const message = messageLines.join('\n').trim();
    if (contactName && message && LINKEDIN_URL_PATTERN.test(linkedinUrl)) {
      leads.push({ contactName, linkedinUrl, message });
    }
  }
  return leads;
}

// Contrairement à la prospection email, le message est déjà rédigé par
// l'admin dans le fichier source — on l'extrait tel quel, sans jamais le
// réécrire, le raccourcir ou le compléter, pour ne jamais envoyer un
// message qui n'est pas exactement celui qu'il a validé.
const EXTRACT_SYSTEM_PROMPT = `Tu extrais une liste de prospects LinkedIn à partir de données brutes (tableau CSV converti depuis Excel, liste Markdown, notes libres, texte copié-collé).

Pour CHAQUE personne distincte, extrais :
- contactName: le nom de la personne.
- linkedinUrl: son URL de profil LinkedIn — UNIQUEMENT si elle apparaît explicitement, texto, dans les données fournies (un lien contenant "linkedin.com/in/" ou "linkedin.com/company/"). Ne déduis et n'invente JAMAIS une URL. Si aucune URL LinkedIn n'est présente pour une personne, ignore-la entièrement — ne l'inclus pas dans le résultat.
- message: le message de prospection déjà rédigé pour cette personne, recopié EXACTEMENT tel qu'il apparaît dans les données, sans le modifier, le raccourcir, le traduire ou le compléter. Si aucun message n'est présent pour une personne, ignore-la entièrement.

Réponds UNIQUEMENT avec un JSON valide, un tableau d'objets exactement dans ce format, sans texte autour :
[{"contactName": "...", "linkedinUrl": "...", "message": "..."}]

Si aucune personne exploitable n'est trouvée, réponds avec un tableau vide [].`;

export async function extractLinkedInLeadsFromRawText(rawText: string): Promise<ExtractedLinkedInLead[]> {
  const trimmed = rawText.trim();
  if (!trimmed) return [];

  const client = getClient();
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    // Relevé au-dessus du défaut : ce chemin ne sert plus qu'aux fichiers
    // non structurés (voir parseStructuredLinkedInBlocks, essayé en
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
      linkedinUrl: String((item as Record<string, unknown>)?.linkedinUrl ?? '').trim(),
      message: String((item as Record<string, unknown>)?.message ?? '').trim(),
    }))
    .filter((lead) => lead.contactName && lead.message && LINKEDIN_URL_PATTERN.test(lead.linkedinUrl));
}
