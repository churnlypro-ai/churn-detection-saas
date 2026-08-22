/*
# Ajoute l'email du client à risque sur analysis_results

Jusqu'ici, ni l'upload CSV (colonnes attendues : name, revenue_monthly,
days_since_last_login, support_tickets_open, payment_status,
renewal_date — pas d'email) ni l'import Stripe Connect (l'email du
customer Stripe était récupéré mais seulement utilisé comme repli pour
le nom, jamais conservé) ne stockaient d'adresse email exploitable pour
un client à risque. Sans ça, aucun envoi automatique réel vers CE
client n'est possible — seulement vers le compte Churnly lui-même
(voir app/api/send-email).

Colonne nullable et additive : les clients déjà analysés sans email
restent lisibles, simplement sans email tant qu'un nouvel import ne
leur en fournit pas un.
*/

alter table public.analysis_results
  add column if not exists client_email text;
