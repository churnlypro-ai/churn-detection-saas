/*
# Empêcher le double-booking d'un même créneau au niveau base

/api/call-bookings vérifie déjà qu'aucune réservation active n'existe sur
le créneau demandé avant d'insérer (lire-puis-écrire) — mais rien n'empêche
deux visiteurs de passer ce contrôle en même temps sur le même créneau
avant qu'aucun des deux inserts n'ait atterri : les deux passent, les deux
insèrent, le closer se retrouve avec deux rendez-vous sur le même horaire.

Un index unique partiel ferme cette fenêtre au niveau Postgres, qui
sérialise les insertions concurrentes : la seconde insertion sur le même
slot_start échoue avec une violation de contrainte (code 23505) plutôt que
de réussir silencieusement. Partiel pour deux raisons : les anciennes
lignes en texte libre ont slot_start = null (ne doit jamais entrer en
conflit) et une réservation annulée ne doit plus bloquer ce créneau pour
quelqu'un d'autre.
*/

create unique index if not exists call_bookings_slot_start_active_unique
  on public.call_bookings (slot_start)
  where slot_start is not null and status <> 'canceled';
