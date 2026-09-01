-- Lägger till ett fristående fält för att markera att ett ärende löstes på
-- distans (utan fysiskt verkstadsbesök) - antingen manuellt av admin i
-- adminvyn, eller automatiskt när kunden själv löser det via fixa.se-chatten
-- (se app/api/chat/route.js, insert när caseData.status === "lost").
--
-- Detta är MEDVETET frikopplat från det befintliga status-fältet (som redan
-- har ett värde "lost_remote"/"lost" med snarlik betydelse) - se separat
-- kommentar till William om den överlappen innan detta körs.
--
-- Kör hela denna fil i Supabase SQL Editor.

alter table "public"."cases"
  add column if not exists "resolved_remotely" boolean not null default false;

comment on column "public"."cases"."resolved_remotely" is
  'Ärendet löstes på distans (inget fysiskt besök krävdes) - satt manuellt av admin eller automatiskt när kunden bekräftar att en säker självhjälpsåtgärd löste problemet.';
