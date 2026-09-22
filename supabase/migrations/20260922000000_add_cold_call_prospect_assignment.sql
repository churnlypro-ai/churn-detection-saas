-- Répartition des prospects cold call entre plusieurs closers (voir
-- /admin/closer-prospects et /closer) — jusqu'ici la file était partagée :
-- n'importe quel closer pouvait appeler n'importe quel prospect 'to_call'.
-- assigned_to permet de découper la file en lots dédiés (ex: 25 pour Kendal,
-- 25 pour Adam, 25 pour l'admin lui-même) pour que deux personnes n'appellent
-- jamais le même prospect le même jour.
--
-- Stocke l'email de connexion réel du closer (celui vérifié par
-- isCloserEmail dans lib/closer.ts) — /api/closer/prospects filtre
-- désormais sur cette colonne plutôt que de renvoyer toute la file.
alter table cold_call_prospects add column if not exists assigned_to text;

create index if not exists cold_call_prospects_assigned_to_idx on cold_call_prospects (assigned_to);
