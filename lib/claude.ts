import Anthropic from '@anthropic-ai/sdk';

export type AnalysisLanguage = 'fr' | 'en';

// Décision produit du 18/08, révisée le 19/08 : Opus 5 (le modèle le plus
// cher) est réservé aux comptes réellement abonnés ('active'). Un compte en
// essai ('trialing') reçoit désormais une analyse Haiku 4.5 plutôt que
// Sonnet — Haiku coûte nettement moins cher par appel, ce qui compte vu que
// runChurnAnalysis appelle Claude par lots (BATCH_SIZE) et que l'essai
// gratuit ne doit pas coûter plus que ce qu'il rapporte. Le compte le voit
// clairement sur son dashboard (badge + incitation à s'abonner), ce n'est
// pas une dégradation cachée. Voir runChurnAnalysis dans lib/analysis.ts
// pour la logique qui choisit le tier à partir de subscription_status, et
// app/api/analyze + app/api/stripe/connect/import pour le blocage complet
// une fois l'essai terminé (subscription_status ni 'active' ni 'trialing').
export type ModelTier = 'standard' | 'premium';

const MODEL_BY_TIER: Record<ModelTier, string> = {
  standard: 'claude-haiku-4-5-20251001',
  premium: 'claude-opus-5',
};

export interface BusinessContext {
  companyName?: string | null;
  industry?: string | null;
  description?: string | null;
}

function languageInstruction(language: AnalysisLanguage): string {
  return language === 'en'
    ? '\n\nIMPORTANT: Write every text value in your response (summary_reason, factor, evidence, detail, expected_impact) in English. Keep the JSON keys and structure exactly as specified above.'
    : '';
}

// Un seuil universel ("N jours d'inactivité = risque") est faux d'une
// entreprise à l'autre : un produit à usage quotidien (réseau social, outil
// utilisé en continu type Spotify) et un outil B2B consommé une fois par
// semaine ou par mois n'ont pas la même définition de "normal". Le dropdown
// industry (saas/agency/ecommerce/...) est trop grossier pour ça — c'est la
// description libre fournie par le client (business_description en base)
// qui permet à Claude de déduire la cadence d'usage attendue et de juger
// chaque signal de fréquence par rapport à CETTE cadence plutôt qu'à un
// chiffre fixe.
function businessContextInstruction(context?: BusinessContext | null): string {
  if (!context) return '';
  const lines: string[] = [];
  if (context.companyName) lines.push(`- Nom de l'entreprise: ${context.companyName}`);
  if (context.industry) lines.push(`- Secteur déclaré: ${context.industry}`);
  if (context.description) lines.push(`- Description de son activité (fournie par le client lui-même): ${context.description}`);

  if (lines.length === 0) {
    return '\n\nCONTEXTE MÉTIER: non fourni par ce client. Reste prudent sur les signaux de fréquence/inactivité (days_since_last_login, avg_session_duration_days...) puisque tu ne sais pas quelle cadence d\'usage est normale pour son produit — pondère davantage les signaux non ambigus (statut de paiement, tickets support, renouvellement proche) que les signaux de fréquence dans ce cas.';
  }

  return `\n\nCONTEXTE MÉTIER DE L'ENTREPRISE CHURNLY QUI TE SOUMET CES CLIENTS (pas un de ses clients — son propre profil) :\n${lines.join('\n')}\n\nUtilise ce contexte pour calibrer, avant tout jugement, ce qui constitue un signal d'alerte de fréquence/inactivité pour CE produit précis. Un produit à usage quotidien par nature (réseau social, outil utilisé en continu, app consultée plusieurs fois par jour) justifie de traiter 7-10 jours d'inactivité comme un vrai risque. Un produit consommé normalement de façon hebdomadaire, mensuelle ou même trimestrielle par sa nature même (reporting, audit, service B2B ponctuel, outil de fond) NE DOIT PAS être pénalisé pour la même inactivité — c'est un usage sain pour ce type de produit, pas un signal de churn. Déduis la cadence attendue de la description ci-dessus et juge chaque client relativement à CETTE cadence, jamais à un seuil universel en nombre de jours.`;
}

let anthropicClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

const ANALYSIS_SYSTEM_PROMPT = `Tu es un analyste churn expert pour des entreprises SaaS et agences. On te fournit des données réelles sur des clients (inactivité, tickets support, usage, statut de paiement, revenu, et tout autre champ présent). Ton travail est chirurgical: chaque affirmation doit être justifiée par une vraie valeur des données fournies. N'invente jamais une donnée qui n'est pas dans l'input.

Un signal de fréquence ou d'inactivité n'a de sens que relativement au type de produit analysé — un contexte métier (nom, secteur, description de l'activité) peut t'être fourni plus bas dans ce prompt : sers-t'en systématiquement pour calibrer tes seuils avant de juger un client, plutôt que d'appliquer un seuil universel en nombre de jours.

Pour CHAQUE client, retourne:
1. churn_score (0-100): basé uniquement sur les signaux réels fournis.
2. confidence (0.0-1.0): reflète la quantité et la qualité des données disponibles pour CE client — moins de champs remplis ou de signaux clairs = confiance plus basse. Ne mets jamais 1.0 par défaut.
3. summary_reason: une phrase courte et spécifique (pour un affichage en liste), pas générique.
4. risk_factors: liste de 1 à 4 facteurs de risque, CHACUN avec:
   - factor: nom court du facteur (ex: "Inactivité", "Support", "Paiement", "Usage en baisse")
   - evidence: la valeur réelle des données qui justifie ce facteur, citée précisément (ex: "23 jours sans connexion" si days_since_last_login=23 dans l'input) — jamais une évidence inventée
   - weight: "low" | "medium" | "high" selon l'impact de ce facteur sur le score
   - si un renewal_date (ou champ équivalent) est présent et proche (moins de 30 jours), traite-le comme un facteur d'urgence à part entière — un client à risque avec un renouvellement imminent doit avoir un weight plus élevé qu'un client au profil de risque identique mais sans échéance proche
5. recommended_actions: liste de 1 à 3 actions concrètes classées par priorité, CHACUNE avec:
   - type: "email" | "call" | "offer" | "other"
   - detail: action précise et actionnable (montant d'une offre, délai, angle d'approche) — jamais générique du type "vérifier l'engagement"
   - expected_impact: pourquoi cette action a des chances de fonctionner pour CE client spécifique, en te basant sur les risk_factors identifiés

Réponds UNIQUEMENT avec un JSON valide respectant exactement ce schéma, sans texte autour:

{
  "analysis": [
    {
      "client_name": "string",
      "churn_score": 0,
      "confidence": 0.0,
      "summary_reason": "string",
      "risk_factors": [
        { "factor": "string", "evidence": "string", "weight": "low" }
      ],
      "recommended_actions": [
        { "type": "email", "detail": "string", "expected_impact": "string" }
      ]
    }
  ]
}`;

export interface RiskFactor {
  factor: string;
  evidence: string;
  weight: 'low' | 'medium' | 'high';
}

export interface RecommendedAction {
  type: 'email' | 'call' | 'offer' | 'other';
  detail: string;
  expected_impact: string;
}

export interface ChurnAnalysisItem {
  client_name: string;
  churn_score: number;
  confidence: number | null;
  summary_reason: string;
  risk_factors: RiskFactor[];
  recommended_actions: RecommendedAction[];
}

export interface EmailTemplate {
  subject: string;
  body: string;
}

