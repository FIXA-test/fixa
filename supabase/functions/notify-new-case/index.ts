// Anropas av en Supabase Database Webhook (se ../../migrations/*_notify_new_case_webhook.sql)
// varje gång en rad INSERTas i public.cases. Skickar dels ett notismail till
// admin, dels en bekräftelse till kunden (om kund_epost finns) - båda via
// Resend (https://resend.com).
//
// Om ETT av mailen misslyckas ska INTE ärendet påverkas, och det andra mailet
// ska ändå försöka skickas - webhooken körs redan efter att raden är sparad i
// databasen, så vi bara loggar felet här och returnerar ändå 200. Se de två
// separata try/catch-blocken i Deno.serve nedan.
//
// Miljövariabler (Supabase secrets - sätts i Dashboard > Edge Functions >
// notify-new-case > Secrets, eller `supabase secrets set ...`.
// OBS: dessa läses ALDRIG från Next.js-appens .env.local, det är två skilda
// körmiljöer - se kommentaren i .env.local för var värdena faktiskt ska in):
//   RESEND_API_KEY      - API-nyckel från https://resend.com
//   ADMIN_EMAILS        - kommaseparerad lista, t.ex. "william@dmcservice.se"
//   ADMIN_APP_URL       - bas-URL till admin-appen, t.ex. "https://fixa.dmcservice.se" (utan avslutande /)
//   CASE_WEBHOOK_SECRET - delad hemlighet; måste matcha x-webhook-secret-headern i SQL-migrationen
//   RESEND_FROM_EMAIL   - avsändaradress (måste vara verifierad i Resend), default nedan

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const ADMIN_EMAILS = (Deno.env.get("ADMIN_EMAILS") || "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);
const ADMIN_APP_URL = (Deno.env.get("ADMIN_APP_URL") || "").replace(/\/+$/, "");
const CASE_WEBHOOK_SECRET = Deno.env.get("CASE_WEBHOOK_SECRET");
const FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "FIXA <notiser@fixa.se>";

Deno.serve(async (req) => {
  // Funktionen deployas med --no-verify-jwt (databasens webhook skickar ingen
  // giltig användar-JWT), så vi kollar istället en delad hemlighet i en egen
  // header. Om CASE_WEBHOOK_SECRET inte är satt körs ingen kontroll - sätt
  // den innan funktionen är publik åtkomlig i produktion.
  if (CASE_WEBHOOK_SECRET) {
    const provided = req.headers.get("x-webhook-secret");
    if (provided !== CASE_WEBHOOK_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  // Bara nya ärenden ska ge notis (webhooken är konfigurerad för INSERT,
  // men vi dubbelkollar här om den någon gång återanvänds för fler events).
  if (payload?.type !== "INSERT" || !payload?.record) {
    return new Response("Ignored", { status: 200 });
  }

  try {
    await sendCaseNotification(payload.record);
  } catch (err) {
    // Får ALDRIG kasta vidare - ärendet i databasen ska inte påverkas av att
    // mailutskicket misslyckas. Syns i Dashboard > Edge Functions > Logs.
    console.error("Kunde inte skicka ärendenotis för ärende", payload.record?.id, err);
  }

  // Eget try/catch, oberoende av admin-notisen ovan - ett misslyckat kundmail
  // ska varken påverka ärendet eller stoppa/döljas av ett ev. fel i admin-mailet.
  try {
    await sendCustomerConfirmation(payload.record);
  } catch (err) {
    console.error("Kunde inte skicka kundbekräftelse för ärende", payload.record?.id, err);
  }

  return new Response("ok", { status: 200 });
});

async function sendCaseNotification(record: Record<string, any>) {
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY saknas - hoppar över mailnotis för ärende", record.id);
    return;
  }
  if (ADMIN_EMAILS.length === 0) {
    console.error("ADMIN_EMAILS saknas/tom - hoppar över mailnotis för ärende", record.id);
    return;
  }

  const apparat =
    [record.produkttyp, record.marke, record.modell].filter(Boolean).join(" · ") || "Okänd apparat";
  const tidsstampel = record.created_at
    ? new Date(record.created_at).toLocaleString("sv-SE", { timeZone: "Europe/Stockholm" })
    : new Date().toLocaleString("sv-SE", { timeZone: "Europe/Stockholm" });
  const lank = ADMIN_APP_URL && record.id ? `${ADMIN_APP_URL}/admin?case=${record.id}` : null;

  const subject = `Nytt ärende: ${record.kund_namn || "Okänd kund"}`;
  const textLines = [
    "Nytt ärende har kommit in.",
    "",
    `Kund: ${record.kund_namn || "—"}`,
    `Apparat: ${apparat}`,
    `Inskickat: ${tidsstampel}`,
    lank ? `Länk: ${lank}` : null,
  ].filter(Boolean);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: ADMIN_EMAILS,
      subject,
      text: textLines.join("\n"),
      html: `
        <div style="font-family: sans-serif; font-size: 14px; color: #111827;">
          <p style="font-size:16px; font-weight:700; margin-bottom:16px;">Nytt ärende har kommit in</p>
          <p style="margin:4px 0;"><strong>Kund:</strong> ${escapeHtml(record.kund_namn || "—")}</p>
          <p style="margin:4px 0;"><strong>Apparat:</strong> ${escapeHtml(apparat)}</p>
          <p style="margin:4px 0;"><strong>Inskickat:</strong> ${escapeHtml(tidsstampel)}</p>
          ${lank ? `<p style="margin:16px 0;"><a href="${lank}" style="background:#2C5A82;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;">Öppna ärendet</a></p>` : ""}
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend svarade ${res.status}: ${body}`);
  }
}

