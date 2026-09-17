-- Simplification demandée : plus d'étape de relecture avant publication
-- (voir 20260917000000_add_testimonials.sql pour le design d'origine) — un
-- avis soumis depuis /avis est publié immédiatement, et /admin/testimonials
-- devient un espace pour AJOUTER des avis directement (pas liés à un compte
-- client réel) en plus de les consulter/supprimer. user_id devient donc
-- optionnel : NULL pour un avis ajouté à la main par un admin, toujours
-- rempli pour un avis soumis par un vrai client connecté.
--
-- La contrainte "un avis par client" reste utile (empêche un même compte de
-- spammer /avis) mais ne peut plus être une contrainte UNIQUE simple sur
-- toute la colonne une fois NULL autorisé (plusieurs lignes à NULL sont
-- permises par une UNIQUE classique en Postgres, donc ça n'aurait de toute
-- façon rien empêché) — remplacée par un index unique partiel qui ne
-- s'applique qu'aux lignes où user_id n'est pas NULL.
alter table testimonials alter column user_id drop not null;
alter table testimonials drop constraint if exists testimonials_user_id_key;
create unique index if not exists testimonials_user_id_unique_idx on testimonials (user_id) where user_id is not null;