const TEMPLATE_PROMPTS: Record<string, { tone: string; subject: string; approach: string }> = {
  direct: {
    tone: 'Professionnel et orienté solution',
    subject: 'On résout tes problèmes en 48h',
    approach: 'Reconnaître les problèmes techniques du client, proposer un appel ou une intervention sous 48h pour tout résoudre. Pas de culpabilisation, juste une solution directe.',
  },
  empathy: {
    tone: 'Bienveillant et généreux',
    subject: 'Cadeau de notre côté',
    approach: 'Montrer de l\'empathie pour l\'expérience décevante, offrir €50 de crédit sur le compte comme geste de bonne foi. Pas de culpabilisation, offrir quelque chose de concret.',
  },
  audit: {
    tone: 'Consultant expert, axé valeur',
    subject: 'Diagnostic gratuit 30 min',
    approach: 'Proposer un audit gratuit de 30 minutes pour identifier ensemble comment mieux utiliser le produit. Positionner comme consultant, pas comme vendeur.',
  },
  webinar: {
    tone: 'Éducatif et communautaire',
    subject: 'Masterclass gratuite jeudi 18h',
    approach: 'Inviter à une masterclass gratuite en ligne pour apprendre à tirer le maximum du produit. Mettre en avant la communauté et l\'apprentissage.',
  },
  special: {
    tone: 'Urgent mais respectueux, exclusif',
    subject: '-€50 avant demain soir seulement',
    approach: 'Offrir une réduction de €50 valable uniquement jusqu\'au lendemain soir. Créer un sentiment d\'exclusivité sans être agressif.',
  },
};

// Choisit automatiquement le template le plus pertinent selon la raison du
// risque, pour ne plus faire deviner à l'utilisateur lequel des 5 templates
// convient à chaque client — voir la discussion sur l'envoi groupé de
// brouillons de rétention. Heuristique volontairement simple (mots-clés +
// type d'action recommandée), pas une nouvelle analyse IA : le but est de
// retirer une décision répétitive, pas d'ajouter un appel Claude de plus.
export function pickBestTemplate(client: {
  reason?: string;
  risk_factors?: RiskFactor[];
  recommended_actions?: RecommendedAction[];
}): string {
  const haystack = [
    client.reason ?? '',
    ...(client.risk_factors?.map((f) => `${f.factor} ${f.evidence}`) ?? []),
    ...(client.recommended_actions?.map((a) => `${a.detail} ${a.expected_impact}`) ?? []),
  ].join(' ').toLowerCase();

  const topActionType = client.recommended_actions?.[0]?.type;

  if (/paiement|payment|carte|facturation|billing|card|impayé/.test(haystack)) return 'special';
  if (topActionType === 'offer') return 'empathy';
  if (topActionType === 'call') return 'audit';
  if (/support|ticket/.test(haystack)) return 'empathy';
  if (/inactif|inactivit|usage|connexion|login|engagement/.test(haystack)) return 'webinar';
  return 'direct';
}

