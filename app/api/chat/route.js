import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

export async function POST(req) {
  const { messages, system, caseData } = await req.json();

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1000,
    system,
    messages,
  });

  // Spara ärendet i Supabase om det är klart
  if (caseData && (caseData.status === "tekniker" || caseData.status === "lost")) {
    await supabase.from("cases").upsert({
      kund_namn: caseData.kund_namn,
      kund_personnr: caseData.kund_personnr,
      kund_gata: caseData.kund_gata,
      kund_postnr: caseData.kund_postnr,
      kund_ort: caseData.kund_ort,
      kund_telefon: caseData.kund_telefon,
      kund_epost: caseData.kund_epost,
      rot_avdrag: caseData.rot_avdrag,
      produkttyp: caseData.produkttyp,
      marke: caseData.marke,
      modell: caseData.modell,
      felkod: caseData.felkod,
      symptom: caseData.symptom,
      trolig_orsak: caseData.trolig_orsak,
      reservdel: caseData.reservdel,
      specialist: caseData.specialist,
      rapport: caseData.rapport,
      status: caseData.status,
    });
  }

  return Response.json(response);
}