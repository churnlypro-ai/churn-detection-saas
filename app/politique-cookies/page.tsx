'use client';

import Link from 'next/link';
import Navigation from '@/components/Navigation';
import FadeLine from '@/components/FadeLine';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useCookieConsent } from '@/lib/cookieConsent';

const CONTACT_EMAIL = 'contact@churnly.fr';
const LAST_UPDATED = { fr: '20 septembre 2026', en: 'September 20, 2026' };

interface Section {
  title: string;
  body: (string | { intro: string; items: string[] })[];
}

const CONTENT: Record<'fr' | 'en', { heading: string; intro: string; sections: Section[]; manageTitle: string; manageBody: string; manageButton: string }> = {
  fr: {
    heading: 'Politique de cookies',
    intro:
      "Cette page détaille précisément ce que Churnly dépose sur votre appareil, pourquoi, et comment vous pouvez refuser ce qui n'est pas strictement nécessaire. Elle complète notre politique de confidentialité.",
    sections: [
      {
        title: '1. Ce que nous entendons par « cookies »',
        body: [
          "Par souci de clarté, cette page couvre à la fois les cookies au sens strict et les technologies équivalentes (comme le stockage local de votre navigateur, « localStorage »), dès lors qu'elles permettent de mémoriser une information d'une visite à l'autre.",
        ],
      },
      {
        title: '2. Cookies et stockage strictement nécessaires',
        body: [
          {
            intro: "Ces éléments sont indispensables au fonctionnement du service et ne peuvent pas être désactivés — ils ne nécessitent pas votre consentement au sens du RGPD/ePrivacy :",
            items: [
              "Authentification (Supabase) : maintient votre session connectée. Expire à la déconnexion ou après une période d'inactivité.",
              "Préférence de langue et de thème (clair/sombre) : mémorisées dans le stockage local de votre navigateur, jamais transmises à un tiers.",
              "Votre choix sur ce bandeau de cookies lui-même (accepté/refusé) : sans lui, ce bandeau vous serait montré à chaque visite.",
            ],
          },
        ],
      },
      {
        title: '3. Mesure d\'audience (soumise à votre consentement)',
        body: [
          "Lorsque nous l'activons, Churnly utilise Google Analytics (GA4) pour comprendre l'usage global du site (pages visitées, provenance du trafic) — jamais pour vous identifier individuellement à des fins publicitaires. Ces cookies (_ga, _ga_*) ne sont déposés qu'après que vous ayez cliqué sur « Tout accepter » dans le bandeau affiché à votre première visite. Si vous cliquez sur « Refuser », ou si vous ne faites aucun choix, aucun cookie Google Analytics n'est déposé.",
          "Google peut traiter ces données aux États-Unis ; ce transfert s'appuie sur les clauses contractuelles types prévues par le RGPD. Politique de confidentialité de Google : policies.google.com/privacy.",
        ],
      },
      {
        title: '4. Attribution marketing (première partie, sans consentement requis)',
        body: [
          "Quand vous arrivez sur Churnly via un lien publicitaire ou de parrainage (paramètres ?utm_... ou ?aff= dans l'URL), nous mémorisons cette provenance dans le stockage local de votre navigateur, uniquement pour savoir quel canal vous a amené jusqu'à nous si vous créez un compte ensuite. Cette information reste sur votre appareil et n'est envoyée à nos serveurs qu'au moment de votre inscription, jamais partagée avec un tiers (contrairement à un pixel publicitaire classique) — elle n'entre donc pas dans le champ du consentement cookies.",
        ],
      },
      {
        title: '5. Gérer votre choix',
        body: [
          "Vous pouvez changer d'avis à tout moment avec le bouton ci-dessous, ou en supprimant les cookies de ce site depuis les réglages de votre navigateur.",
        ],
      },
      {
        title: '6. Contact',
        body: [`Pour toute question sur cette politique, écrivez-nous à ${CONTACT_EMAIL}.`],
      },
    ],
    manageTitle: 'Gérer mes préférences',
    manageBody: 'Votre choix actuel a été enregistré. Vous pouvez le modifier ici.',
    manageButton: 'Revoir mon choix',
  },
  en: {
    heading: 'Cookie Policy',
    intro:
      "This page details exactly what Churnly stores on your device, why, and how to refuse anything not strictly necessary. It complements our privacy policy.",
    sections: [
      {
        title: '1. What we mean by "cookies"',
        body: [
          'For clarity, this page covers both cookies in the strict sense and equivalent technologies (such as your browser\'s local storage), whenever they let us remember information from one visit to the next.',
        ],
      },
      {
        title: '2. Strictly necessary cookies and storage',
        body: [
          {
            intro: 'These are required for the service to work and cannot be turned off — they do not require your consent under GDPR/ePrivacy:',
            items: [
              'Authentication (Supabase): keeps you signed in. Expires on logout or after a period of inactivity.',
              'Language and theme (light/dark) preference: stored in your browser\'s local storage, never sent to a third party.',
              'Your choice on this cookie banner itself (accepted/rejected): without it, this banner would show on every visit.',
            ],
          },
        ],
      },
      {
        title: '3. Audience measurement (subject to your consent)',
        body: [
          'When enabled, Churnly uses Google Analytics (GA4) to understand overall site usage (pages visited, traffic source) — never to identify you individually for advertising purposes. These cookies (_ga, _ga_*) are only set after you click "Accept all" on the banner shown on your first visit. If you click "Reject," or make no choice, no Google Analytics cookie is set.',
          'Google may process this data in the United States; this transfer relies on GDPR standard contractual clauses. Google\'s privacy policy: policies.google.com/privacy.',
        ],
      },
      {
        title: '4. Marketing attribution (first-party, no consent required)',
        body: [
          'When you arrive on Churnly through an ad or referral link (?utm_... or ?aff= parameters in the URL), we store that source in your browser\'s local storage, solely to know which channel brought you if you later create an account. This information stays on your device and is only sent to our servers when you sign up, never shared with a third party (unlike a typical advertising pixel) — so it falls outside the scope of cookie consent.',
        ],
      },
      {
        title: '5. Manage your choice',
        body: [
          'You can change your mind at any time with the button below, or by clearing this site\'s cookies from your browser settings.',
        ],
      },
      {
        title: '6. Contact',
        body: [`For any question about this policy, write to us at ${CONTACT_EMAIL}.`],
      },
    ],
    manageTitle: 'Manage my preferences',
    manageBody: 'Your current choice has been saved. You can change it here.',
    manageButton: 'Review my choice',
  },
};

export default function PolitiqueCookiesPage() {
  const { language } = useLanguage();
  const { consent, resetConsent } = useCookieConsent();
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

        {consent !== null && (
          <div className="mt-10 rounded-2xl border border-slate-100 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{c.manageTitle}</h3>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">{c.manageBody}</p>
            <button
              onClick={resetConsent}
              className="mt-4 rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 dark:hover:bg-brand-500"
            >
              {c.manageButton}
            </button>
          </div>
        )}

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
