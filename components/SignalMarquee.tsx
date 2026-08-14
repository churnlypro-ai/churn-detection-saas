'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, TrendingDown, CreditCard, AlertTriangle, Calendar, ArrowUpRight, Mail,
  UserCog, Euro, ShoppingCart, Rocket, History, Clock3, Ticket, RotateCcw, WifiOff, Frown,
  MailOpen, BellOff, ArrowDownRight, Undo2, ThumbsDown, HelpCircle, UserMinus, PhoneOff,
  Layers, Activity, RefreshCw, ExternalLink, Download, Timer, UserX, Smartphone, Receipt,
  Hourglass, Shuffle, Percent,
} from 'lucide-react';
import { EASE_OUT } from '@/lib/animations';

const SIGNALS = [
  { icon: WifiOff, label: 'Inactivité prolongée', detail: 'Un client qui ne se connecte plus depuis plusieurs semaines a de fortes chances d\'avoir déjà mentalement quitté le produit, même si l\'abonnement est encore actif.' },
  { icon: TrendingDown, label: 'Baisse de fréquence de connexion', detail: 'Une baisse progressive du nombre de connexions sur plusieurs semaines est souvent le tout premier signal, bien avant l\'inactivité totale.' },
  { icon: Mail, label: 'Ticket support sans réponse', detail: 'Un ticket resté sans réponse plus de 48h envoie un message clair : le client se sent ignoré, et cherche déjà des alternatives.' },
  { icon: CreditCard, label: 'Retard de paiement récurrent', detail: 'Un seul retard peut être un oubli. Deux ou trois retards sur un trimestre trahissent souvent un désengagement plus profond.' },
  { icon: AlertTriangle, label: 'Statut de paiement en échec', detail: 'Une carte expirée ou un paiement refusé qui n\'est pas régularisé rapidement est l\'un des signaux les plus fiables de churn imminent.' },
  { icon: Frown, label: 'Baisse d\'usage produit', detail: 'Un client qui utilise de moins en moins de fonctionnalités n\'y trouve plus la même valeur qu\'au départ.' },
  { icon: Calendar, label: 'Renouvellement imminent', detail: 'Un client à risque dont l\'échéance de renouvellement approche mérite une action immédiate, pas dans deux semaines.' },
  { icon: ArrowUpRight, label: 'Score de risque en hausse', detail: 'Ce n\'est pas juste le score du moment qui compte, mais sa trajectoire : un score qui grimpe vite est un signal d\'urgence.' },
  { icon: Clock, label: 'Silence après une relance', detail: 'Un client qui ne répond pas à une tentative de contact confirme souvent un désengagement déjà bien avancé.' },
  { icon: UserCog, label: 'Changement de contact décisionnaire', detail: 'Quand la personne qui utilisait le produit quitte l\'entreprise ou change de poste, la relation entière est à reconstruire.' },
  { icon: Euro, label: 'Baisse du chiffre d\'affaires généré', detail: 'Une baisse de revenu sur un compte peut annoncer une réduction d\'usage avant l\'annulation complète.' },
  { icon: ShoppingCart, label: 'Réduction de la fréquence d\'achat', detail: 'Pour un e-commerce, un client qui espace ses commandes signale un désintérêt progressif, bien avant qu\'il ne parte pour de bon.' },
  { icon: Rocket, label: 'Aucune interaction depuis l\'onboarding', detail: 'Un client qui n\'a jamais vraiment démarré n\'a jamais eu l\'occasion de voir la valeur du produit — le risque est là dès le premier mois.' },
  { icon: History, label: 'Historique d\'annulations similaires', detail: 'Un profil de client qui ressemble à d\'autres clients déjà partis dans des circonstances similaires est un signal à prendre au sérieux.' },
  { icon: Clock3, label: 'Délai de réponse aux emails en hausse', detail: 'Un client qui met de plus en plus de temps à répondre montre que la relation devient moins prioritaire pour lui.' },
  { icon: Ticket, label: 'Tickets support en augmentation', detail: 'Une multiplication des tickets sur une courte période traduit souvent une frustration croissante, pas juste plus de questions.' },
  { icon: RotateCcw, label: 'Contrat précédent non renouvelé', detail: 'Un client qui a déjà laissé filer un renouvellement par le passé, même régularisé ensuite, garde un profil de risque plus élevé.' },
  { icon: MailOpen, label: 'Baisse du taux d\'ouverture des emails', detail: 'Un client qui n\'ouvre plus vos emails a réduit son attention au strict minimum — le lien s\'effiloche avant même l\'annulation.' },
  { icon: BellOff, label: 'Désabonnement des communications', detail: 'Se désinscrire des newsletters produit est souvent un signe précoce de désengagement, bien avant de penser à annuler l\'abonnement.' },
  { icon: ArrowDownRight, label: 'Downgrade vers une offre inférieure', detail: 'Réduire son plan est rarement anodin : c\'est souvent la dernière étape avant l\'annulation complète.' },
  { icon: Undo2, label: 'Demande de remboursement récente', detail: 'Une demande de remboursement, même ponctuelle, révèle une insatisfaction qu\'il faut traiter immédiatement.' },
  { icon: ThumbsDown, label: 'Note de satisfaction basse', detail: 'Un score de satisfaction (NPS/CSAT) en baisse est un indicateur avancé, souvent visible des semaines avant l\'annulation.' },
  { icon: HelpCircle, label: 'Absence de réponse à une enquête', detail: 'Ne pas répondre à une enquête de satisfaction peut sembler anodin, mais reflète souvent un désintérêt déjà installé.' },
  { icon: UserMinus, label: 'Réduction du nombre de licences', detail: 'Un compte qui retire des sièges/licences réduit son engagement avant, parfois, de tout arrêter.' },
  { icon: PhoneOff, label: 'Absence à un appel de renouvellement', detail: 'Un client qui esquive les échanges autour du renouvellement a souvent déjà pris sa décision.' },
  { icon: Layers, label: 'Usage limité à une seule fonctionnalité', detail: 'Un client qui n\'explore jamais au-delà d\'une fonctionnalité de base n\'a pas découvert toute la valeur du produit — et reste fragile.' },
  { icon: Activity, label: 'Pic d\'activité suivi d\'un arrêt brutal', detail: 'Un usage intense qui s\'arrête net est parfois plus inquiétant qu\'un déclin progressif : quelque chose a changé du jour au lendemain.' },
  { icon: RefreshCw, label: 'Même ticket signalé plusieurs fois', detail: 'Un même problème signalé à plusieurs reprises montre que la première réponse n\'a pas suffi — la frustration s\'accumule.' },
  { icon: ExternalLink, label: 'Mention d\'un concurrent en support', detail: 'Quand un client compare ouvertement avec une alternative, il a déjà commencé à regarder ailleurs.' },
  { icon: Download, label: 'Export de données massif', detail: 'Exporter ses données en masse précède souvent, de peu, une migration vers un autre outil.' },
  { icon: Timer, label: 'Durée de session en baisse', detail: 'Des sessions de plus en plus courtes traduisent un désintérêt progressif, même si la fréquence de connexion reste stable.' },
  { icon: UserX, label: 'Aucun utilisateur actif sur le compte', detail: 'Un compte payé mais dont plus personne ne se connecte est un signal fort, quel que soit le nombre de licences.' },
  { icon: Smartphone, label: 'Arrêt de l\'usage mobile', detail: 'Un client qui utilisait l\'app mobile et ne le fait plus a modifié ses habitudes — un changement à comprendre.' },
  { icon: Receipt, label: 'Changement de contact facturation', detail: 'Un changement de contact côté facturation accompagne souvent une réorganisation interne qui met la relation à risque.' },
  { icon: Hourglass, label: 'Essai jamais transformé en usage réel', detail: 'Un compte resté au stade de l\'essai sans jamais vraiment démarrer n\'a jamais eu la chance de voir la valeur du produit.' },
  { icon: Shuffle, label: 'Fréquence de connexion très irrégulière', detail: 'Des pics suivis de longs silences trahissent une relation devenue occasionnelle plutôt que régulière.' },
  { icon: Percent, label: 'Historique de renégociation tarifaire', detail: 'Un client qui a déjà demandé une réduction par le passé reste plus sensible au prix, et donc plus à risque.' },
];

