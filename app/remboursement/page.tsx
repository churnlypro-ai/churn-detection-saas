'use client';

import Link from 'next/link';
import Navigation from '@/components/Navigation';
import FadeLine from '@/components/FadeLine';
import { useLanguage } from '@/lib/i18n/LanguageContext';

const CONTACT_EMAIL = 'contact@churnly.fr';
const LAST_UPDATED = { fr: '20 septembre 2026', en: 'September 20, 2026' };

interface Section {
  title: string;
  body: (string | { intro: string; items: string[] })[];
}

const CONTENT: Record<'fr' | 'en', { heading: string; intro: string; sections: Section[] }> = {
  fr: {
    heading: 'Politique de remboursement',
    intro:
      "Cette page précise les règles applicables à votre abonnement Churnly. Elle complète nos conditions d'utilisation.",
    sections: [
      {
        title: '1. Essai gratuit',
        body: [
          "Chaque compte bénéficie d'une première analyse gratuite à l'inscription, sans engagement ni carte bancaire requise. Aucune question de remboursement ne se pose tant que vous n'êtes pas passé à l'abonnement payant.",
        ],
      },
      {
        title: '2. Abonnement payant',
        body: [
          "Churnly est un service utilisé dans le cadre de votre activité professionnelle (analyse de vos propres clients). Une fois votre abonnement souscrit, l'accès au service est activé immédiatement et le tarif correspondant vous est facturé selon la périodicité choisie (mensuelle ou annuelle).",
        ],
      },
      {
        title: '3. Pas de remboursement discrétionnaire',
        body: [
          "Sauf disposition légale contraire (voir section 4), Churnly n'offre pas de remboursement, total ou partiel, pour un mois ou une année déjà entamés — y compris en cas de résiliation en cours de période. Vous pouvez résilier à tout moment depuis /settings : la résiliation prend effet à la fin de la période en cours, et vous conservez l'accès jusqu'à cette date sans reconduction ultérieure.",
        ],
      },
      {
        title: '4. Droit de rétractation',
        body: [
          "Churnly est un service destiné aux professionnels (dirigeants et entreprises) dans le cadre direct de leur activité. Le délai de rétractation de 14 jours prévu par le Code de la consommation pour les achats en ligne s'applique aux consommateurs particuliers et ne couvre en principe pas ce type d'usage professionnel. Si vous estimez relever d'un régime de protection spécifique (par exemple non-professionnel au sens du droit applicable), contactez-nous : nous examinerons votre situation au cas par cas.",
        ],
      },
      {
        title: '5. Erreurs de facturation',
        body: [
          {
            intro: 'Nous remboursons intégralement et sans délai toute erreur de notre fait, notamment :',
            items: [
              'Un double prélèvement pour la même période.',
              "Un montant facturé différent de celui affiché au moment de la souscription.",
              "Un prélèvement effectué après une résiliation déjà prise en compte.",
            ],
          },
          `Signalez toute erreur de ce type à ${CONTACT_EMAIL} — nous traitons ces demandes en priorité.`,
        ],
      },
      {
        title: '6. Paiements et contestations (Stripe)',
        body: [
          "Tous les paiements sont traités par Stripe. En cas de désaccord non résolu directement avec nous, vous conservez la possibilité de contester un prélèvement auprès de votre banque ou de Stripe, conformément aux conditions de votre moyen de paiement.",
        ],
      },
      {
        title: '7. Contact',
        body: [`Pour toute question relative à votre facturation, écrivez-nous à ${CONTACT_EMAIL}.`],
      },
    ],
  },
  en: {
    heading: 'Refund Policy',
    intro:
      "This page details the rules that apply to your Churnly subscription. It complements our terms of use.",
    sections: [
      {
        title: '1. Free trial',
        body: [
          "Every account gets one free analysis at signup, with no commitment and no card required. No refund question arises before you move to a paid subscription.",
        ],
      },
      {
        title: '2. Paid subscription',
        body: [
          "Churnly is a service used in the course of your professional activity (analyzing your own customers). Once you subscribe, access to the service is activated immediately and you are billed the corresponding price on the billing cycle you chose (monthly or annual).",
        ],
      },
      {
        title: '3. No discretionary refunds',
        body: [
          "Unless legally required otherwise (see section 4), Churnly does not offer full or partial refunds for a month or year already started — including if you cancel partway through a period. You can cancel any time from /settings: cancellation takes effect at the end of the current period, and you keep access until then with no further renewal.",
        ],
      },
      {
        title: '4. Right of withdrawal',
        body: [
          "Churnly is a service intended for professionals (business owners and companies) used directly in the course of their business. The 14-day withdrawal period set by French consumer law for online purchases applies to individual consumers and generally does not cover this kind of professional use. If you believe you fall under a specific protection regime (for example, a non-professional under applicable law), contact us — we will review your situation case by case.",
        ],
      },
      {
        title: '5. Billing errors',
        body: [
          {
            intro: 'We refund in full and promptly any error on our part, including:',
            items: [
              'A duplicate charge for the same period.',
              'An amount billed different from what was shown at the time of subscribing.',
              'A charge made after a cancellation we had already processed.',
            ],
          },
          `Report any such error to ${CONTACT_EMAIL} — we handle these requests as a priority.`,
        ],
      },
      {
        title: '6. Payments and disputes (Stripe)',
        body: [
          'All payments are processed by Stripe. If a disagreement is not resolved directly with us, you retain the ability to dispute a charge with your bank or Stripe, in line with the terms of your payment method.',
        ],
      },
      {
        title: '7. Contact',
        body: [`For any billing question, write to us at ${CONTACT_EMAIL}.`],
      },
    ],
  },
};

export default function RemboursementPage() {
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

        <div className="relative mt-16 pt-8">
          <FadeLine className="top-0" />
          <Link href="/" className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300">
            {language === 'fr' ? "← Retour à l'accueil" : '← Back to home'}
          </Link>
        </div>
      </main>
    </>
  );
}
