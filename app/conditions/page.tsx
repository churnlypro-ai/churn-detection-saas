'use client';

import Link from 'next/link';
import Navigation from '@/components/Navigation';
import { useLanguage } from '@/lib/i18n/LanguageContext';

const CONTACT_EMAIL = 'contact@churnly.fr';
const LAST_UPDATED = { fr: '16 août 2026', en: 'August 16, 2026' };

interface Section {
  title: string;
  body: (string | { intro: string; items: string[] })[];
}

const CONTENT: Record<'fr' | 'en', { heading: string; intro: string; sections: Section[] }> = {
  fr: {
    heading: "Conditions d'utilisation",
    intro:
      "Ces conditions régissent l'utilisation de Churnly, un logiciel d'analyse du risque de désabonnement pour entreprises SaaS. En créant un compte, vous acceptez les termes ci-dessous.",
    sections: [
      {
        title: '1. Description du service',
        body: [
          "Churnly analyse les données de vos clients (importées par fichier CSV ou via une connexion Stripe en lecture seule) pour estimer, à l'aide d'un modèle d'intelligence artificielle, un risque de désabonnement par client, et générer des recommandations et alertes associées.",
        ],
      },
      {
        title: '2. Compte utilisateur',
        body: [
          "Vous devez fournir des informations exactes lors de la création de votre compte et êtes responsable de la confidentialité de vos identifiants. Toute activité effectuée depuis votre compte est réputée effectuée par vous.",
        ],
      },
      {
        title: '3. Vos données et celles de vos clients',
        body: [
          "Vous restez seul responsable de la licéité des données clients que vous importez dans Churnly (CSV ou connexion Stripe), y compris du respect de vos propres obligations envers vos clients (information, base légale de traitement). Churnly agit comme sous-traitant technique de ces données, dans les conditions décrites dans notre politique de confidentialité.",
        ],
      },
      {
        title: '4. Abonnement et paiement',
        body: [
          "Churnly propose un essai gratuit suivi d'un abonnement payant, dont le tarif dépend du nombre de clients analysés. Les paiements sont traités par Stripe. Sauf résiliation avant la fin de l'essai ou de la période en cours, l'abonnement se renouvelle automatiquement selon la périodicité choisie.",
        ],
      },
      {
        title: '5. Résiliation',
        body: [
          "Vous pouvez résilier votre abonnement à tout moment depuis votre espace /settings. La résiliation prend effet à la fin de la période en cours ; aucun remboursement au prorata n'est effectué sauf disposition légale contraire.",
        ],
      },
      {
        title: '6. Limitation de responsabilité',
        body: [
          "Les analyses et scores de risque générés par Churnly reposent sur un modèle d'intelligence artificielle et sont fournis à titre indicatif, sans garantie d'exactitude ou de résultat commercial. Ils constituent une aide à la décision et ne remplacent pas votre propre jugement métier. Churnly ne pourra être tenu responsable des décisions prises sur la base de ces analyses.",
        ],
      },
      {
        title: '7. Disponibilité du service',
        body: [
          "Nous faisons nos meilleurs efforts pour assurer la disponibilité continue du service, sans garantie de disponibilité absolue. Des interruptions ponctuelles pour maintenance peuvent survenir.",
        ],
      },
      {
        title: '8. Propriété intellectuelle',
        body: [
          "Le logiciel Churnly, sa marque et son contenu restent la propriété exclusive de Churnly. Vous conservez l'entière propriété des données que vous importez.",
        ],
      },
      {
        title: '9. Modification des conditions',
        body: [
          "Ces conditions peuvent être mises à jour ; la date de dernière mise à jour est indiquée en haut de cette page. Une utilisation continue du service après modification vaut acceptation des nouvelles conditions.",
        ],
      },
      {
        title: '10. Droit applicable',
        body: [
          "Ces conditions sont régies par le droit français. Tout litige relève de la compétence des tribunaux français, sauf disposition d'ordre public contraire.",
        ],
      },
      {
        title: '11. Contact',
        body: [`Pour toute question relative à ces conditions, écrivez-nous à ${CONTACT_EMAIL}.`],
      },
    ],
  },
  en: {
    heading: 'Terms of Use',
    intro:
      'These terms govern the use of Churnly, a churn-risk analysis tool for SaaS businesses. By creating an account, you agree to the terms below.',
    sections: [
      {
        title: '1. Service description',
        body: [
          "Churnly analyzes your customers' data (imported via CSV file or a read-only Stripe connection) to estimate a per-customer churn risk using an AI model, and to generate related recommendations and alerts.",
        ],
      },
      {
        title: '2. User account',
        body: [
          'You must provide accurate information when creating your account and are responsible for keeping your credentials confidential. Any activity performed from your account is deemed to have been performed by you.',
        ],
      },
      {
        title: '3. Your data and your customers\' data',
        body: [
          "You remain solely responsible for the lawfulness of the customer data you import into Churnly (CSV or Stripe connection), including your own obligations toward your customers (notice, legal basis for processing). Churnly acts as a technical processor of that data, as described in our privacy policy.",
        ],
      },
      {
        title: '4. Subscription and payment',
        body: [
          'Churnly offers a free trial followed by a paid subscription, priced according to the number of customers analyzed. Payments are processed by Stripe. Unless cancelled before the end of the trial or current period, the subscription renews automatically according to the chosen billing cycle.',
        ],
      },
      {
        title: '5. Cancellation',
        body: [
          'You can cancel your subscription at any time from /settings. Cancellation takes effect at the end of the current period; no pro-rated refund is issued unless required by law.',
        ],
      },
      {
        title: '6. Limitation of liability',
        body: [
          'The analyses and risk scores generated by Churnly are based on an AI model and are provided for informational purposes only, without any guarantee of accuracy or business outcome. They are a decision-support aid and do not replace your own business judgment. Churnly cannot be held liable for decisions made based on these analyses.',
        ],
      },
      {
        title: '7. Service availability',
        body: [
          'We make reasonable efforts to keep the service continuously available, without guaranteeing absolute uptime. Occasional interruptions for maintenance may occur.',
        ],
      },
      {
        title: '8. Intellectual property',
        body: [
          'The Churnly software, brand, and content remain the exclusive property of Churnly. You retain full ownership of the data you import.',
        ],
      },
      {
        title: '9. Changes to these terms',
        body: [
          'These terms may be updated; the last-updated date is shown at the top of this page. Continued use of the service after a change constitutes acceptance of the new terms.',
        ],
      },
      {
        title: '10. Governing law',
        body: [
          'These terms are governed by French law. Any dispute falls under the jurisdiction of the French courts, unless otherwise required by mandatory law.',
        ],
      },
      {
        title: '11. Contact',
        body: [`For any question about these terms, write to us at ${CONTACT_EMAIL}.`],
      },
    ],
  },
};

export default function ConditionsPage() {
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
