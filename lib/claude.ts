import Anthropic from '@anthropic-ai/sdk';

let anthropicClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

const SYSTEM_PROMPT = `Tu es un analyste churn expert pour des entreprises SaaS et agences.
Analyse les données clients fournies. Pour CHAQUE client, retourne:
1. Un score de churn (0-100) basé sur les vrais signaux fournis (inactivité, tickets support, baisse d'usage, statut de paiement)
2. La raison principale du risque, spécifique au client (pas générique)
3. Une action recommandée concrète et adaptée (email / appel / offre), avec des détails précis (ex: montant d'une offre, délai)

Sois précis et base-toi uniquement sur les données fournies. Ne génère jamais de texte générique du type "vérifier l'engagement" sans détail. Réponds UNIQUEMENT avec un JSON valide respectant exactement ce schéma, sans texte autour:

{
  "analysis": [
    {
      "client_name": "string",
      "churn_score": 0,
      "reason": "string",
      "recommended_action": "string",
      "confidence": 0.0
    }
  ]
}`;

export interface ChurnAnalysisItem {
  client_name: string;
  churn_score: number;
  reason: string;
  recommended_action: string;
  confidence: number | null;
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
  client: { client_name: string; churn_score: number; reason: string; solution: string; revenue_monthly?: number },
): Promise<EmailTemplate> {
  const client_for = TEMPLATE_PROMPTS[templateId] ?? TEMPLATE_PROMPTS.direct;
  const clientInstance = getClient();

  const systemPrompt = `Tu es un expert en rétention client B2B. Tu écris des emails personnalisés pour sauver des clients à risque de churn.
Règles:
- JAMAIS de culpabilisation ("tu n'es pas venu", "tu n'utilises pas")
- Toujours orienté SOLUTION: "voici comment on l'arrange"
- Ton humain, pas robot
- Inclus l'offre ou la proposition de manière naturelle
- Personnalise avec les données du client (raison du risque, revenue)
- Maximum 150 mots, concis et percutant
- Pas de "Dear" ou formules rigides, tutoiement
- Réponds UNIQUEMENT avec un JSON: {"subject": "...", "body": "..."}`;

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
- Solution recommandée: ${client.solution}
- Revenue mensuel: €${client.revenue_monthly ?? 0}

Écris un email personnalisé pour ce client avec ce template.`,
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

export async function analyzeChurnRisk(
  clients: Array<Record<string, unknown>>,
): Promise<ChurnAnalysisItem[]> {
  const client = getClient();

  const message = await client.messages.create({
    model: 'claude-opus-5',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
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

  const parsed = JSON.parse(jsonMatch[0]) as { analysis: ChurnAnalysisItem[] };
  if (!Array.isArray(parsed.analysis)) {
    throw new Error('Claude response missing analysis array');
  }

  return parsed.analysis.map((item) => ({
    client_name: String(item.client_name ?? 'Unknown'),
    churn_score: Math.max(0, Math.min(100, Math.round(Number(item.churn_score) || 0))),
    reason: String(item.reason ?? ''),
    recommended_action: String(item.recommended_action ?? ''),
    confidence: typeof item.confidence === 'number' ? item.confidence : null,
  }));
}
