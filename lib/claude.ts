import Anthropic from '@anthropic-ai/sdk';

let anthropicClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

const ANALYSIS_SYSTEM_PROMPT = `Tu es un analyste churn expert pour des entreprises SaaS et agences. On te fournit des données réelles sur des clients (inactivité, tickets support, usage, statut de paiement, revenue, et tout autre champ présent). Ton travail est chirurgical: chaque affirmation doit être justifiée par une vraie valeur des données fournies. N'invente jamais une donnée qui n'est pas dans l'input.

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
): Promise<EmailTemplate> {
  const client_for = TEMPLATE_PROMPTS[templateId] ?? TEMPLATE_PROMPTS.direct;
  const clientInstance = getClient();

  const systemPrompt = `Tu es un expert en rétention client B2B. Tu écris des emails personnalisés pour sauver des clients à risque de churn.
Règles:
- JAMAIS de culpabilisation ("tu n'es pas venu", "tu n'utilises pas")
- Toujours orienté SOLUTION: "voici comment on l'arrange"
- Ton humain, pas robot
- Base-toi précisément sur les facteurs de risque et l'action recommandée fournis pour CE client — ne généralise pas
- Inclus l'offre ou la proposition de manière naturelle
- Maximum 150 mots, concis et percutant
- Pas de "Dear" ou formules rigides, tutoiement
- Réponds UNIQUEMENT avec un JSON: {"subject": "...", "body": "..."}`;

  const riskFactorsText = client.risk_factors?.length
    ? client.risk_factors.map((f) => `- ${f.factor} (${f.weight}): ${f.evidence}`).join('\n')
    : 'Non détaillé.';
  const recommendedActionsText = client.recommended_actions?.length
    ? client.recommended_actions.map((a) => `- [${a.type}] ${a.detail} — pourquoi: ${a.expected_impact}`).join('\n')
    : `${client.solution}`;

  const message = await clientInstance.messages.create({
    model: 'claude-sonnet-4-20250514',
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
- Revenue mensuel: €${client.revenue_monthly ?? 0}

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

async function analyzeChurnRiskBatch(clients: Array<Record<string, unknown>>): Promise<ChurnAnalysisItem[]> {
  const client = getClient();

  const message = await client.messages.create({
    model: 'claude-opus-5',
    max_tokens: 8192,
    system: ANALYSIS_SYSTEM_PROMPT,
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

// Splits large client lists into batches so each Claude call stays well
// within output limits — richer per-client analysis takes more tokens than
// the old flat schema, and truncating a JSON response would break parsing.
// Cost is not a constraint here; correctness and depth are the priority.
export async function analyzeChurnRisk(
  clients: Array<Record<string, unknown>>,
): Promise<ChurnAnalysisItem[]> {
  const batches: Array<Record<string, unknown>>[] = [];
  for (let i = 0; i < clients.length; i += BATCH_SIZE) {
    batches.push(clients.slice(i, i + BATCH_SIZE));
  }

  const results = await Promise.all(batches.map((batch) => analyzeChurnRiskBatch(batch)));
  return results.flat();
}
