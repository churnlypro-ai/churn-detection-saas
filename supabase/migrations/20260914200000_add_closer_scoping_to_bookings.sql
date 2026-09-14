/*
# Split closer_availability and call_bookings by closer

"chaqun son compte avec leur reservation qui il doivent appeller" covered
two things: the cold-call prospect list (already split today, see
add_prospect_assignment) and bookings ("réservation" — the call requests
from the public "Réserver un call" form). This migration does the second
half: closer_availability and call_bookings were both built back when
there was a single closer (see add_closer_availability: "un seul closer,
un seul fuseau pour l'instant") and are still fully shared — any closer
sees and can confirm/cancel every booking, and all closers' working hours
mix into one pooled calendar with no way to tell whose slot is whose.

1. closer_availability.closer_email
   - Set by the server from the authenticated closer on every new row
     (app/api/closer/availability), never trusted from the client — same
     pattern as everywhere else a value must not be user-supplied.
   - Existing rows predate this column and can't be attributed reliably,
     but per this session's history Adam (adamyou693@gmail.com) was the
     sole closer before Kendal joined, so backfilling to him keeps his
     existing weekly schedule visible in his own management view instead
     of silently vanishing.

2. call_bookings.closer_email
   - Set at booking-creation time (app/api/call-bookings) by matching the
     chosen slot_start against closer_availability, server-side — a
     visitor never picks a closer explicitly, the public form is
     unchanged. Free-text bookings (no slot_start) or a slot that matches
     no availability window keep closer_email null, and stay visible to
     every closer — a deliberate shared fallback so nothing silently
     disappears from everyone's queue.
*/

alter table public.closer_availability add column if not exists closer_email text;
alter table public.call_bookings add column if not exists closer_email text;

update public.closer_availability
  set closer_email = 'adamyou693@gmail.com'
  where closer_email is null;

create index if not exists closer_availability_closer_email_idx on public.closer_availability(closer_email);
create index if not exists call_bookings_closer_email_idx on public.call_bookings(closer_email);
