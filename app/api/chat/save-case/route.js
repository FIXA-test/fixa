import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://lwnwoeftisepokhgcudq.supabase.co",
  "sb_publishable_bes2DlczBvaK3msGAQmDrw_PZoTHmqZ"
);

export async function POST(req) {
  try {
    const data = await req.json();
    await supabase.from("cases").insert({
      kund_namn: data.kund_namn || null,
      kund_personnr: data.kund_personnr || null,
      kund_gata: data.kund_gata || null,
      kund_postnr: data.kund_postnr || null,
      kund_ort: data.kund_ort || null,
      kund_telefon: data.kund_telefon || null,
      kund_epost: data.kund_epost || null,
      rot_avdrag: data.rot_avdrag || null,
      produkttyp: data.produkttyp || null,
      marke: data.marke || null,
      modell: data.modell || null,
      felkod: data.felkod || null,
      symptom: data.symptom || null,
      trolig_orsak: data.trolig_orsak || null,
      reservdel: data.reservdel || null,
      specialist: data.specialist || null,
      rapport: data.rapport || null,
      status: "tekniker",
    });
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}