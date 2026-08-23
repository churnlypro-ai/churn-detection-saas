import Anthropic from '@anthropic-ai/sdk';

let anthropicClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

// Limité à 5 langues pertinentes pour un public SaaS/tech plutôt que les
// 10 langues les plus parlées au monde (mandarin, hindi, arabe... peu
// utiles ici). Déduite automatiquement par entreprise à l'extraction
// (pays/ville/domaine/indices dans les données) — jamais un choix manuel
// unique pour tout un lot, qui a déjà produit des emails dans la mauvaise
// langue quand plusieurs pays étaient mélangés dans un même import.
export type ProspectLanguage = 'fr' | 'en' | 'es' | 'de' | 'pt';

const VALID_LANGUAGES: ProspectLanguage[] = ['fr', 'en', 'es', 'de', 'pt'];

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

export interface ExtractedLead {
  company: string;
  email: string;
  context: string;
  language: ProspectLanguage;
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
- language: la langue dans laquelle l'email de prospection doit être écrit pour CETTE entreprise précisément, déduite du pays/de la ville/du nom de domaine/de toute autre indication présente dans les données. Choisis UNIQUEMENT une valeur parmi : "fr" (France ou pays francophone), "de" (Allemagne/Autriche/Suisse germanophone), "es" (Espagne/hispanophone), "pt" (Portugal/lusophone). Si le pays n'entre dans aucune de ces cases, ou si l'information manque/est ambiguë, réponds "en" (anglais — c'est le choix par défaut sûr pour un premier contact B2B international).

Réponds UNIQUEMENT avec un JSON valide, un tableau d'objets exactement dans ce format, sans texte autour :
[{"company": "...", "email": "...", "context": "...", "language": "fr|en|es|de|pt"}]

Si aucune entreprise exploitable n'est trouvée, réponds avec un tableau vide [].`;

export async function extractLeadsFromRawText(rawText: string): Promise<ExtractedLead[]> {
  const trimmed = rawText.trim();
  if (!trimmed) return [];

  const client = getClient();
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
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
    .map((item) => {
      const rawLanguage = String((item as Record<string, unknown>)?.language ?? '').trim().toLowerCase();
      return {
        company: String((item as Record<string, unknown>)?.company ?? '').trim(),
        email: String((item as Record<string, unknown>)?.email ?? '').trim().toLowerCase(),
        context: String((item as Record<string, unknown>)?.context ?? '').trim(),
        language: (VALID_LANGUAGES.includes(rawLanguage as ProspectLanguage) ? rawLanguage : 'en') as ProspectLanguage,
      };
    })
    .filter((lead) => lead.company && emailPattern.test(lead.email));
}

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
- Toujours inclure le lien www.churnly.fr/demo (jamais juste www.churnly.fr) — c'est une démo publique du dashboard rempli de données, sans inscription requise, pensée exactement pour un premier clic depuis un email à froid.
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
    model: 'claude-haiku-4-5-20251001',
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

// Chaque entreprise porte désormais sa propre langue (déduite à
// l'extraction) — on regroupe par langue avant de rédiger, un lot importé
// peut donc mélanger plusieurs pays sans jamais mélanger les langues des
// emails produits.
export async function draftProspectEmailsBatch(leads: ExtractedLead[]): Promise<DraftedProspectEmail[]> {
  const groups = new Map<ProspectLanguage, ExtractedLead[]>();
  for (const lead of leads) {
    const group = groups.get(lead.language);
    if (group) group.push(lead);
    else groups.set(lead.language, [lead]);
  }

  const results: DraftedProspectEmail[] = [];
  for (const [language, groupLeads] of Array.from(groups.entries())) {
    const chunks: ExtractedLead[][] = [];
    for (let i = 0; i < groupLeads.length; i += DRAFT_CHUNK_SIZE) {
      chunks.push(groupLeads.slice(i, i + DRAFT_CHUNK_SIZE));
    }
    for (let i = 0; i < chunks.length; i += DRAFT_CONCURRENCY) {
      const batch = chunks.slice(i, i + DRAFT_CONCURRENCY);
      const batchResults = await Promise.all(batch.map((chunk) => draftChunk(chunk, language).catch(() => [] as DraftedProspectEmail[])));
      for (const r of batchResults) results.push(...r);
    }
  }
  return results;
}

// Corrige des brouillons déjà en file, rédigés dans la mauvaise langue —
// reprend le contenu déjà écrit (qui porte déjà le signal spécifique à
// l'entreprise) et le réécrit entièrement dans la bonne langue, plutôt que
// de repartir de zéro depuis le fichier source d'origine.
export interface DraftToFix {
  id: string;
  company: string;
  subject: string;
  body: string;
}

export interface FixedDraft {
  id: string;
  subject: string;
  body: string;
}

function buildRelanguageSystemPrompt(language: ProspectLanguage): string {
  const langName = LANGUAGE_NAMES[language];
  const signature = SIGNATURE_BY_LANGUAGE[language];
  return `Des emails de prospection à froid pour Churnly ont été rédigés dans la mauvaise langue. Réécris CHACUN entièrement en ${langName}, en conservant exactement le même message et le même signal spécifique à l'entreprise (ne change pas le fond, seulement la langue et le registre pour que ce soit naturel en ${langName}${language === 'fr' ? ', vouvoiement' : ''}).

Règles :
- Objet et corps entièrement en ${langName}.
- Garde le lien www.churnly.fr/demo tel quel.
- Signature : toujours "${signature}".
- Ne jamais signer avec le prénom du destinataire.

Réponds UNIQUEMENT avec un JSON valide, un tableau d'objets, un par email, EXACTEMENT dans le même ordre que la liste fournie :
[{"id": "...", "subject": "...", "body": "..."}]`;
}

async function relanguageChunk(drafts: DraftToFix[], language: ProspectLanguage): Promise<FixedDraft[]> {
  const client = getClient();
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    system: buildRelanguageSystemPrompt(language),
    messages: [
      {
        role: 'user',
        content: `Emails à réécrire, dans cet ordre :\n${JSON.stringify(drafts, null, 2)}`,
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

  const knownIds = new Set(drafts.map((d) => d.id));
  const results: FixedDraft[] = [];
  for (const item of parsed) {
    const id = String((item as Record<string, unknown>)?.id ?? '').trim();
    if (!knownIds.has(id)) continue;
    const subject = String((item as Record<string, unknown>)?.subject ?? '').trim();
    const body = String((item as Record<string, unknown>)?.body ?? '').trim();
    if (!subject || !body) continue;
    results.push({ id, subject, body });
  }
  return results;
}

export async function relanguageDraftsBatch(drafts: DraftToFix[], language: ProspectLanguage): Promise<FixedDraft[]> {
  const chunks: DraftToFix[][] = [];
  for (let i = 0; i < drafts.length; i += DRAFT_CHUNK_SIZE) {
    chunks.push(drafts.slice(i, i + DRAFT_CHUNK_SIZE));
  }
  const results: FixedDraft[] = [];
  for (let i = 0; i < chunks.length; i += DRAFT_CONCURRENCY) {
    const batch = chunks.slice(i, i + DRAFT_CONCURRENCY);
    const batchResults = await Promise.all(batch.map((chunk) => relanguageChunk(chunk, language).catch(() => [] as FixedDraft[])));
    for (const r of batchResults) results.push(...r);
  }
  return results;
}
