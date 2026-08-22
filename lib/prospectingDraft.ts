import Anthropic from '@anthropic-ai/sdk';

let anthropicClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

export interface ExtractedLead {
  company: string;
  email: string;
  context: string;
}

export interface DraftedProspectEmail {
  company: string;
  email: string;
  subject: string;
  body: string;
}

// Règle non-négociable héritée des vagues de prospection précédentes :
// jamais deviner une adresse (prénom@domaine) — un email faux abîme la
// délivrabilité du compte Gmail réel utilisé pour l'envoi (churnly.pro@gmail.com).
// N'inclure une entreprise que si une vraie adresse apparaît explicitement
// dans le fichier source.
const EXTRACT_SYSTEM_PROMPT = `Tu extrais une liste de prospects B2B (SaaS/produits en ligne) à partir de données brutes (tableau CSV converti depuis Excel, liste Markdown, notes libres).

Pour CHAQUE entreprise distincte, extrais :
- company: nom de l'entreprise
- email: l'adresse email de contact — UNIQUEMENT si elle apparaît explicitement, texto, dans les données fournies. Ne déduis JAMAIS une adresse à partir d'un nom et d'un domaine (ex: jamais "prenom@entreprise.com" inventé). Si aucune adresse n'est présente pour une entreprise, ignore-la entièrement — ne l'inclus pas dans le résultat.
- context: une phrase résumant ce que fait l'entreprise et pourquoi elle pourrait avoir un problème de churn (MRR approximatif si connu, type de produit, signal de risque mentionné dans les données) — reste factuel, base-toi uniquement sur ce qui est fourni, n'invente aucun chiffre.

Réponds UNIQUEMENT avec un JSON valide, un tableau d'objets exactement dans ce format, sans texte autour :
[{"company": "...", "email": "...", "context": "..."}]

Si aucune entreprise exploitable n'est trouvée, réponds avec un tableau vide [].`;

export async function extractLeadsFromRawText(rawText: string): Promise<ExtractedLead[]> {
  const trimmed = rawText.trim();
  if (!trimmed) return [];

  const client = getClient();
  const message = await client.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 8192,
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

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return parsed
    .map((item) => ({
      company: String((item as Record<string, unknown>)?.company ?? '').trim(),
      email: String((item as Record<string, unknown>)?.email ?? '').trim().toLowerCase(),
      context: String((item as Record<string, unknown>)?.context ?? '').trim(),
    }))
    .filter((lead) => lead.company && emailPattern.test(lead.email));
}

// Un prospect basé en Allemagne, en Israël ou au Pakistan ne lit pas un
// email de prospection en français — la langue se choisit par lot
// d'import (un fichier = généralement un même pays/marché), pas déduite
// automatiquement par entreprise. Limité à 5 langues pertinentes pour un
// public SaaS/tech plutôt que les 10 langues les plus parlées au monde
// (mandarin, hindi, arabe... peu utiles ici).
export type ProspectLanguage = 'fr' | 'en' | 'es' | 'de' | 'pt';

const LANGUAGE_NAMES: Record<ProspectLanguage, string> = {
  fr: 'français',
  en: 'anglais',
  es: 'espagnol',
  de: 'allemand',
  pt: 'portugais',
};

const SIGNATURE_BY_LANGUAGE: Record<ProspectLanguage, string> = {
  fr: 'L\'équipe Churnly',
  en: 'The Churnly team',
  es: 'El equipo de Churnly',
  de: 'Das Churnly-Team',
  pt: 'A equipe Churnly',
};

// Même ton et structure que les vagues précédentes rédigées manuellement
// (voir historique des emails de prospection) : registre poli, court, un
// signal d'usage plausible et spécifique au produit plutôt qu'un discours
// commercial générique, jamais de faits inventés au-delà de ce qui est
// fourni dans le contexte.
function buildDraftSystemPrompt(language: ProspectLanguage): string {
  const langName = LANGUAGE_NAMES[language];
  const signature = SIGNATURE_BY_LANGUAGE[language];
  return `Tu rédiges des emails de prospection à froid pour Churnly (churnly.fr), un outil qui analyse les données d'abonnement (Stripe) d'un SaaS pour prédire quels clients vont se désabonner, pourquoi, et quoi faire.

Règles obligatoires, strictes :
- Écris l'objet ET le corps ENTIÈREMENT en ${langName} — aucun mot dans une autre langue.
- Registre poli et professionnel, adapté à un premier contact B2B en ${langName}${language === 'fr' ? ' (vouvoiement, jamais de tutoiement)' : ''}.
- 100 à 140 mots maximum, direct, sans jargon marketing.
- Mentionne UN signal d'usage plausible et spécifique à l'activité de cette entreprise (déduit raisonnablement du contexte fourni, jamais un fait chiffré inventé) qui annoncerait un désabonnement avant qu'il n'arrive réellement.
- Propose l'analyse gratuite Churnly comme preuve à faire soi-même sur ses propres données — jamais une vente directe, jamais de pression.
- Toujours inclure le lien www.churnly.fr.
- Ne jamais signer avec le prénom du destinataire — toujours "${signature}" (traduit dans la langue cible, exactement comme donné ici).
- Objet court (moins de 8 mots), mentionne le nom de l'entreprise.
- N'invente aucun chiffre (MRR, taux de churn) qui ne soit pas dans le contexte fourni.

Réponds UNIQUEMENT avec un JSON valide, un tableau d'objets, un par prospect, EXACTEMENT dans le même ordre que la liste fournie :
[{"email": "...", "subject": "...", "body": "..."}]`;
}

const DRAFT_CHUNK_SIZE = 6;
const DRAFT_CONCURRENCY = 3;

async function draftChunk(leads: ExtractedLead[], language: ProspectLanguage): Promise<DraftedProspectEmail[]> {
  const client = getClient();
  const message = await client.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 4096,
    system: buildDraftSystemPrompt(language),
    messages: [
      {
        role: 'user',
        content: `Prospects à traiter, dans cet ordre :\n${JSON.stringify(leads, null, 2)}`,
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

  const byEmail = new Map(leads.map((lead) => [lead.email, lead]));
  const results: DraftedProspectEmail[] = [];
  for (const item of parsed) {
    const email = String((item as Record<string, unknown>)?.email ?? '').trim().toLowerCase();
    const lead = byEmail.get(email);
    if (!lead) continue;
    const subject = String((item as Record<string, unknown>)?.subject ?? '').trim();
    const draftedBody = String((item as Record<string, unknown>)?.body ?? '').trim();
    if (!subject || !draftedBody) continue;
    results.push({ company: lead.company, email: lead.email, subject, body: draftedBody });
  }
  return results;
}

export async function draftProspectEmailsBatch(leads: ExtractedLead[], language: ProspectLanguage = 'fr'): Promise<DraftedProspectEmail[]> {
  const chunks: ExtractedLead[][] = [];
  for (let i = 0; i < leads.length; i += DRAFT_CHUNK_SIZE) {
    chunks.push(leads.slice(i, i + DRAFT_CHUNK_SIZE));
  }

  const results: DraftedProspectEmail[] = [];
  for (let i = 0; i < chunks.length; i += DRAFT_CONCURRENCY) {
    const batch = chunks.slice(i, i + DRAFT_CONCURRENCY);
    const batchResults = await Promise.all(batch.map((chunk) => draftChunk(chunk, language).catch(() => [] as DraftedProspectEmail[])));
    for (const r of batchResults) results.push(...r);
  }
  return results;
}
