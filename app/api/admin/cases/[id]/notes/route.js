import { supabaseAdmin, isAdminRequest } from "@/lib/supabaseAdmin";

// GET /api/admin/cases/<id>/notes - listar interna anteckningar för ett
// ärende, nyast först.
// POST /api/admin/cases/<id>/notes - body: { note } - lägger till en ny
// anteckning. Ingen PATCH/DELETE finns här med flit - anteckningar går bara
// att lägga till, inte ändra eller ta bort (se uppgiftens krav 3).
//
// Anteckningarna är rent interna - ingen kundriktad kod (app/page.jsx,
// notify-new-case-mailen) känner till eller läser från case_notes.

export async function GET(req, { params }) {
  if (!isAdminRequest(req)) {
    return Response.json({ error: "Fel lösenord" }, { status: 401 });
  }

  const { id } = await params;
  const { data, error } = await supabaseAdmin
    .from("case_notes")
    .select("*")
    .eq("case_id", id)
    .order("created_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ data });
}

export async function POST(req, { params }) {
  if (!isAdminRequest(req)) {
    return Response.json({ error: "Fel lösenord" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const note = (body?.note || "").trim();
  if (!note) {
    return Response.json({ error: "Anteckningen kan inte vara tom" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("case_notes")
    .insert({ case_id: id, note })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ data });
}