// Bekräftelsemail till KUNDEN (inte admin). Bygger medvetet med en vitlista
// av fält kunden själv angett (apparat, egen felbeskrivning) - aldrig
// FIXA:s interna bedömning (trolig_orsak/reservdel/specialist/rapport),
// kundens personnummer/adress, eller admin-länken. Om ett internt
// anteckningsfält läggs till i cases senare ska det ALDRIG hamna här,
// eftersom vi bara plockar ut namngivna fält nedan istället för att
// spreada/dumpa hela record-objektet.
async function sendCustomerConfirmation(record: Record<string, any>) {
  const to = String(record.kund_epost || "").trim();
  if (!to) return; // Ingen adress angiven - inget mail att skicka.

  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY saknas - hoppar över kundbekräftelse för ärende", record.id);
    return;
  }

  const apparat =
    [record.produkttyp, record.marke, record.modell].filter(Boolean).join(" · ") || "Okänd apparat";
  const halsning = record.kund_namn ? `Hej ${record.kund_namn}!` : "Hej!";
  const isResolvedRemotely = record.resolved_remotely === true;

  const introText = isResolvedRemotely
    ? "Toppen att det löste sig! Vi har ändå registrerat ärendet hos oss:"
    : "Vi har tagit emot ditt ärende:";
  const nextStepsText = isResolvedRemotely
    ? "Inget mer behöver göras från din sida just nu - hör bara av dig igen om problemet skulle komma tillbaka eller om något annat krånglar."
    : "En tekniker hör normalt av sig inom 24 timmar för att boka en tid som passar. Rör inget inuti eller bakom apparaten innan teknikern kommer.";
  const subject = isResolvedRemotely
    ? "Bra jobbat – ditt ärende hos FIXA är löst!"
    : "Vi har tagit emot ditt ärende – FIXA";

  const textLines = [
    halsning,
    "",
    introText,
    "",
    `Apparat: ${apparat}`,
    record.symptom ? `Du beskrev: "${record.symptom}"` : null,
    "",
    nextStepsText,
    "",
    "Vänliga hälsningar,",
    "FIXA",
  ].filter((line) => line !== null);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [to],
      subject,
      text: textLines.join("\n"),
      html: `
        <div style="font-family: sans-serif; font-size: 14px; color: #111827; line-height: 1.6;">
          <p style="margin:0 0 16px;">${escapeHtml(halsning)}</p>
          <p style="margin:0 0 12px;">${escapeHtml(introText)}</p>
          <p style="margin:4px 0;"><strong>Apparat:</strong> ${escapeHtml(apparat)}</p>
          ${record.symptom ? `<p style="margin:4px 0;"><strong>Du beskrev:</strong> ${escapeHtml(record.symptom)}</p>` : ""}
          <p style="margin:16px 0 0;">${escapeHtml(nextStepsText)}</p>
          <p style="margin:20px 0 0; color:#7A8794;">Vänliga hälsningar,<br/>FIXA</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend svarade ${res.status}: ${body}`);
  }
}

function escapeHtml(str: unknown) {
  return String(str).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c] as string
  );
}
