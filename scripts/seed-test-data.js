// ⚠️ TILLFÄLLIG TESTDATA — ta bort helt innan skarp lansering.
//
// Lägger till ~18 påhittade ärenden i Supabase "cases" för att kunna se hur
// admin-statistiken (särskilt märke/modell-korten) beter sig med mer data.
//
// Varje rad märks med kund_epost på formen "*@fixa-testdata.invalid"
// (".invalid" är en IANA-reserverad TLD avsedd exakt för test-/exempeldata,
// den routar aldrig till ett riktigt mejl). Det är den enda pålitliga
// markören - använd den för att hitta/ta bort testdatan igen:
//
//   node scripts/remove-test-data.js          (dry-run, visar vad som skulle tas bort)
//   node scripts/remove-test-data.js --confirm (tar faktiskt bort raderna)
//
// Alternativ metod: radera på exakta ID:n. Efter körning skriver detta
// script listan över skapade ärende-ID:n till scripts/seed-test-data-ids.json.
// Ta bort exakt dessa rader med t.ex.:
//   DELETE FROM cases WHERE id IN (<id-lista från json-filen>);
//
// Körs fristående (inte via Next.js), så env-variablerna läses direkt ur
// projektets .env.local nedan.

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const TEST_EMAIL_DOMAIN = "fixa-testdata.invalid";

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env.local");
  const raw = fs.readFileSync(envPath, "utf8");
  const env = {};
  raw.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const idx = trimmed.indexOf("=");
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    env[key] = value;
  });
  return env;
}

function emailFor(name) {
  const ascii = name
    .toLowerCase()
    .replace(/å/g, "a")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/[^a-z\s]/g, "");
  return ascii.trim().split(/\s+/).join(".") + "@" + TEST_EMAIL_DOMAIN;
}

function daysAgo(days, hour) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, [10, 25, 40, 55][days % 4], 0, 0);
  return d.toISOString();
}

// Återkommande felorsaker (samma text upprepas medvetet på flera ärenden,
// ofta ihop med samma märke/modell, så "Vanligaste trolig orsak" och
// "Vanligaste modeller" faktiskt visar mönster istället för 18 unika rader).
const ORSAK = {
  pumpfilter: "Igensatt pumpfilter orsakar stopp i tömningen och läckage",
  kolborste: "Sliten kolborste ger svag eller ojämn motoreffekt",
  magnetventil: "Defekt magnetventil hindrar vattenintag",
  spolarmar: "Igensatta spolarmar ger ojämn eller dålig diskning",
  varmeelement_disk: "Defekt värmeelement - vatten blir aldrig varmt",
  skoljglans: "Sköljglansfack tomt eller feljusterat, ger fläckar",
  koldmedium: "Möjligt köldmedelsproblem eller trasigt styrkort",
  dorrtatning: "Sliten dörrtätning släpper in varmluft, ger isbildning",
  luddfilter: "Igensatt luddfilter och kondensor ger lång torktid",
};

