interface SupabaseLikeError {
  code?: string;
  message?: string;
}

// Postgres 42P01 = "undefined_table" — la façon la plus fiable de détecter
// une migration jamais appliquée plutôt qu'une vraie panne, pour donner un
// message exploitable au lieu d'un générique "échoué" qui avale la vraie
// cause (voir le bug de la file LinkedIn : la table n'existait pas encore
// et chaque route renvoyait un message trop vague pour le diagnostiquer).
export function isMissingTableError(error: SupabaseLikeError | null | undefined): boolean {
  if (!error) return false;
  return error.code === '42P01' || /relation .* does not exist/i.test(error.message ?? '');
}

export function missingTableMessage(migrationFile: string): string {
  return `La table nécessaire n'existe pas encore en base — la migration Supabase (${migrationFile}) doit d'abord être appliquée manuellement via le SQL Editor Supabase.`;
}
