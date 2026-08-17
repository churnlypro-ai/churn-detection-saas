'use client';

import Link from 'next/link';
import Navigation from '@/components/Navigation';
import { useLanguage } from '@/lib/i18n/LanguageContext';

const CONTACT_EMAIL = 'contact@churnly.fr';
const LAST_UPDATED = { fr: '17 août 2026', en: 'August 17, 2026' };

interface Section {
  title: string;
  body: (string | { intro: string; items: string[] })[];
}

const CONTENT: Record<'fr' | 'en', { heading: string; intro: string; sections: Section[] }> = {
  fr: {
    heading: 'Politique de confidentialité',
    intro:
      "Churnly (\"nous\") édite un logiciel d'analyse du risque de désabonnement (churn) destiné aux entreprises SaaS. Cette politique explique quelles données nous collectons, pourquoi, et comment nous les protégeons — pour vous en tant qu'utilisateur de Churnly, et pour les données de vos propres clients que vous nous confiez.",
    sections: [
      {
        title: '1. Responsable du traitement',
        body: [
          `Churnly est responsable du traitement des données décrites dans cette politique. Pour toute question, vous pouvez nous contacter à ${CONTACT_EMAIL}.`,
        ],
      },
      {
        title: '2. Données que nous collectons',
        body: [
          {
            intro: 'Nous traitons deux catégories de données :',
            items: [
              "Vos données de compte : nom de l'entreprise, adresse email, mot de passe (chiffré), langue préférée, informations de facturation via Stripe.",
              "Les données de vos clients que vous importez : soit par fichier CSV que vous téléversez, soit via la connexion directe à votre compte Stripe (import en lecture seule des abonnements, montants et statuts de paiement). Ces données peuvent inclure des noms, des montants de revenus, des dates de renouvellement et des indicateurs d'usage.",
            ],
          },
        ],
      },
      {
        title: '3. Pourquoi nous utilisons ces données',
        body: [
          {
            intro: 'Nous utilisons ces données uniquement pour :',
            items: [
              'Générer une analyse de risque de désabonnement pour chacun de vos clients, à l\'aide d\'un modèle d\'intelligence artificielle (Anthropic Claude).',
              'Afficher votre tableau de bord et vos statistiques.',
              'Gérer votre abonnement et votre facturation (via Stripe).',
              "Vous envoyer des emails transactionnels : confirmation de compte, alertes de risque client, reçus (via Resend).",
              "Assurer la sécurité et le bon fonctionnement du service.",
            ],
          },
          "Nous ne vendons jamais vos données, ni celles de vos clients, à des tiers. Nous ne les utilisons pas à des fins publicitaires.",
        ],
      },
      {
        title: '4. Base légale',
        body: [
          "Le traitement de vos données de compte repose sur l'exécution du contrat qui nous lie (les conditions d'utilisation de Churnly). Le traitement des données clients que vous importez repose sur votre instruction en tant que responsable de traitement de ces données : vous restez responsable de la licéité de leur collecte auprès de vos propres clients, et Churnly agit en tant que sous-traitant pour les analyser.",
        ],
      },
      {
        title: '5. Sous-traitants et destinataires',
        body: [
          {
            intro: 'Pour fonctionner, Churnly fait appel aux prestataires suivants, chacun agissant comme sous-traitant technique :',
            items: [
              'Supabase — hébergement de la base de données et authentification, avec chiffrement au repos et règles d\'accès strictes (Row Level Security).',
              'Stripe — traitement des paiements et, si vous l\'activez, import en lecture seule de vos données d\'abonnements existantes.',
              'Anthropic (Claude) — analyse du risque de désabonnement à partir des données que vous fournissez, dans le seul but de produire le résultat affiché sur votre tableau de bord.',
              'Resend — envoi des emails transactionnels du service.',
              'Vercel — hébergement de l\'application et des fonctions serveur.',
            ],
          },
          "Aucun de ces prestataires n'est autorisé à utiliser vos données à d'autres fins que la fourniture du service Churnly.",
        ],
      },
      {
        title: '6. Accord de traitement des données (DPA)',
        body: [
          "Pour les données de vos propres clients que vous importez dans Churnly, nous agissons en tant que sous-traitant au sens du RGPD, et vous restez responsable de traitement. Un exemplaire de notre Accord de traitement des données (Data Processing Agreement) est disponible sur demande à " + CONTACT_EMAIL + " pour les comptes professionnels qui en ont besoin. Nous nous engageons à vous notifier tout changement de sous-traitant listé à la section 5, ainsi que toute violation de données affectant vos informations, dans les meilleurs délais et conformément aux exigences légales applicables.",
        ],
      },
      {
        title: '7. Durée de conservation',
        body: [
          "Vos données de compte sont conservées tant que votre compte est actif. À la clôture de votre compte, les données clients importées et les résultats d'analyse sont supprimés sous 30 jours, sauf obligation légale de conservation plus longue (par exemple les données de facturation, conservées conformément aux obligations comptables).",
        ],
      },
      {
        title: '8. Sécurité',
        body: [
          "L'accès aux données est protégé par authentification et par des règles de sécurité au niveau des lignes (Row Level Security) dans notre base de données : chaque utilisateur ne peut accéder qu'à ses propres données. Les connexions sont chiffrées (HTTPS/TLS). Aucun jeton d'accès Stripe n'est stocké côté serveur lors d'une connexion Stripe — seul l'identifiant du compte connecté est conservé.",
        ],
      },
      {
        title: '9. Transferts hors Union européenne',
        body: [
          "Certains de nos prestataires (Anthropic, Stripe) peuvent traiter des données depuis les États-Unis. Ces transferts s'appuient sur les garanties prévues par le RGPD (clauses contractuelles types ou mécanismes équivalents).",
        ],
      },
      {
        title: '10. Vos droits',
        body: [
          {
            intro: "Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, d'effacement, de portabilité et d'opposition sur vos données. Vous pouvez :",
            items: [
              'Modifier vos informations de compte directement depuis /settings.',
              "Supprimer les données clients importées à tout moment depuis votre tableau de bord.",
              `Nous contacter à ${CONTACT_EMAIL} pour toute autre demande, y compris la suppression complète de votre compte.`,
            ],
          },
        ],
      },
      {
        title: '11. Cookies',
        body: [
          "Churnly utilise uniquement des cookies techniques strictement nécessaires au fonctionnement du service (authentification, préférence de langue, mode sombre). Aucun cookie publicitaire ou de traçage tiers n'est utilisé.",
        ],
      },
      {
        title: '12. Modifications',
        body: [
          "Cette politique peut être mise à jour pour refléter des évolutions du service ou de la réglementation. La date de dernière mise à jour est indiquée en haut de cette page.",
        ],
      },
      {
        title: '13. Contact',
        body: [`Pour toute question relative à cette politique ou à vos données, écrivez-nous à ${CONTACT_EMAIL}.`],
      },
    ],
  },
  en: {
    heading: 'Privacy Policy',
    intro:
      "Churnly (\"we\") provides churn-risk analysis software for SaaS businesses. This policy explains what data we collect, why, and how we protect it — both for you as a Churnly user, and for your own customers' data that you entrust to us.",
    sections: [
      {
        title: '1. Data controller',
        body: [
          `Churnly is the controller for the processing described in this policy. For any question, you can reach us at ${CONTACT_EMAIL}.`,
        ],
      },
      {
        title: '2. Data we collect',
        body: [
          {
            intro: 'We process two categories of data:',
            items: [
              'Your account data: company name, email address, password (encrypted), preferred language, billing information via Stripe.',
              "Your customers' data that you import: either through a CSV file you upload, or through a direct, read-only connection to your Stripe account (subscriptions, amounts, and payment statuses). This may include names, revenue amounts, renewal dates, and usage indicators.",
            ],
          },
        ],
      },
      {
        title: '3. Why we use this data',
        body: [
          {
            intro: 'We use this data solely to:',
            items: [
              "Generate a churn-risk analysis for each of your customers, using an AI model (Anthropic Claude).",
              'Display your dashboard and statistics.',
              'Manage your subscription and billing (via Stripe).',
              'Send you transactional emails: account confirmation, customer risk alerts, receipts (via Resend).',
              'Ensure the security and proper operation of the service.',
            ],
          },
          'We never sell your data, or your customers\' data, to third parties. We do not use it for advertising purposes.',
        ],
      },
      {
        title: '4. Legal basis',
        body: [
          "Processing of your account data is based on the performance of our contract with you (Churnly's terms of use). Processing of the customer data you import is based on your instructions as the controller of that data: you remain responsible for the lawfulness of collecting it from your own customers, and Churnly acts as a processor to analyze it.",
        ],
      },
      {
        title: '5. Processors and recipients',
        body: [
          {
            intro: 'To operate, Churnly relies on the following providers, each acting as a technical processor:',
            items: [
              'Supabase — database hosting and authentication, with encryption at rest and strict access rules (Row Level Security).',
              "Stripe — payment processing and, if you enable it, read-only import of your existing subscription data.",
              'Anthropic (Claude) — churn-risk analysis based on the data you provide, solely to produce the result shown on your dashboard.',
              "Resend — delivery of the service's transactional emails.",
              'Vercel — hosting of the application and server functions.',
            ],
          },
          'None of these providers is authorized to use your data for any purpose other than delivering the Churnly service.',
        ],
      },
      {
        title: '6. Data Processing Agreement (DPA)',
        body: [
          'For your own customers\' data that you import into Churnly, we act as a processor under GDPR, and you remain the controller. A copy of our Data Processing Agreement is available on request at ' + CONTACT_EMAIL + ' for business accounts that need one. We commit to notifying you of any change to the sub-processors listed in section 5, as well as any data breach affecting your information, promptly and in line with applicable legal requirements.',
        ],
      },
      {
        title: '7. Data retention',
        body: [
          'Your account data is kept for as long as your account is active. When your account is closed, imported customer data and analysis results are deleted within 30 days, unless a longer retention period is legally required (for example billing records, kept in line with accounting obligations).',
        ],
      },
      {
        title: '8. Security',
        body: [
          'Access to data is protected by authentication and by row-level security rules in our database: each user can only access their own data. Connections are encrypted (HTTPS/TLS). No Stripe access token is stored server-side when you connect Stripe — only the connected account identifier is kept.',
        ],
      },
      {
        title: '9. Transfers outside the European Union',
        body: [
          'Some of our providers (Anthropic, Stripe) may process data from the United States. These transfers rely on GDPR-compliant safeguards (standard contractual clauses or equivalent mechanisms).',
        ],
      },
      {
        title: '10. Your rights',
        body: [
          {
            intro: 'Under GDPR, you have the right to access, rectify, erase, port, and object to the processing of your data. You can:',
            items: [
              'Update your account information directly from /settings.',
              'Delete imported customer data at any time from your dashboard.',
              `Contact us at ${CONTACT_EMAIL} for any other request, including full account deletion.`,
            ],
          },
        ],
      },
      {
        title: '11. Cookies',
        body: [
          'Churnly only uses technical cookies strictly necessary for the service to function (authentication, language preference, dark mode). No advertising or third-party tracking cookies are used.',
        ],
      },
      {
        title: '12. Changes',
        body: [
          'This policy may be updated to reflect changes to the service or applicable law. The last-updated date is shown at the top of this page.',
        ],
      },
      {
        title: '13. Contact',
        body: [`For any question about this policy or your data, write to us at ${CONTACT_EMAIL}.`],
      },
    ],
  },
};

export default function ConfidentialitePage() {
  const { language } = useLanguage();
  const c = CONTENT[language];

  return (
    <>
      <Navigation user={null} />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-sm font-medium text-brand-600 dark:text-brand-400">
          {language === 'fr' ? `Dernière mise à jour : ${LAST_UPDATED.fr}` : `Last updated: ${LAST_UPDATED.en}`}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{c.heading}</h1>
        <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-slate-400">{c.intro}</p>

        <div className="mt-12 space-y-10">
          {c.sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{section.title}</h2>
              <div className="mt-3 space-y-3">
                {section.body.map((block, i) =>
                  typeof block === 'string' ? (
                    <p key={i} className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                      {block}
                    </p>
                  ) : (
                    <div key={i}>
                      <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{block.intro}</p>
                      <ul className="mt-2 list-disc space-y-1.5 pl-5">
                        {block.items.map((item, j) => (
                          <li key={j} className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                )}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-16 border-t border-slate-100 pt-8 dark:border-slate-800">
          <Link href="/" className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300">
            {language === 'fr' ? "← Retour à l'accueil" : '← Back to home'}
          </Link>
        </div>
      </main>
    </>
  );
}