export async function generateClientEmail(
  templateId: string,
  client: {
    client_name: string;
    churn_score: number;
    reason: string;
    solution: string;
    revenue_monthly?: number;
    risk_factors?: RiskFactor[];
    recommended_actions?: RecommendedAction[];
  },
  language: AnalysisLanguage = 'fr',
  modelTier: ModelTier = 'standard',
): Promise<EmailTemplate> {
  const client_for = TEMPLATE_PROMPTS[templateId] ?? TEMPLATE_PROMPTS.direct;
  const clientInstance = getClient();

  const systemPrompt = `Tu es un expert en rétention client B2B. Tu écris des emails personnalisés pour sauver des clients à risque de churn.
Règles:
- Les facteurs de risque et leurs preuves (jours sans connexion, baisse de fréquence, durée de session, etc.) sont un diagnostic INTERNE réservé à notre client — ne les cite JAMAIS dans l'email, même reformulés. Interdit: "vous ne vous êtes pas connecté depuis X jours", "votre usage a baissé", "ça fait un moment qu'on ne vous a pas vu/revu", ou toute variante qui fait comprendre au destinataire qu'on surveille son comportement. On ne dit jamais à quelqu'un qu'il est moins là — on lui donne une raison de revenir.
- Utilise ces facteurs UNIQUEMENT pour choisir la bonne solution/offre à proposer — l'email ne parle que de la solution et de sa valeur, jamais du symptôme qui l'a déclenchée
- JAMAIS de culpabilisation ("tu n'es pas venu", "tu n'utilises pas")
- Toujours orienté SOLUTION: "voici comment on l'arrange", présentée comme une invitation, jamais comme une réaction à un manque d'usage constaté
- Ton humain, pas robot
- Base-toi précisément sur les facteurs de risque et l'action recommandée fournis pour CE client pour calibrer la solution — ne généralise pas, mais ne généralise pas non plus une invitation à "revenir" qui trahirait qu'on a observé une inactivité
- Inclus l'offre ou la proposition de manière naturelle
- Maximum 150 mots, concis et percutant
- Pas de "Dear" ou formules rigides, tutoiement
- Réponds UNIQUEMENT avec un JSON: {"subject": "...", "body": "..."}${language === 'en' ? '\n- Write the subject and body in English, not French.' : ''}`;

  const riskFactorsText = client.risk_factors?.length
    ? client.risk_factors.map((f) => `- ${f.factor} (${f.weight}): ${f.evidence}`).join('\n')
    : 'Non détaillé.';
  const recommendedActionsText = client.recommended_actions?.length
    ? client.recommended_actions.map((a) => `- [${a.type}] ${a.detail} — pourquoi: ${a.expected_impact}`).join('\n')
    : `${client.solution}`;

  const message = await clientInstance.messages.create({
    model: MODEL_BY_TIER[modelTier],
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Template: ${templateId}
Ton: ${client_for.tone}
Sujet de base: ${client_for.subject}
Approche: ${client_for.approach}

Données du client:
- Nom: ${client.client_name}
- Score de churn: ${client.churn_score}%
- Raison du risque: ${client.reason}
- Revenu mensuel: €${client.revenue_monthly ?? 0}

Facteurs de risque identifiés (avec preuves réelles):
${riskFactorsText}

Actions recommandées par l'analyse (utilise-les comme base concrète pour l'email):
${recommendedActionsText}

Écris un email personnalisé pour ce client avec ce template, en t'appuyant précisément sur les facteurs de risque et actions recommandées ci-dessus.`,
      },
    ],
  });

  const textBlock = message.content.find(
    (block): block is Anthropic.TextBlock => block.type === 'text',
  );
  if (!textBlock) throw new Error('Claude did not return a text response');

  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Could not find JSON in Claude response');

  const parsed = JSON.parse(jsonMatch[0]) as EmailTemplate;
  return {
    subject: String(parsed.subject ?? client_for.subject),
    body: String(parsed.body ?? ''),
  };
}

const BATCH_SIZE = 15;

function normalizeAnalysisItem(item: Partial<ChurnAnalysisItem> & Record<string, unknown>): ChurnAnalysisItem {
  const weights = new Set(['low', 'medium', 'high']);
  const types = new Set(['email', 'call', 'offer', 'other']);

  const riskFactors = Array.isArray(item.risk_factors)
    ? item.risk_factors.map((f) => ({
        factor: String((f as RiskFactor)?.factor ?? ''),
        evidence: String((f as RiskFactor)?.evidence ?? ''),
        weight: weights.has((f as RiskFactor)?.weight) ? (f as RiskFactor).weight : 'medium',
      }))
    : [];

  const recommendedActions = Array.isArray(item.recommended_actions)
    ? item.recommended_actions.map((a) => ({
        type: types.has((a as RecommendedAction)?.type) ? (a as RecommendedAction).type : 'other',
        detail: String((a as RecommendedAction)?.detail ?? ''),
        expected_impact: String((a as RecommendedAction)?.expected_impact ?? ''),
      }))
    : [];

  return {
    client_name: String(item.client_name ?? 'Unknown'),
    churn_score: Math.max(0, Math.min(100, Math.round(Number(item.churn_score) || 0))),
    confidence: typeof item.confidence === 'number' ? Math.max(0, Math.min(1, item.confidence)) : null,
    summary_reason: String(item.summary_reason ?? (item as { reason?: string }).reason ?? ''),
    risk_factors: riskFactors,
    recommended_actions: recommendedActions,
  };
}

