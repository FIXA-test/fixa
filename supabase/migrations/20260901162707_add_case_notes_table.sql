-- Interna anteckningar på ärenden (admin/personal, aldrig kundriktat).
-- Egen tabell istället för en kolumn på cases eftersom det är en växande
-- lista av anteckningar per ärende. Bara skapande stöds - ingen
-- redigering/radering (se app/api/admin/cases/[id]/notes/route.js).
--
-- Kör hela denna fil i Supabase SQL Editor.

create table if not exists "public"."case_notes" (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references "public"."cases"(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now()
);

create index if not exists case_notes_case_id_idx on "public"."case_notes"("case_id");

-- RLS på men UTAN policies: bara service-role-nyckeln (som adminpanelen
-- redan använder via lib/supabaseAdmin.js) kommer åt tabellen. Den
-- publishable/anon-nyckel kundchatten använder (app/api/chat/save-case)
-- kan varken läsa eller skriva hit, oavsett vad frontend-koden gör - så
-- kravet "anteckningar syns aldrig för kunden" hålls på databasnivå också.
alter table "public"."case_notes" enable row level security;

comment on table "public"."case_notes" is
  'Interna anteckningar från admin/personal på ett ärende. Endast tillägg (ingen redigering/radering). Visas aldrig för kunden.';
