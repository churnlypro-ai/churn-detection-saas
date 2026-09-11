/*
# Facturation Performance : passage au cumul depuis le début

Corrige un biais réel signalé par Kevin sur le calcul mois par mois de
l'écart traité vs témoin (voir lib/performanceBilling.ts) : avec un petit
groupe témoin, l'écart mesuré chaque mois est très bruité, et facturer
l'écart quand il sort positif sans jamais corriger quand il sort négatif
biaise systématiquement le montant facturé à la hausse (simulation de
Kevin : ~23 points facturés en moyenne pour un écart réel de 15).

Cette colonne permet de calculer le montant dû sur le CUMUL de tous les
échantillons depuis le début (jamais remis à zéro chaque mois — les
mauvais mois compensent les bons), et de ne facturer chaque mois que la
différence entre ce cumul dû et ce qui a déjà été facturé jusqu'ici.
*/
alter table public.users add column if not exists performance_variable_invoiced_cents integer not null default 0;