const BATCH_MAX_RETRIES = 2;
const BATCH_RETRY_BASE_DELAY_MS = 600;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function analyzeChurnRiskBatchOnce(
  clients: Array<Record<string, unknown>>,
  language: AnalysisLanguage,
  businessContext?: BusinessContext | null,
  modelTier: ModelTier = 'standard',
): Promise<ChurnAnalysisItem[]> {
  const client = getClient();

  const message = await client.messages.create({
    model: MODEL_BY_TIER[modelTier],
    max_tokens: 8192,
    system: ANALYSIS_SYSTEM_PROMPT + businessContextInstruction(businessContext) + languageInstruction(language),
    messages: [
      {
        role: 'user',
        content: `Voici les données clients à analyser:\n\n${JSON.stringify({ clients }, null, 2)}`,
      },
    ],
  });

  const textBlock = message.content.find(
    (block): block is Anthropic.TextBlock => block.type === 'text',
  );
  if (!textBlock) {
    throw new Error('Claude did not return a text response');
  }

  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not find JSON in Claude response');
  }

  const parsed = JSON.parse(jsonMatch[0]) as { analysis: Array<Partial<ChurnAnalysisItem> & Record<string, unknown>> };
  if (!Array.isArray(parsed.analysis)) {
    throw new Error('Claude response missing analysis array');
  }

  return parsed.analysis.map(normalizeAnalysisItem);
}

// Un CSV de plusieurs centaines de clients se découpe en dizaines de lots
// (BATCH_SIZE=15) — sans reprise, une seule erreur transitoire (rate limit,
// coupure réseau, réponse mal formée) sur UN lot faisait échouer toute
// l'analyse via Promise.all, y compris les lots déjà réussis, forçant à
// tout relancer depuis zéro et refacturer l'intégralité des appels IA déjà
// payés. Chaque lot retente maintenant seul, avec un backoff court.
async function analyzeChurnRiskBatch(
  clients: Array<Record<string, unknown>>,
  language: AnalysisLanguage,
  businessContext?: BusinessContext | null,
  modelTier: ModelTier = 'standard',
): Promise<ChurnAnalysisItem[]> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= BATCH_MAX_RETRIES; attempt++) {
    try {
      return await analyzeChurnRiskBatchOnce(clients, language, businessContext, modelTier);
    } catch (err) {
      lastError = err;
      if (attempt < BATCH_MAX_RETRIES) {
        console.error('[claude] batch analysis failed, retrying', JSON.stringify({ attempt, err: err instanceof Error ? err.message : err }));
        await sleep(BATCH_RETRY_BASE_DELAY_MS * 2 ** attempt);
      }
    }
  }
  throw lastError;
}

// Splits large client lists into batches so each Claude call stays well
// within output limits — richer per-client analysis takes more tokens than
// the old flat schema, and truncating a JSON response would break parsing.
// Cost is not a constraint here; correctness and depth are the priority.
// Lancer tous les batchs en même temps (l'ancien Promise.all) tient pour un
// petit CSV, mais un compte avec des milliers de clients (2000 lignes max /
// 15 par batch ≈ 134 batchs) déclenchait 134 appels Claude simultanés : de
// quoi se faire jeter par le rate limit Anthropic ou dépasser le timeout de
// la fonction serverless, précisément au moment où un gros client teste le
// produit pour la première fois. On borne donc le nombre de batchs traités
// en parallèle plutôt que de tout lancer d'un coup.
const MAX_CONCURRENT_BATCHES = 5;

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await fn(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

export async function analyzeChurnRisk(
  clients: Array<Record<string, unknown>>,
  language: AnalysisLanguage = 'fr',
  businessContext?: BusinessContext | null,
  modelTier: ModelTier = 'standard',
): Promise<ChurnAnalysisItem[]> {
  const batches: Array<Record<string, unknown>>[] = [];
  for (let i = 0; i < clients.length; i += BATCH_SIZE) {
    batches.push(clients.slice(i, i + BATCH_SIZE));
  }

  const results = await mapWithConcurrency(batches, MAX_CONCURRENT_BATCHES, (batch) =>
    analyzeChurnRiskBatch(batch, language, businessContext, modelTier),
  );
  return results.flat();
}
