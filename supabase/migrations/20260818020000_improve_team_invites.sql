/*
# Team invites: expiration + delivery status

The invite flow had two silent gaps:
- /api/team/invite swallowed a failed Resend send behind console.error and
  still told the owner "success" — a broken email provider meant invites
  quietly went nowhere with no way for the owner to notice.
- invite_token never expired, so a link sent months ago (possibly to the
  wrong person, or leaked) stayed valid forever.

1. New columns on team_members
- `expires_at`: 7 days from creation (backfilled from created_at for
  existing rows, defaults to now()+7d for new ones). /api/team/accept
  rejects an expired token instead of accepting it.
- `email_status`: 'pending' | 'sent' | 'failed', set by /api/team/invite
  right after the Resend call so the owner-facing UI can show the real
  outcome (and a copyable link) instead of a blind "invitation sent".
*/

alter table public.team_members
  add column if not exists expires_at timestamptz,
  add column if not exists email_status text not null default 'pending' check (email_status in ('pending', 'sent', 'failed'));

update public.team_members set expires_at = created_at + interval '7 days' where expires_at is null;

alter table public.team_members
  alter column expires_at set not null,
  alter column expires_at set default (now() + interval '7 days');
