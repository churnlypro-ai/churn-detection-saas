'use client';

import Link from 'next/link';
import Navigation from '@/components/Navigation';
import FadeLine from '@/components/FadeLine';
import { useLanguage } from '@/lib/i18n/LanguageContext';

const CONTACT_EMAIL = 'contact@churnly.fr';
const LAST_UPDATED = { fr: '20 septembre 2026', en: 'September 20, 2026' };

// ⚠️ À COMPLÉTER — ces informations sont exigées par la loi française (LCEN,
// article 6-III) pour tout site édité en France, et ne peuvent pas être
// devinées ou inventées : elles doivent correspondre exactement à
// l'immatriculation réelle de l'entreprise (ou de l'entrepreneur individuel)
// qui édite Churnly. Tant qu'elles ne sont pas renseignées, cette page reste
// légalement incomplète.
const PUBLISHER = {
  // Nom de la société (raison sociale) ou nom/prénom si entrepreneur individuel.
  name: '[Nom de l\'éditeur à compléter]',
  // Forme juridique : SASU, EURL, micro-entreprise/auto-entrepreneur, etc.
  legalForm: '[Forme juridique à compléter]',
  // Uniquement si société (pas pour une micro-entreprise/entreprise individuelle).
  shareCapital: null as string | null,
  // SIREN (9 chiffres) ou SIRET (14 chiffres) de l'établissement.
  siren: '[SIREN/SIRET à compléter]',
  // Adresse du siège social ou de l'entrepreneur individuel.
  address: '[Adresse à compléter]',
  // Nom de la personne responsable de la publication (généralement le
  // dirigeant ou l'entrepreneur individuel lui-même).
  publicationDirector: '[Nom du directeur de publication à compléter]',
};

const HOST = {
  name: 'Vercel Inc.',
  address: '440 N Barranca Avenue #4133, Covina, CA 91723, États-Unis',
};

interface Section {
  title: string;
  body: (string | { intro: string; items: string[] })[];
}

const CONTENT: Record<'fr' | 'en', { heading: string; intro: string; sections: Section[] }> = {
  fr: {
    heading: 'Mentions légales',
    intro:
      "Conformément à la loi n°2004-575 du 21 juin 2004 pour la confiance dans l'économie numérique (LCEN), voici les informations d'identification du site Churnly.",
    sections: [
      {
        title: '1. Éditeur du site',
        body: [
          {
            intro: '',
            items: [
              `Nom : ${PUBLISHER.name}`,
              `Forme juridique : ${PUBLISHER.legalForm}`,
              ...(PUBLISHER.shareCapital ? [`Capital social : ${PUBLISHER.shareCapital}`] : []),
              `SIREN/SIRET : ${PUBLISHER.siren}`,
              `Siège social : ${PUBLISHER.address}`,
              `Contact : ${CONTACT_EMAIL}`,
            ],
          },
        ],
      },
      {
        title: '2. Directeur de la publication',
        body: [`${PUBLISHER.publicationDirector}.`],
      },
      {
        title: '3. Hébergement',
        body: [
          {
            intro: 'Le site Churnly est hébergé par :',
            items: [`${HOST.name}, ${HOST.address}.`],
          },
        ],
      },
      {
        title: '4. Propriété intellectuelle',
        body: [
          "L'ensemble des éléments du site Churnly (textes, logos, interface, code) est protégé par le droit de la propriété intellectuelle et reste la propriété exclusive de l'éditeur, sauf mention contraire.",
        ],
      },
      {
        title: '5. Protection des données personnelles',
        body: [
          "Le traitement des données personnelles collectées via ce site est détaillé dans notre ",
        ],
      },
      {
        title: '6. Contact',
        body: [`Pour toute question relative à ces mentions légales, écrivez-nous à ${CONTACT_EMAIL}.`],
      },
    ],
  },
  en: {
    heading: 'Legal Notice',
    intro:
      "In accordance with French law n°2004-575 of 21 June 2004 for confidence in the digital economy (LCEN), here is the identification information for the Churnly website.",
    sections: [
      {
        title: '1. Site publisher',
        body: [
          {
            intro: '',
            items: [
              `Name: ${PUBLISHER.name}`,
              `Legal form: ${PUBLISHER.legalForm}`,
              ...(PUBLISHER.shareCapital ? [`Share capital: ${PUBLISHER.shareCapital}`] : []),
              `SIREN/SIRET (French business ID): ${PUBLISHER.siren}`,
              `Registered address: ${PUBLISHER.address}`,
              `Contact: ${CONTACT_EMAIL}`,
            ],
          },
        ],
      },
      {
        title: '2. Publication director',
        body: [`${PUBLISHER.publicationDirector}.`],
      },
      {
        title: '3. Hosting',
        body: [
          {
            intro: 'The Churnly website is hosted by:',
            items: [`${HOST.name}, ${HOST.address}.`],
          },
        ],
      },
      {
        title: '4. Intellectual property',
        body: [
          'All elements of the Churnly website (text, logos, interface, code) are protected by intellectual property law and remain the exclusive property of the publisher, unless otherwise stated.',
        ],
      },
      {
        title: '5. Personal data protection',
        body: [
          'The processing of personal data collected through this site is detailed in our ',
        ],
      },
      {
        title: '6. Contact',
        body: [`For any question about this legal notice, write to us at ${CONTACT_EMAIL}.`],
      },
    ],
  },
};

export default function MentionsLegalesPage() {
  const { language } = useLanguage();
  const c = CONTENT[language];
  const isIncomplete = PUBLISHER.name.startsWith('[');

  return (
    <>
      <Navigation user={null} />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-sm font-medium text-brand-600 dark:text-brand-400">
          {language === 'fr' ? `Dernière mise à jour : ${LAST_UPDATED.fr}` : `Last updated: ${LAST_UPDATED.en}`}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{c.heading}</h1>
        <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-slate-400">{c.intro}</p>

        {isIncomplete && (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-500/10 dark:text-amber-400">
            {language === 'fr'
              ? "⚠️ Page incomplète : les informations d'identification de l'éditeur (nom, forme juridique, SIREN/SIRET, adresse) doivent être renseignées dans le code (PUBLISHER, en haut de app/mentions-legales/page.tsx) avant publication — obligation légale, non facultative."
              : '⚠️ Incomplete page: the publisher identification details (name, legal form, SIREN/SIRET, address) must be filled in the code (PUBLISHER, at the top of app/mentions-legales/page.tsx) before this goes live — a legal requirement, not optional.'}
          </div>
        )}

        <div className="mt-12 space-y-10">
          {c.sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{section.title}</h2>
              <div className="mt-3 space-y-3">
                {section.body.map((block, i) =>
                  typeof block === 'string' ? (
                    <p key={i} className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                      {block}
                      {section.title.startsWith('5') && (
                        <Link href="/confidentialite" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
                          {language === 'fr' ? 'politique de confidentialité' : 'privacy policy'}
                        </Link>
                      )}
                      {section.title.startsWith('5') && '.'}
                    </p>
                  ) : (
                    <div key={i}>
                      {block.intro && <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{block.intro}</p>}
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
