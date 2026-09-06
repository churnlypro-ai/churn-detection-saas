// Remplace un `border-t`/`border-b` classique (une ligne pleine, dure,
// visible du premier au dernier pixel) par une ligne qui s'estompe aux deux
// extrémités — utilisé partout où une transition entre deux blocs (nav,
// section, footer) doit rester discrète plutôt que de trancher net. Le
// parent doit être positionné (relative/sticky/absolute) pour que `inset-x-0`
// s'aligne correctement.
export default function FadeLine({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent dark:via-slate-800 ${className}`}
    />
  );
}
