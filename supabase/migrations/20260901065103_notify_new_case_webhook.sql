-- Database Webhook: skickar ett mail till admin varje gång ett nytt ärende
-- skapas i public.cases. Anropar Edge Function "notify-new-case"
-- (../functions/notify-new-case/index.ts), som i sin tur skickar mailet via
-- Resend. Ärendet i databasen påverkas aldrig av att mailutskicket misslyckas
-- - se felhanteringen i Edge Function-koden.
--
-- OBS: skrevs först mot "supabase_functions"."http_request" (det Dashboardens
-- Database Webhooks-UI genererar), men det schemat fanns inte i det här
-- projektet ("ERROR: 3F000: schema supabase_functions does not exist") -
-- Supabase provisionerar det schemat först när man skapar en webhook via
-- Dashboard-UI:t minst en gång, inte bara för att pg_net är aktiverat.
-- Migrationen är därför omskriven till att gå direkt via pg_net
-- (net.http_post), vilket bygger exakt samma payload-form
-- ({type, table, schema, record, old_record}) som Edge Function redan
-- förväntar sig - ingen ändring behövs i index.ts.
--
-- KÖR INTE DENNA FIL RAKT AV - fyll i <CASE_WEBHOOK_SECRET> nedan innan du
-- kör den i SQL Editor. Gör i denna ordning:
--
-- 1. Deploya Edge Function "notify-new-case":
--      supabase functions deploy notify-new-case --no-verify-jwt
--    (--no-verify-jwt krävs eftersom databasens webhook inte skickar någon
--    användar-JWT - se kommentaren i index.ts. Går även att deploya via
--    Dashboard > Edge Functions > Create function, klistra in koden, och
--    slå av "Verify JWT" i funktionens inställningar.)
--
-- 2. Sätt secrets för funktionen (Dashboard > Edge Functions >
--    notify-new-case > Secrets, eller via CLI):
--      supabase secrets set \
--        RESEND_API_KEY=<din-nyckel-från-resend.com> \
--        ADMIN_EMAILS=william@dmcservice.se \
--        ADMIN_APP_URL=<https://er-produktions-url, utan avslutande /> \
--        CASE_WEBHOOK_SECRET=36ea5bbaf381e6b466449bbd485d430275156be4de22e998cd76a26cc6f0164d
--
--    (Hemligheten ovan är slumpad av Claude för detta ändamål - byt gärna ut
--    den mot en egen, men använd då SAMMA värde här i SQL:en nedan.)
--
-- 3. Kör denna SQL i SQL Editor. Projekt-referensen (lwnwoeftisepokhgcudq)
--    är redan ifylld nedan eftersom den redan används på andra ställen i
--    kodbasen (lib/supabaseAdmin.js, app/api/chat/save-case/route.js).

-- pg_net ger oss net.http_post() för asynkrona HTTP-anrop från Postgres.
-- IF NOT EXISTS gör det säkert att köra om extensionen redan råkar vara på.
create extension if not exists pg_net with schema "extensions";

-- security definer: triggerfunktionen ska köra med skaparens (postgres) rättigheter,
-- oavsett vilken Postgres-roll (t.ex. service_role via PostgREST) som utför INSERT:en -
-- annars kan anropet fallera på behörighet till schemat "net".
create or replace function "public"."cases_notify_new_case"()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, net
as $$
begin
  perform net.http_post(
    url := 'https://lwnwoeftisepokhgcudq.supabase.co/functions/v1/notify-new-case',
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA,
      'record', to_jsonb(new),
      'old_record', null
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', '36ea5bbaf381e6b466449bbd485d430275156be4de22e998cd76a26cc6f0164d'
    ),
    timeout_milliseconds := 5000
  );
  return new;
end;
$$;

drop trigger if exists "cases_notify_on_insert" on "public"."cases";

create trigger "cases_notify_on_insert"
after insert on "public"."cases"
for each row
execute function "public"."cases_notify_new_case"();