const CASES = [
  { namn: "Anna Berg", produkttyp: "Tvättmaskin", marke: "Electrolux", modell: "EW6F5248", orsak: ORSAK.pumpfilter, symptom: "Tvättmaskinen stannar mitt i programmet och vatten blir kvar i trumman", status: "done", ebs: true, reservdel: "Avloppspump", days: 2, hour: 9 },
  { namn: "Erik Lindqvist", produkttyp: "Diskmaskin", marke: "Siemens", modell: "SN23HW60", orsak: ORSAK.spolarmar, symptom: "Disken kommer inte ren, matrester sitter kvar särskilt i övre korgen", status: "booked", ebs: true, reservdel: "Spolarmar + sil", days: 9, hour: 14 },
  { namn: "Maria Svensson", produkttyp: "Kyl/Frys", marke: "Miele", modell: "KFN29132D", orsak: ORSAK.koldmedium, symptom: "Kylen håller inte rätt temperatur, mjölken blir sur i förtid", status: "contacted", days: 16, hour: 11 },
  { namn: "Johan Karlsson", produkttyp: "Tvättmaskin", marke: "Electrolux", modell: "EW6F5248", orsak: ORSAK.pumpfilter, symptom: "Vattnet töms inte ur maskinen efter avslutat program", status: "new", days: 1, hour: 16 },
  { namn: "Sara Nilsson", produkttyp: "Diskmaskin", marke: "Siemens", modell: "SN23HW60", orsak: ORSAK.spolarmar, symptom: "Glas och tallrikar kommer ut med matrester kvar", status: "part_ordered", days: 5, hour: 10 },
  { namn: "Lars Andersson", produkttyp: "Torktumlare", marke: "Cylinda", modell: "TC44", orsak: ORSAK.luddfilter, symptom: "Torktumlaren tar mycket längre tid än vanligt att torka", status: "lost_remote", days: 23, hour: 8 },
  { namn: "Karin Pettersson", produkttyp: "Kyl/Frys", marke: "Miele", modell: "KFN29132D", orsak: ORSAK.koldmedium, symptom: "Frysen bildar is fort och kyldelen känns för varm", status: "ready_to_book", days: 12, hour: 13 },
  { namn: "Mikael Johansson", produkttyp: "Tvättmaskin", marke: "Asko", modell: "W4086C", orsak: ORSAK.kolborste, symptom: "Maskinen låter konstigt och snurrar långsammare än vanligt", status: "done", ebs: true, reservdel: "Kolborstar (par)", days: 4, hour: 15 },
  { namn: "Emma Larsson", produkttyp: "Diskmaskin", marke: "Elvita", modell: "DM6455", orsak: ORSAK.varmeelement_disk, symptom: "Disken torkar aldrig ordentligt, allt är fuktigt efter programmet", status: "contacted", days: 19, hour: 12 },
  { namn: "Anders Gustafsson", produkttyp: "Tvättmaskin", marke: "Siemens", modell: "WM14T471DN", orsak: ORSAK.magnetventil, symptom: "Maskinen tar inte in vatten alls, programmet startar inte", felkod: "F43", status: "new", days: 0, hour: 17 },
  { namn: "Linda Eriksson", produkttyp: "Tvättmaskin", marke: "Electrolux", modell: "EW6F5248", orsak: ORSAK.pumpfilter, symptom: "Vatten läcker ut på golvet under tvättprogrammet", status: "booked", ebs: false, reservdel: "Tätningsring till pumphus", days: 7, hour: 9 },
  { namn: "Peter Olsson", produkttyp: "Diskmaskin", marke: "Cylinda", modell: "DM24", orsak: ORSAK.skoljglans, symptom: "Glasen blir fläckiga och matta efter diskning", status: "lost_remote", days: 26, hour: 11 },
  { namn: "Sofia Bergström", produkttyp: "Kyl/Frys", marke: "Elvita", modell: "KF2202", orsak: ORSAK.dorrtatning, symptom: "Mycket isbildning i frysen, dörren känns svår att stänga helt", status: "part_ordered", days: 14, hour: 14 },
  { namn: "Daniel Håkansson", produkttyp: "Diskmaskin", marke: "Siemens", modell: "SN23HW60", orsak: ORSAK.spolarmar, symptom: "Botten av disken blir aldrig ren trots rätt program", felkod: "E15", status: "ready_to_book", days: 3, hour: 10 },
  { namn: "Jenny Lindgren", produkttyp: "Torktumlare", marke: "Cylinda", modell: "TC44", orsak: ORSAK.luddfilter, symptom: "Kläderna kommer ut fuktiga trots fullt torkprogram", status: "lost_remote", days: 21, hour: 16 },
  { namn: "Fredrik Åström", produkttyp: "Kyl/Frys", marke: "Miele", modell: "KFN29132D", orsak: ORSAK.koldmedium, symptom: "Kompressorn går hela tiden men kylan uteblir", status: "done", ebs: false, reservdel: "Startrelä + kompressorkontroll", days: 10, hour: 13 },
  { namn: "Malin Holm", produkttyp: "Tvättmaskin", marke: "Asko", modell: "W4086C", orsak: ORSAK.kolborste, symptom: "Ovanligt ljud från motorn under centrifugering", status: "new", days: 6, hour: 9 },
  { namn: "Marcus Söderberg", produkttyp: "Tvättmaskin", marke: "Electrolux", modell: "EW6F5248", orsak: ORSAK.pumpfilter, symptom: "Programmet avbryts med felkod, vatten kvar i trumman", felkod: "E23", status: "contacted", days: 17, hour: 15 },
];

const TEKNIKER_STATUSES = new Set(["contacted", "part_ordered", "ready_to_book", "booked", "done"]);

async function main() {
  const env = loadEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    console.error("Saknar NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY i .env.local");
    process.exit(1);
  }
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

  const rows = CASES.map((c) => ({
    kund_namn: c.namn,
    kund_epost: emailFor(c.namn),
    kund_telefon: null,
    produkttyp: c.produkttyp,
    marke: c.marke,
    modell: c.modell,
    felkod: c.felkod || "",
    symptom: c.symptom,
    trolig_orsak: c.orsak,
    reservdel: c.reservdel || "",
    specialist: TEKNIKER_STATUSES.has(c.status) ? "Vitvarutekniker" : "",
    rapport: c.status === "done" ? `Åtgärdat hos ${c.namn.split(" ")[0]}. ${c.orsak}.` : "",
    status: c.status,
    loest_forsta_besoket: c.ebs === undefined ? null : c.ebs,
    created_at: daysAgo(c.days, c.hour),
  }));

  console.log(`Lägger till ${rows.length} testärenden (märkta med @${TEST_EMAIL_DOMAIN})...`);
  const { data, error } = await supabase.from("cases").insert(rows).select("id, kund_namn, created_at");

  if (error) {
    console.error("Kunde inte lägga till testdata:", error);
    process.exit(1);
  }

  const ids = data.map((r) => r.id);
  const idsPath = path.join(__dirname, "seed-test-data-ids.json");
  fs.writeFileSync(idsPath, JSON.stringify({ createdAt: new Date().toISOString(), emailDomain: TEST_EMAIL_DOMAIN, ids }, null, 2));

  console.log(`Klart! ${data.length} ärenden skapade.`);
  data.forEach((r) => console.log(`  - ${r.kund_namn} (${r.id}) · ${r.created_at}`));
  console.log(`\nID-lista sparad till ${idsPath}`);
  console.log(`\nTa bort all testdata igen med:  node scripts/remove-test-data.js --confirm`);
}

main();