export default function SignalMarquee() {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div>
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-white to-transparent dark:from-slate-950 sm:w-32" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-white to-transparent dark:from-slate-950 sm:w-32" />

        <div className="marquee-track flex w-max gap-4">
          {[...SIGNALS, ...SIGNALS].map((signal, i) => {
            const originalIndex = i % SIGNALS.length;
            const isActive = selected === originalIndex;
            return (
              <button
                key={i}
                onClick={() => setSelected(isActive ? null : originalIndex)}
                className={`flex flex-shrink-0 items-center gap-2.5 rounded-2xl border px-5 py-3.5 text-left transition ${
                  isActive
                    ? 'border-brand-400 bg-brand-50 dark:border-brand-600 dark:bg-brand-500/10'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:bg-slate-800'
                }`}
              >
                <signal.icon className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400 dark:text-slate-500'}`} />
                <span className={`whitespace-nowrap text-sm font-medium ${isActive ? 'text-brand-700 dark:text-brand-400' : 'text-slate-700 dark:text-slate-300'}`}>
                  {signal.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {selected !== null ? (
          <motion.div
            key={selected}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25, ease: EASE_OUT }}
            className="mx-auto mt-8 max-w-xl rounded-2xl border border-brand-100 bg-brand-50/50 p-6 text-center dark:border-brand-800/40 dark:bg-brand-500/5"
          >
            <p className="text-sm font-semibold text-brand-700 dark:text-brand-400">{SIGNALS[selected].label}</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{SIGNALS[selected].detail}</p>
          </motion.div>
        ) : (
          <motion.p
            key="placeholder"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-8 text-center text-sm text-slate-400 dark:text-slate-500"
          >
            Cliquez sur un signal pour voir pourquoi il compte.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
