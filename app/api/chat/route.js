import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

export async function POST(req) {
  try {
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

    if (caseData && (caseData.status === "tekniker" || caseData.status === "lost")) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      );
      await supabase.from("cases").insert({
        kund_namn: caseData.kund_namn || null,
        kund_personnr: caseData.kund_personnr || null,
        kund_gata: caseData.kund_gata || null,
        kund_postnr: caseData.kund_postnr || null,
        kund_ort: caseData.kund_ort || null,
        kund_telefon: caseData.kund_telefon || null,
        kund_epost: caseData.kund_epost || null,
        rot_avdrag: caseData.rot_avdrag || null,
        produkttyp: caseData.produkttyp || null,
        marke: caseData.marke || null,
        modell: caseData.modell || null,
        felkod: caseData.felkod || null,
        symptom: caseData.symptom || null,
        trolig_orsak: caseData.trolig_orsak || null,
        reservdel: caseData.reservdel || null,
        specialist: caseData.specialist || null,
        rapport: caseData.rapport || null,
        status: caseData.status || "pagar",
      });
    }

    return Response.json(response);
  } catch (error) {
    console.error("Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}