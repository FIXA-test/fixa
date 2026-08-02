"use client";
import { useState, useRef, useEffect } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

// ─────────────────────────────────────────────────────────────
//  FIXA — AI-triage för vitvarugarantier
//  skickar strukturerat ärende med kunduppgifter (namn, personnummer,
//  adress, telefon, e-post, ROT ja/nej) vidare till tekniker.
//
//  Vyer: Kund (publik) · Tekniker (admin) · Servicechef (admin)
//  Data sparas i localStorage (fungerar i produktionsmiljö, inte i artifacts).
// ─────────────────────────────────────────────────────────────

const buildSystemPrompt = () => `Du är FIXA, en triage-assistent för VITVAROR och hushållsapparater hos en nordisk återförsäljare/serviceaktör: tvättmaskin, torktumlare, diskmaskin, kyl/frys, spis/ugn, mikrovågsugn, köksfläkt och liknande. SVARA ALLTID PÅ SVENSKA. Du används av kunder INNAN de bokar en servicetekniker. Ditt uppdrag: (a) lös problemet med åtgärder kunden säkert kan göra UTIFRÅN utan verktyg, eller (b) om det inte går säkert — lista ut trolig orsak, samla in underlag och boka en behörig tekniker. Säkerhet går alltid före att undvika ett besök. Om kunden frågar om en produkt som inte är en vitvara/hushållsapparat (t.ex. cykel, bil, telefon), säg vänligt att du är specialiserad på vitvaror och hushållsapparater.

TON OCH SPRÅKSTIL (viktigt — läs detta först)
- Skriv som en kunnig granne som lagat vitvaror i 20 år, inte som en kundtjänstrobot. Naturligt språk, inte manusartat.
- Behandla varje kund som en vuxen person med hjärna. Förklara VARFÖR något är farligt eller behöver en tekniker, inte bara att det är det.
- Fråga aldrig "har du provat att stänga av och på?" som första fråga — det är förolämpande. Utgå från att kunden gjort det uppenbara. Fråga istället vad de redan testat.
- Bekräfta när kunden gjort rätt: "Bra att du redan rengjort filtret — då kan vi utesluta det som orsak."
- Om kunden verkar frustrerad, erkänn det kort ("Förstår att det är jobbigt när tvättmaskinen strular mitt i vardagen") och gå sen vidare. Överdriv inte medkänslan.
- Undvik falsk artighet som "Tack för den värdefulla informationen!" — det låter hult. Säg hellre "Ok, då vet jag" eller "Bra, då tar vi det därifrån."
- HÅLL SVAREN KORTA. Kunden vill inte läsa långa texter i en chatt. Ett par meningar i taget.
- FÖRESLÅ FLERA LÖSNINGAR SAMTIDIGT. När du guidar felsökning, ge kunden 2–3 möjliga saker att testa i samma svar (som en kort punktlista), inte en fråga/åtgärd i taget. Det är mindre irriterande för kunden och snabbare mot lösning. Exempel: *"Testa dessa i den här ordningen: 1) rengör frontfiltret, 2) kontrollera att luckan stänger helt, 3) kör en tomkörning på 90 grader. Berätta sen vad som händer."*
- När du samlar in kunduppgifter: gör INTE det som chattfrågor — ett formulär visas automatiskt när ärendet är redo för tekniker. Nämn inte att uppgifterna behövs, det sköts av formuläret.
- Matcha kundens tekniska nivå. Om de säger "avloppspumpen surrar men det kommer inget vatten", behandla dem som den kunniga person de är — svara på samma nivå, hoppa över grundskoleförklaringar. Om de säger "den är trasig", förklara pedagogiskt utan att bli barnsligt förenklande.
- Använd aldrig ord som "vänligen", "vänligen notera", "vi ber om ursäkt för besväret". Prata som en människa.

STEG 1 — LISTA UT VILKEN APPARAT DET ÄR (gör detta själv, anta inte)
- Fråga kort vad som krånglar och vad som händer. Ta reda på: produkttyp (vilken sorts apparat) → märke → modellbeteckning → ev. felkod → symptom.
- Be gärna om FOTO av apparaten och/eller dess typskylt/modelldekal (dörröppningen på tvätt/disk, sidoväggen inuti kylen, i luckan på torktumlare/ugn). Läs av produkttyp, märke, modell, serienummer och ev. felkod från bilden och bekräfta vad du ser. Ett foto på själva felet/läckan hjälper också teknikern.
- Fyll i "produkttyp" i klartext så fort du vet den (t.ex. "Tvättmaskin", "Diskmaskin", "Kyl/Frys", "Inbyggnadsugn").

KVITTO / INKÖPSBEVIS (viktig funktion)
- Om kunden laddar upp ett kvitto eller en orderbekräftelse: läs av och fyll i "butik" (butikens namn och ort), "ordernr" (order-/kvittonummer), "inkopsdatum" (YYYY-MM-DD) och "garanti_kvitto" (garantitexten, t.ex. "5 års konsumentgaranti" — räkna gärna ut t.o.m.-datum utifrån inköpsdatum). Nämn även vilka produkter som köptes om det framgår.
- Detta hjälper personalen att direkt veta VAR produkten är köpt (vilken butik), vilket ordernummer som gäller och OM den är inom garanti — så rätt butik/garantigivare kan ta ärendet. Bekräfta vänligt vad du läste av. Fråga gärna efter kvittot om garantifrågan är relevant och du inte har det.

KUNDUPPGIFTER (hanteras via formulär — inte i chatten)
- Fråga INTE efter kundens namn, personnummer, adress, telefon eller e-post i chatten. Ett separat formulär visas automatiskt för kunden när du sätter status "tekniker".
- Ditt jobb i chatten är att slutföra själva triagen: bekräfta trolig orsak, lista vad kunden testat, och sätt status "tekniker" när det är klart att en tekniker behövs.
- När du är klar med triagen, säg något kort som: *"Ok, då är triagen klar. En tekniker behöver komma och åtgärda [problemet]. Fyll bara i formuläret nedan så skickar vi ärendet vidare."*

ROT-AVDRAG (hanteras via formuläret)
- Fråga INTE om ROT-avdrag i chatten. Ja/nej-valet finns i formuläret som visas när triagen är klar.

STEG 2 — SÄKERHETSRAM (gäller alla apparater; bedöm per apparat)
Många moment i en vitvara ska en tekniker göra — inte för att kunden är oförmögen, utan för att fel utfört arbete kan skada maskinen eller kunden själv (elchock, vattenskada, brandrisk, förlorad garanti). Guida ENDAST åtgärder som en privatperson tryggt kan göra från UTSIDAN, utan verktyg, som INTE innebär att man
 • öppnar, skruvar upp eller tar av hölje, panel eller kåpa,
 • rör nätspänning, intern elektronik/kablage, kondensatorer eller högspänning,
 • rör gas eller förbränning (t.ex. gasspis),
 • rör trycksatta system (vattenledning, köldmedium),
 • rör hög värme, ånga eller öppen låga,
 • rör vassa kanter eller rörliga/roterande delar,
 • kräver att man drar ut eller flyttar en inbyggd/tung apparat, eller arbete på höjd,
 • rör säkerhetskritiska delar (fast elinstallation, gasanslutning).
Kräver lösningen NÅGOT av ovanstående: förklara kort VARFÖR det ska göras av tekniker (t.ex. "Slangen bakom maskinen sitter under vattentryck och kan orsaka vattenskada om den lossnar fel — det är därför en tekniker bör göra det"), lista trolig orsak och boka besök. Undvik moraliserande formuleringar som "det är förbjudet" — förklara istället logiken bakom.

SÄKRA SJÄLVHJÄLPSÅTGÄRDER (endast sådant — utifrån, verktygsfritt, ofarligt, utan att flytta apparaten)
- Rätt program/inställning/läge; stänga av barnlås.
- Strömcykla via apparatens EGEN på/av- eller avbryt-knapp; dra bara ur kontakten om vägguttaget är lätt att nå utan att flytta apparaten.
- Rengöra det filter som nås FRAMIFRÅN: pumpfilter fram på tvättmaskin, grovfilter i botten på diskmaskin, luddfilter i torktumlarens dörr. Ha en trasa redo för lite vatten.
- Kontrollera att luckan/dörren stänger och att inget är i kläm; fördela om tvätt/last vid obalans; ta bort en uppenbar yttre blockering.

BOKA TEKNIKER (guida INTE kunden — sätt status "tekniker", fyll i trolig_orsak, reservdel, specialist och rapport)
- Allt bakom/under/inuti apparaten, eller som kräver att den öppnas, dras ut eller flyttas: slangar, vattenkran, pump, motor, lager, kretskort, kompressor, värmeelement, tätning inuti, gasanslutning.
- "specialist" = vilken sorts fackperson som behövs (oftast "Vitvarutekniker"; "Behörig elektriker" vid fast installation; "Gastekniker" vid gasspis).
- "reservdel" är del som tekniker beställer och monterar — föreslå ALDRIG att kunden köper eller byter något själv.

SÄKERHETSLARM
- Vid rök, gnistor, brandlukt, gaslukt, vätskeläckage eller blottad ledning: be kunden sluta använda apparaten, slå av/dra ur endast om det är säkert och lätt att nå (vid gaslukt: rör inga strömbrytare, vädra), hålla avstånd och boka tekniker — eller ringa larm vid brand/gas. Guida ALDRIG kunden att undersöka apparaten inuti.

MASKINLÄSBAR STATUS (obligatoriskt)
Avsluta VARJE svar med exakt en rad:
⟦CASE⟧{"produkttyp":"...","marke":"...","modell":"...","serienr":"...","felkod":"...","symptom":"...","butik":"...","ordernr":"...","inkopsdatum":"...","garanti_kvitto":"...","kund_namn":"...","kund_personnr":"...","kund_adress":"...","kund_telefon":"...","kund_epost":"...","rot_avdrag":"","status":"pagar|lost|tekniker","atgarder":["säkra åtgärder kunden testat"],"trolig_orsak":"...","reservdel":"...","specialist":"...","rapport":"..."}⟦/CASE⟧
- Tomma strängar tills du vet. Fyll i butik/ordernr/inkopsdatum/garanti_kvitto när kunden laddat upp ett kvitto. Fyll i ALLA kunduppgifter (namn, personnr, adress, telefon, epost) när du fått dem — obligatoriskt innan status "tekniker". "rot_avdrag" sätts till "ja" eller "nej" när kunden svarat, lämna tomt om ärendet är inom garanti. Lämna "felkod" tom för apparater utan felkoder. status "lost" = kunden bekräftat att en SÄKER yttre åtgärd löste det. status "tekniker" = besök krävs — kräver ifyllda kunduppgifter. CASE-fälten alltid på svenska. "reservdel" är den del teknikern beställer och monterar — föreslå aldrig något som kunden ska köpa själv.`;

const QUICK_STARTS = [
  "Tvättmaskinen tömmer inte vatten",
  "Diskmaskinen diskar inte rent",
  "Kylen blir inte kall",
  "Ugnen blir inte varm",
];

const STATUS_META = {
  pagar: { label: "Triage pågår", color: "#C77B1E", bg: "#FBF1E3" },
  lost: { label: "Löst säkert utifrån — besök avvärjt", color: "#1E7A4D", bg: "#E4F3EB" },
  tekniker: { label: "Tekniker krävs — förberedd med underlag", color: "#2C5A82", bg: "#E7EFF6" },
  bokad: { label: "Tekniker bokad — arbetsorder skapad", color: "#5B3E8F", bg: "#EEE9F7" },
};

const WEEKS = [
  { v: "v.21", avvarjda: 13, tekniker: 42, ftf: 71, forbruk: 1600, nff: 34 },
  { v: "v.22", avvarjda: 17, tekniker: 47, ftf: 74, forbruk: 2300, nff: 31 },
  { v: "v.23", avvarjda: 16, tekniker: 44, ftf: 77, forbruk: 2500, nff: 28 },
  { v: "v.24", avvarjda: 22, tekniker: 51, ftf: 80, forbruk: 3200, nff: 25 },
  { v: "v.25", avvarjda: 23, tekniker: 46, ftf: 82, forbruk: 3000, nff: 23 },
  { v: "v.26", avvarjda: 26, tekniker: 51, ftf: 84, forbruk: 3900, nff: 21 },
  { v: "v.27", avvarjda: 25, tekniker: 47, ftf: 85, forbruk: 3700, nff: 19 },
  { v: "v.28", avvarjda: 30, tekniker: 50, ftf: 87, forbruk: 4500, nff: 18 },
];
const ARENDETYPER = [
  { typ: "Inställning / fel program / läge", besk: "Fel program, läge eller barnlås", antal: 88, digital: 84 },
  { typ: "Externt filter / tömning", besk: "Frontfilter, kärl som kunden når utifrån", antal: 71, digital: 61 },
  { typ: "Vatten / tillopp / avlopp (bakom)", besk: "Slang/kran bakom apparaten → tekniker", antal: 58, digital: 12 },
  { typ: "Dörr / lucka / tätning", besk: "Stänger inte, glappar, läcker vid lucka", antal: 44, digital: 33 },
  { typ: "Kräver intern reparation", besk: "Motor, pump, lager, kompressor, kretskort → tekniker", antal: 96, digital: 4 },
];
const SLOTS = ["Mån 20/7 · 08–12", "Mån 20/7 · 12–16", "Tis 21/7 · 08–12", "Ons 22/7 · 12–16"];

// Seed-arbetsordrar — alla vitvaror. AO-2471 speglar det uppladdade Elon-kvittot
// (Siemens WG44G2F0DN, Tomas Olsson, Elon Sisjön, order 37176) så köpspårning syns direkt.
const SEED_ORDERS = [
  {
    id: "AO-2471", slot: "Väntar på kontakt", kund: "Tomas Olsson, Göteborg",
    createdAt: Date.now() - 2 * 60 * 60 * 1000, // 2h sedan
    produkttyp: "Tvättmaskin", marke: "Siemens", modell: "WG44G2F0DN", serienr: "FD 0207 118842", felkod: "E23",
    kund_namn: "Tomas Olsson", kund_telefon: "070-123 45 67", kund_epost: "tomas.olsson@example.com",
    kund_adress: "Storgatan 12, 41120 Göteborg", kund_personnr: "19850312-4567", rot_avdrag: "ja",
    symptom: "Pumpar inte ut vatten, stannar mitt i program trots rengjort frontfilter",
    atgarder: ["Rengjort pumpfiltret framtill", "Återställt via maskinens knapp"],
    trolig_orsak: "Defekt avloppspump (flödesvakt larmar trots rent frontfilter). Sitter under höljet — teknikerjobb.",
    reservdel: "Avloppspump Siemens 00145787 — finns i servicebil 2",
    specialist: "Vitvarutekniker",
    butik: "Elon Sisjön", ordernr: "37176", inkopsdatum: "2026-06-17",
    garanti: "5 års konsumentgaranti (Elon) → t.o.m. 2031-06-17 · inom garanti",
    rapport: "Kund har rengjort frontfiltret och återställt — E23 kvarstår. Pumpen sitter under höljet och får inte öppnas av kund. Trolig pumpdefekt. Köpt på Elon Sisjön (order 37176), inom 5-årsgaranti — hänvisa fakturering dit. Ta med pump 00145787.",
  },
  {
    id: "AO-2470", slot: "Väntar på kontakt", kund: "A. Reza, Solna",
    createdAt: Date.now() - 8 * 60 * 60 * 1000, // 8h sedan
    produkttyp: "Diskmaskin", marke: "Bosch", modell: "SN23HW00KG", serienr: "FD 9902 004417", felkod: "—",
    kund_namn: "A. Reza", kund_telefon: "073-987 65 43", kund_epost: "a.reza@example.com",
    kund_adress: "Solnavägen 44, 17168 Solna", kund_personnr: "19720814-1122", rot_avdrag: "nej",
    symptom: "Läckage vid diskmaskinens bakkant. Kund har INTE uppmanats åtgärda själv — inbyggd, står mot vägg.",
    atgarder: ["Fotograferat läckan bakifrån", "Stängt av maskinen", "Torkat upp vatten framtill"],
    trolig_orsak: "Trolig spricka/glidning på avloppsslang bakom inbyggd maskin — kräver utdragning.",
    reservdel: "Avloppsslang universal + slangklämmor. Även hink/trasor och fuktmätare.",
    specialist: "Vitvarutekniker",
    butik: "Elon Bäckebol", ordernr: "36980", inkopsdatum: "2023-02-11",
    garanti: "Utanför konsumentgaranti (köpt 2023) → hemförsäkring kan täcka vattenskada",
    rapport: "Kund har fotograferat läckan bakifrån. Maskinen är inbyggd mot vägg och får INTE dras ut av kund (vattenskada/elfara). Tekniker drar ut, åtgärdar slang och kontrollerar anslutning. Golv vid bakkant blött.",
  },
  {
    id: "AO-2472", slot: "Väntar på kontakt", kund: "J. Holm, Bromma",
    createdAt: Date.now() - 20 * 60 * 60 * 1000, // 20h sedan - varning!
    produkttyp: "Kyl/Frys", marke: "LG", modell: "GBB92MCBAP", serienr: "SN 771 985 003", felkod: "—",
    kund_namn: "J. Holm", kund_telefon: "070-555 44 33", kund_epost: "j.holm@example.com",
    kund_adress: "Alviksvägen 3, 16751 Bromma", kund_personnr: "19680501-3344", rot_avdrag: "ja",
    symptom: "Kyldelen blir inte kall, frysen delvis. Kund har kontrollerat att dörren stänger, temperaturinställning och rensat framför gallret.",
    atgarder: ["Kontrollerat dörrtätning framtill", "Höjt kylinställning", "Rensat damm framför bottengaller"],
    trolig_orsak: "Trolig kompressor-/kylkretsfel eller startrelä — inne i apparaten, teknikerjobb.",
    reservdel: "Startrelä + felsökning kylkrets. Ta med manometerset. Verifiera modellrevision.",
    specialist: "Vitvarutekniker (kyla)",
    butik: "Okänd (kvitto ej uppladdat)", ordernr: "—", inkopsdatum: "—",
    garanti: "Garantistatus okänd — be kund ladda upp kvitto",
    rapport: "Kund har gjort säkra yttre kontroller (tätning, inställning, damm). Kylkrets/kompressor får inte hanteras av kund (köldmedium/tryck). Trolig kompressor-/reläfel. Be kund ta fram kvitto för garantibedömning.",
  },
];

const IOT_ALERTS = [
  { sn: "SN 914 220 871", modell: "Electrolux EW8F8669Q8 (tvättmaskin)", signal: "Vibrationsmönster indikerar begynnande lagerslitage", risk: "Hög", dagar: "~30 dagar till troligt haveri", atgard: "Boka förebyggande lagerbyte hos tekniker (fast pris) innan trumhaveri — kunden pillar inget själv." },
  { sn: "SN 118 402 336", modell: "Bosch SMU4HVS72S (diskmaskin)", signal: "Avloppstid ökar 40 % senaste 10 diskarna", risk: "Medel", dagar: "Igensättning byggs upp", atgard: "Push med guide för att rengöra grovfiltret i botten (säker frontåtgärd) — troligen inget besök." },
  { sn: "SN 771 985 002", modell: "LG GBB92MCBAP (kyl/frys)", signal: "Kompressorns gångtid +25 % vid oförändrad temperatur", risk: "Medel", dagar: "Kylkrets bör ses över", atgard: "Kylkretsen är oåtkomlig för kund → boka tekniker för kontroll. Kan även sänka elförbrukning." },
  { sn: "SN 445 019 220", modell: "Siemens WQ42G200DN (torktumlare)", signal: "Kondensorns luftflöde faller — trolig luddansamling", risk: "Låg", dagar: "Rengöring räcker troligen", atgard: "Säker frontåtgärd: push med guide för att rengöra luddfiltret i dörren (verktygsfritt, avsett för användaren)." },
];

function parseCase(text) {
  const m = text.match(/⟦CASE⟧([\s\S]*?)⟦\/CASE⟧/);
  let data = null;
  if (m) { try { data = JSON.parse(m[1]); } catch (e) { data = null; } }
  return { clean: text.replace(/⟦CASE⟧[\s\S]*?⟦\/CASE⟧/g, "").trim(), data };
}
const fmt = (n) => Math.round(n).toLocaleString("sv-SE");

// Formaterar hur länge sedan ett ärende skickades in
function timeSince(createdAt) {
  if (!createdAt) return "—";
  const diffMs = Date.now() - createdAt;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just nu";
  if (mins < 60) return `${mins} min sedan`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}min sedan`;
  return `${Math.floor(hrs / 24)}d ${hrs % 24}h sedan`;
}

// Räknar ut tid kvar till 24h-återkoppling
function timeLeft(createdAt) {
  if (!createdAt) return { text: "—", urgency: "ok" };
  const deadline = createdAt + 24 * 60 * 60 * 1000;
  const diffMs = deadline - Date.now();
  if (diffMs <= 0) return { text: "FÖRSENAD", urgency: "over" };
  const hrs = Math.floor(diffMs / 3600000);
  const mins = Math.floor((diffMs % 3600000) / 60000);
  const text = hrs > 0 ? `${hrs}h ${mins}min kvar` : `${mins}min kvar`;
  let urgency = "ok";
  if (hrs < 2) urgency = "critical";
  else if (hrs < 6) urgency = "warning";
  return { text, urgency };
}

// Verklig garantistatus från kvitto (inköpsdatum + garantiterm), annars mockad serienummerkoll
function receiptWarranty(inkopsdatum, garantiKvitto) {
  if (!inkopsdatum && !garantiKvitto) return null;
  const yearMatch = (garantiKvitto || "").match(/(\d+)\s*år/);
  const d = inkopsdatum && /^\d{4}-\d{2}-\d{2}$/.test(inkopsdatum) ? new Date(inkopsdatum) : null;
  if (d && yearMatch) {
    const years = parseInt(yearMatch[1], 10);
    const end = new Date(d); end.setFullYear(end.getFullYear() + years);
    const inWarranty = end > new Date();
    return {
      label: `${garantiKvitto} → t.o.m. ${end.toLocaleDateString("sv-SE")}`,
      pays: inWarranty ? "Inom garanti — faktureras butiken/garantigivaren" : "Garanti utgången — offert eller hemförsäkring",
      color: inWarranty ? "#1E7A4D" : "#C77B1E",
      bg: inWarranty ? "#E4F3EB" : "#FBF1E3",
      source: "kvitto",
    };
  }
  return {
    label: garantiKvitto || "Garanti oklar",
    pays: "Kontrollera mot inköpsdatum",
    color: "#2C5A82", bg: "#E7EFF6", source: "kvitto",
  };
}
function warrantyCheckSerial(serienr) {
  if (!serienr) return null;
  const digits = serienr.replace(/\D/g, "");
  if (!digits) return null;
  const even = parseInt(digits[digits.length - 1], 10) % 2 === 0;
  return even
    ? { label: "Trolig inom garanti (uppskattat)", pays: "Bekräfta med kvitto", color: "#2C5A82", bg: "#E7EFF6", source: "serienr" }
    : { label: "Garanti oklar", pays: "Be kund ladda upp kvitto för säker bedömning", color: "#C77B1E", bg: "#FBF1E3", source: "serienr" };
}

export default function FixaTriageV7() {
  const [view, setView] = useState("kund");

  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hej! Jag hjälper dig felsöka din vitvara. Beskriv gärna vad som krånglar så tar vi det därifrån. Bifoga gärna en bild på typskylten/modellnumret (📷)" },
  ]);
  const [input, setInput] = useState("");
  const [pendingImage, setPendingImage] = useState(null); // {data, mediaType, preview, isReceipt}
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const emptyCase = {
    produkttyp: "", marke: "", modell: "", serienr: "", felkod: "", symptom: "",
    butik: "", ordernr: "", inkopsdatum: "", garanti_kvitto: "",
    status: "pagar", atgarder: [], trolig_orsak: "", reservdel: "",
    specialist: "", rapport: "",
  };
  const [caseData, setCaseData] = useState(emptyCase);
  const [sessionStats, setSessionStats] = useState(() => {
    try {
      const saved = localStorage.getItem("fixa_stats");
      return saved ? JSON.parse(saved) : { lost: 0, tekniker: 0, forbrukKr: 0 };
    } catch { return { lost: 0, tekniker: 0, forbrukKr: 0 }; }
  });
  const [orders, setOrders] = useState(() => {
    try {
      const saved = localStorage.getItem("fixa_orders");
      if (saved) {
        const parsed = JSON.parse(saved);
        // Bevarar seed om lagringen är tom, annars använder sparad data
        return parsed.length > 0 ? parsed : SEED_ORDERS;
      }
      return SEED_ORDERS;
    } catch { return SEED_ORDERS; }
  });
  const [booking, setBooking] = useState(false);
  const [customerForm, setCustomerForm] = useState({
    namn: "", personnr: "", gata: "", postnr: "", ort: "", telefon: "", epost: "", rot: ""
  });
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [, setTick] = useState(0);

  // Uppdaterar tidsangivelserna varje minut
  useEffect(() => {
    if (view !== "tekniker") return;
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, [view]);
  const countedRef = useRef(false);
  const scrollRef = useRef(null);
  const fileRef = useRef(null);
  const uploadKindRef = useRef("product");
  const orderCounter = useRef((() => {
    // Hitta högsta ordernumret i sparade ärenden så nya nummer inte krockar
    try {
      const nums = orders.map(o => {
        const m = String(o.id || "").match(/AO-(\d+)/);
        return m ? parseInt(m[1], 10) : 0;
      });
      const max = Math.max(2472, ...nums);
      return max + 1;
    } catch { return 2473; }
  })());

  useEffect(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    // Mjuk scroll ner till botten
    const scrollToBottom = () => {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    };
    // Kör direkt
    scrollToBottom();
    // Kör igen efter en kort delay för att fånga bilder/formulär som renderas lite senare
    const t1 = setTimeout(scrollToBottom, 100);
    const t2 = setTimeout(scrollToBottom, 350);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [messages, loading, booking, formSubmitted, caseData.status, pendingImage]);

  // Sparar alla ärenden till localStorage automatiskt när något ändras
  useEffect(() => {
    try {
      localStorage.setItem("fixa_orders", JSON.stringify(orders));
    } catch (e) {
      console.warn("Kunde inte spara ärenden:", e);
    }
  }, [orders]);

  // Sparar sessionsstatistik till localStorage
  useEffect(() => {
    try {
      localStorage.setItem("fixa_stats", JSON.stringify(sessionStats));
    } catch (e) {
      console.warn("Kunde inte spara statistik:", e);
    }
  }, [sessionStats]);

  const pickImage = (kind) => {
    uploadKindRef.current = kind;
    if (fileRef.current) fileRef.current.click();
  };
  const onPickFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    // Claude API stöder bara jpeg, png, gif, webp - inte heic/heif från iPhone
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    let mediaType = (file.type || "").toLowerCase();
    if (!allowed.includes(mediaType)) {
      // Kolla filändelse som fallback
      const name = (file.name || "").toLowerCase();
      if (name.endsWith(".jpg") || name.endsWith(".jpeg")) mediaType = "image/jpeg";
      else if (name.endsWith(".png")) mediaType = "image/png";
      else if (name.endsWith(".webp")) mediaType = "image/webp";
      else if (name.endsWith(".gif")) mediaType = "image/gif";
      else {
        setError("Bildformat stöds inte. Ta ett nytt foto eller använd JPG/PNG.");
        e.target.value = "";
        return;
      }
    }
    if (mediaType === "image/jpg") mediaType = "image/jpeg";
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const base64 = dataUrl.split(",")[1];
      // Kolla storlek (Claude API: max ~5MB per bild i base64)
      if (base64.length > 5 * 1024 * 1024) {
        setError("Bilden är för stor. Ta en ny bild med lägre upplösning.");
        e.target.value = "";
        return;
      }
      setPendingImage({ data: base64, mediaType, preview: dataUrl });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const send = async (text) => {
    const typed = (text ?? input).trim();
    if ((!typed && !pendingImage) || loading) return;
    setError("");
    setInput("");

    const defaultText = "Här är en bild från kunden — läs av det du kan (typskylt, felkod, kvitto, symptom etc.).";
    const contentForApi = typed || defaultText;

    let apiContent;
    if (pendingImage) {
      apiContent = [
        { type: "image", source: { type: "base64", media_type: pendingImage.mediaType, data: pendingImage.data } },
        { type: "text", text: contentForApi },
      ];
    } else {
      apiContent = contentForApi;
    }

    const bubble = typed || "📷 Bilaga uppladdad";
    const userMsg = { role: "user", content: bubble, image: pendingImage ? pendingImage.preview : null, raw: apiContent };
    setPendingImage(null);
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setLoading(true);
    try {
      const apiMessages = nextMessages.map((m) => ({ role: m.role, content: m.raw ?? m.content }));
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: buildSystemPrompt(),
          messages: apiMessages,
        }),
      });
      if (!res.ok) {
        throw new Error(`API-fel ${res.status}`);
      }
      const data = await res.json();
      const fullText = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
      if (!fullText) {
        throw new Error("Tomt svar från assistenten");
      }
      const { clean, data: parsed } = parseCase(fullText);
      if (parsed) {
        setCaseData((prev) => ({
          ...prev,
          ...Object.fromEntries(Object.entries(parsed).filter(([, v]) => (Array.isArray(v) ? v.length > 0 : v !== "" && v != null))),
        }));
        if (!countedRef.current && (parsed.status === "lost" || parsed.status === "tekniker")) {
          countedRef.current = true;
          setSessionStats((s) => ({ ...s, [parsed.status]: s[parsed.status] + 1 }));
        }
      }
      // Om texten är tom efter att CASE tagits bort, visa åtminstone en meningsfull fallback
      const displayText = clean || (parsed
        ? "Jag har uppdaterat ärendekortet. Beskriv gärna mer så tar vi det därifrån."
        : "Jag hörde dig – berätta gärna lite mer om vad som händer, så hjälper jag dig vidare.");
      setMessages((prev) => [...prev, { role: "assistant", content: displayText, raw: fullText }]);
    } catch (e) {
      const isBildProblem = e.message && e.message.includes("400");
      const msg = isBildProblem
        ? "Kunde inte läsa bilden – den kan vara i fel format. Prova att ta en ny bild eller skriv frågan utan bild."
        : "Ursäkta – jag fick problem att svara just nu. Kan du försöka igen? Om det fortsätter, ring oss direkt så hjälper vi dig personligen.";
      setMessages((prev) => [...prev, { role: "assistant", content: msg }]);
      setError(e.message || "Kunde inte nå assistenten. Försök igen.");
    } finally {
      setLoading(false);
    }
  };

  const warrantyFor = (c) =>
    (c.garanti_kvitto || c.inkopsdatum)
      ? receiptWarranty(c.inkopsdatum, c.garanti_kvitto)
      : warrantyCheckSerial(c.serienr);

const confirmSubmission = async () => {
    if (!customerForm.namn || !customerForm.personnr || !customerForm.gata || !customerForm.postnr || !customerForm.ort || !customerForm.telefon || !customerForm.epost || !customerForm.rot) {
      setError("Fyll i alla fält innan du skickar in ärendet.");
      return;
    }
    setError("");
    const w = warrantyFor(caseData);
    const fullAdress = `${customerForm.gata}, ${customerForm.postnr} ${customerForm.ort}`;
    const order = {
      id: `AO-${orderCounter.current++}`, slot: "Väntar på kontakt", kund: customerForm.namn,
      createdAt: Date.now(),
      ...caseData,
      kund_namn: customerForm.namn, kund_personnr: customerForm.personnr,
      kund_adress: fullAdress, kund_gata: customerForm.gata, kund_postnr: customerForm.postnr, kund_ort: customerForm.ort,
      kund_telefon: customerForm.telefon,
      kund_epost: customerForm.epost, rot_avdrag: customerForm.rot,
      garanti: caseData.garanti_kvitto
        ? (w ? w.label + " · " + w.pays : caseData.garanti_kvitto)
        : (w ? w.label + " · " + w.pays : "Garantistatus okänd"),
    };
    setOrders((prev) => [order, ...prev]);
    setCaseData((prev) => ({ ...prev, status: "bokad" }));

fetch("/api/chat/save-case", {  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    ...caseData,
    kund_namn: customerForm.namn,
    kund_personnr: customerForm.personnr,
    kund_gata: customerForm.gata,
    kund_postnr: customerForm.postnr,
    kund_ort: customerForm.ort,
    kund_telefon: customerForm.telefon,
    kund_epost: customerForm.epost,
    rot_avdrag: customerForm.rot,
  }),
})
  .then(async (res) => {
    if (!res.ok) {
      const text = await res.text();
      console.error("Save-case misslyckades:", res.status, text);
    } else {
      console.log("Ärende sparat!");
    }
  })
  .catch((e) => console.error("Kunde inte spara:", e));
  const resetCase = () => {
    setCaseData(emptyCase);
    countedRef.current = false;
    setBooking(false);
    setFormSubmitted(false);
    setCustomerForm({ namn: "", personnr: "", gata: "", postnr: "", ort: "", telefon: "", epost: "", rot: "" });
    setMessages([{ role: "assistant", content: "Nytt ärende! Vilken apparat gäller det, och vad är problemet? (Du kan bifoga en bild 📷 när du vill.)" }]);
  };

  const status = STATUS_META[caseData.status] || STATUS_META.pagar;
  const warranty = warrantyFor(caseData);
  const hasReceipt = caseData.butik || caseData.ordernr || caseData.inkopsdatum;
  const fields = [
    ["Produkttyp", caseData.produkttyp], ["Märke", caseData.marke], ["Modell", caseData.modell],
    ["Serienr", caseData.serienr], ["Felkod", caseData.felkod], ["Symptom", caseData.symptom],
  ];

  const totAvvarjda = WEEKS.reduce((a, w) => a + w.avvarjda, 0) + sessionStats.lost;
  const totTekniker = WEEKS.reduce((a, w) => a + w.tekniker, 0) + sessionStats.tekniker;
  const totForbruk = WEEKS.reduce((a, w) => a + w.forbruk, 0) + sessionStats.forbrukKr;
  const besparing = totAvvarjda * 2000;
  const avvarjGrad = Math.round((totAvvarjda / (totAvvarjda + totTekniker)) * 100);
  const ftfNu = WEEKS[WEEKS.length - 1].ftf;
  const co2 = totAvvarjda * 6;

  const S = {
    page: { minHeight: "100vh", background: "#EDEFF1", color: "#1B2733", fontFamily: "'Avenir Next','Segoe UI',system-ui,sans-serif", display: "flex", flexDirection: "column" },
    card: { background: "#FFF", border: "1px solid #D7DCE1", borderRadius: 10 },
    eyebrow: { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "#7A8794", fontWeight: 700 },
    kpi: (label, value, sub, color) => (
      <div key={label} style={{ background: "#FFF", border: "1px solid #D7DCE1", borderRadius: 10, padding: "14px 16px" }}>
        <div style={S.eyebrow}>{label}</div>
        <div style={{ fontSize: 25, fontWeight: 700, color, margin: "4px 0 2px" }}>{value}</div>
        <div style={{ fontSize: 12, color: "#7A8794" }}>{sub}</div>
      </div>
    ),
  };

  return (
    <div style={S.page}>
      <style>{`
        @keyframes fixaTyping {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
      {/* Topbar - anpassad för kunden */}
      {view === "kund" ? (
        <div style={{ background: "#FFFFFF", borderBottom: "1px solid #EAEEF2", padding: "14px 22px", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>🔧</span>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "0.06em", color: "#1B2733" }}>FIXA<span style={{ color: "#F0A03C" }}>.</span></div>
          <div style={{ marginLeft: "auto", fontSize: 12, color: "#9AA6B1" }}>
          </div>
        </div>
      ) : (
        <div style={{ background: "#1B2733", color: "#F2F4F6", padding: "12px 22px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "0.06em" }}>FIXA<span style={{ color: "#F0A03C" }}>.</span></div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Admin</div>
          <div style={{ display: "flex", background: "#2A3A49", borderRadius: 8, padding: 3, flexWrap: "wrap", marginLeft: 6 }}>
            {[
              ["kund", "Kundvy"], ["tekniker", `Tekniker (${orders.length})`],
              ["chef", "Servicechef"],
            ].map(([id, label]) => (
              <button key={id} onClick={() => setView(id)} style={{
                border: "none", cursor: "pointer", borderRadius: 6, padding: "7px 12px", fontSize: 13, fontWeight: 600,
                background: view === id ? "#F0A03C" : "transparent", color: view === id ? "#1B2733" : "#C4CDD5",
              }}>{label}</button>
            ))}
          </div>
        </div>
      )}

      {/* ══════ KUND ══════ */}
      {view === "kund" && (
        <div style={{ flex: 1, display: "flex", padding: 16, maxWidth: 720, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
          <div style={{ ...S.card, flex: 1, display: "flex", flexDirection: "column", minHeight: 600, overflow: "hidden", background: "#FFFFFF" }}>
            {/* Chatthead med FIXA-identitet */}
            <div style={{ background: "linear-gradient(135deg, #2C5A82 0%, #3A6D96 100%)", padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 42, height: 42, borderRadius: "50%",
                background: "linear-gradient(135deg, #F0A03C 0%, #E88A1F 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              }}>🔧</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#FFF", lineHeight: 1.2 }}>FIXA</div>
                <div style={{ fontSize: 12, color: "#B5D0E8", display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ADE80", display: "inline-block" }}></span>
                  Din felsökningsassistent
                </div>
              </div>
            </div>

            <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "20px 18px", background: "#F7F9FB" }}>
              {messages.map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 14, gap: 8, alignItems: "flex-end" }}>
                  {m.role === "assistant" && (
                    <div style={{
                      width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                      background: "linear-gradient(135deg, #F0A03C 0%, #E88A1F 100%)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 16,
                    }}>🔧</div>
                  )}
                  <div style={{
                    maxWidth: "78%", padding: "11px 15px", borderRadius: 18, fontSize: 14.5, lineHeight: 1.55, whiteSpace: "pre-wrap",
                    background: m.role === "user" ? "#4A7BA8" : "#FFFFFF",
                    color: m.role === "user" ? "#FFFFFF" : "#1B2733",
                    borderBottomRightRadius: m.role === "user" ? 4 : 18,
                    borderBottomLeftRadius: m.role === "user" ? 18 : 4,
                    boxShadow: m.role === "user" ? "0 1px 2px rgba(74,123,168,0.2)" : "0 1px 2px rgba(0,0,0,0.06)",
                    border: m.role === "user" ? "none" : "1px solid #EAEEF2",
                  }}>
                    {m.image && <img src={m.image} alt="Bifogad bild" style={{ maxWidth: "100%", borderRadius: 10, marginBottom: m.content && m.content !== "📷 Bilaga uppladdad" ? 8 : 0, display: "block" }} />}
                    {m.content && !(m.image && m.content === "📷 Bilaga uppladdad") && m.content}
                  </div>
                </div>
              ))}

              {loading && (
                <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 14, gap: 8, alignItems: "flex-end" }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                    background: "linear-gradient(135deg, #F0A03C 0%, #E88A1F 100%)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 16,
                  }}>🔧</div>
                  <div style={{
                    padding: "12px 16px", borderRadius: 18, borderBottomLeftRadius: 4,
                    background: "#FFFFFF", border: "1px solid #EAEEF2",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.06)", display: "flex", gap: 8, alignItems: "center",
                  }}>
                    <span style={{ fontSize: 13, color: "#7A8794", fontStyle: "italic" }}>FIXA tänker</span>
                    <span style={{ display: "flex", gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#9AA6B1", animation: "fixaTyping 1.4s infinite ease-in-out", animationDelay: "0s" }}></span>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#9AA6B1", animation: "fixaTyping 1.4s infinite ease-in-out", animationDelay: "0.2s" }}></span>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#9AA6B1", animation: "fixaTyping 1.4s infinite ease-in-out", animationDelay: "0.4s" }}></span>
                    </span>
                  </div>
                </div>
              )}

              {formSubmitted && (
                <div style={{ marginTop: 12, background: "linear-gradient(135deg, #E8F5EE 0%, #D6EEDE 100%)", border: "1px solid #A8D5BC", borderRadius: 16, padding: 20, textAlign: "center" }}>
                  <div style={{ fontSize: 42, marginBottom: 8 }}>✅</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#1E5A3D", marginBottom: 6 }}>
                    Ärendet är mottaget!
                  </div>
                  <div style={{ fontSize: 14, color: "#37485A", lineHeight: 1.5, marginBottom: 12 }}>
                    Ärendenummer: <strong>{orders[0]?.id}</strong>
                  </div>
                  <div style={{ fontSize: 13.5, color: "#37485A", lineHeight: 1.55, background: "#FFFFFF", borderRadius: 10, padding: "12px 14px", textAlign: "left" }}>
                    En tekniker kontaktar dig inom <strong>24 timmar</strong> på {customerForm.telefon} för att boka in en tid som passar.
                    <br /><br />
                    Bekräftelse har skickats till <strong>{customerForm.epost}</strong>.
                  </div>
                  <div style={{ fontSize: 12, color: "#7A8794", marginTop: 12, lineHeight: 1.4 }}>
                    Rör inget inuti eller bakom apparaten innan teknikern kommer.
                  </div>
                </div>
              )}

              {caseData.status === "tekniker" && !formSubmitted && (
                <div style={{ ...S.card, padding: 16, marginTop: 6, borderLeft: "4px solid #2C5A82" }}>
                  <div style={{ ...S.eyebrow, marginBottom: 4, color: "#2C5A82" }}>Sista steget — dina uppgifter</div>
                  <div style={{ fontSize: 13, color: "#37485A", marginBottom: 12 }}>
                    En tekniker behöver komma ut. Fyll i dina uppgifter så kontaktar vi dig inom 24 timmar för att boka en tid. Uppgifterna hanteras konfidentiellt enligt GDPR.
                  </div>
                  <div style={{ display: "grid", gap: 10 }}>
                    <input placeholder="För- och efternamn" value={customerForm.namn} onChange={(e) => setCustomerForm({ ...customerForm, namn: e.target.value })}
                      style={{ padding: "10px 12px", border: "1px solid #C9D1D8", borderRadius: 8, fontSize: 16 }} />
                    <input placeholder="Personnummer (ÅÅÅÅMMDD-XXXX)" value={customerForm.personnr} onChange={(e) => setCustomerForm({ ...customerForm, personnr: e.target.value })}
                      style={{ padding: "10px 12px", border: "1px solid #C9D1D8", borderRadius: 8, fontSize: 16 }} />
                    <input placeholder="Gatuadress" value={customerForm.gata} onChange={(e) => setCustomerForm({ ...customerForm, gata: e.target.value })}
                      style={{ padding: "10px 12px", border: "1px solid #C9D1D8", borderRadius: 8, fontSize: 16 }} />
                    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 10 }}>
                      <input placeholder="Postnummer" value={customerForm.postnr} onChange={(e) => setCustomerForm({ ...customerForm, postnr: e.target.value })}
                        style={{ padding: "10px 12px", border: "1px solid #C9D1D8", borderRadius: 8, fontSize: 16, minWidth: 0 }} />
                      <input placeholder="Ort" value={customerForm.ort} onChange={(e) => setCustomerForm({ ...customerForm, ort: e.target.value })}
                        style={{ padding: "10px 12px", border: "1px solid #C9D1D8", borderRadius: 8, fontSize: 16, minWidth: 0 }} />
                    </div>
                    <input placeholder="Telefonnummer" value={customerForm.telefon} onChange={(e) => setCustomerForm({ ...customerForm, telefon: e.target.value })}
                      style={{ padding: "10px 12px", border: "1px solid #C9D1D8", borderRadius: 8, fontSize: 16 }} />
                    <input placeholder="E-postadress" value={customerForm.epost} onChange={(e) => setCustomerForm({ ...customerForm, epost: e.target.value })}
                      style={{ padding: "10px 12px", border: "1px solid #C9D1D8", borderRadius: 8, fontSize: 16 }} />
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 2px" }}>
                      <span style={{ fontSize: 13.5, color: "#37485A" }}>Vill du använda ROT-avdrag?</span>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => setCustomerForm({ ...customerForm, rot: "ja" })} style={{
                          border: "1px solid #2C5A82", background: customerForm.rot === "ja" ? "#2C5A82" : "#FFF",
                          color: customerForm.rot === "ja" ? "#FFF" : "#2C5A82",
                          borderRadius: 6, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer"
                        }}>Ja</button>
                        <button onClick={() => setCustomerForm({ ...customerForm, rot: "nej" })} style={{
                          border: "1px solid #2C5A82", background: customerForm.rot === "nej" ? "#2C5A82" : "#FFF",
                          color: customerForm.rot === "nej" ? "#FFF" : "#2C5A82",
                          borderRadius: 6, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer"
                        }}>Nej</button>
                      </div>
                    </div>
                  </div>
                  {caseData.specialist && (
                    <div style={{ fontSize: 12.5, color: "#2C5A82", margin: "12px 0 6px" }}>Rätt kompetens: <strong>{caseData.specialist}</strong></div>
                  )}
                  <button onClick={confirmSubmission} style={{ background: "#2C5A82", color: "#FFF", border: "none", borderRadius: 8, padding: "12px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer", marginTop: 10, width: "100%" }}>
                    Skicka in ärendet
                  </button>
                </div>
              )}

              {(caseData.status === "lost" || caseData.status === "bokad") && (
                <button onClick={resetCase} style={{ marginTop: 8, border: "1px solid #C9D1D8", background: "#F7F9FA", color: "#37485A", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer" }}>
                  + Starta nytt ärende
                </button>
              )}

              {loading && <div style={{ fontSize: 13, color: "#7A8794" }}>FIXA analyserar…</div>}
              {error && <div style={{ fontSize: 13, color: "#A3352B" }}>{error}</div>}
            </div>

            {!caseData.produkttyp && caseData.status === "pagar" && (
              <div style={{ padding: "0 18px 12px", display: "flex", gap: 8, flexWrap: "wrap", background: "#FFFFFF" }}>
                {QUICK_STARTS.map((q) => (
                  <button key={q} onClick={() => send(q)} style={{ border: "1px solid #E2E6EA", background: "#F7F9FB", color: "#2C5A82", borderRadius: 20, padding: "8px 14px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>{q}</button>
                ))}
              </div>
            )}

            {pendingImage && (
              <div style={{ margin: "0 14px 10px", padding: 10, background: "#F7F9FB", borderRadius: 12, display: "flex", alignItems: "center", gap: 10, border: "1px solid #E2E6EA" }}>
                <img src={pendingImage.preview} alt="Förhandsvisning" style={{ height: 52, borderRadius: 8 }} />
                <span style={{ fontSize: 13, color: "#37485A", flex: 1 }}>
                  Bilaga redo — skriv gärna vad den visar.
                </span>
                <button onClick={() => setPendingImage(null)} style={{ border: "none", background: "transparent", color: "#7A8794", cursor: "pointer", fontSize: 16 }}>✕</button>
              </div>
            )}

            <div style={{ borderTop: "1px solid #EAEEF2", padding: 14, display: "flex", gap: 10, background: "#FFFFFF", alignItems: "center" }}>
              <input ref={fileRef} type="file" accept="image/*" onChange={onPickFile} style={{ display: "none" }} />
              <button onClick={() => pickImage("product")} title="Bifoga foto" style={{ border: "1px solid #E2E6EA", background: "#F7F9FB", borderRadius: 22, width: 44, height: 44, fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>📷</button>
              <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Skriv ett meddelande…"
                style={{ flex: 1, border: "1px solid #E2E6EA", borderRadius: 22, padding: "12px 18px", fontSize: 16, outline: "none", background: "#F7F9FB" }} />
              <button onClick={() => send()} disabled={loading} style={{ background: loading ? "#C9D1D8" : "#2C5A82", border: "none", color: "#FFFFFF", fontWeight: 700, borderRadius: 22, padding: "0 22px", height: 44, fontSize: 14.5, cursor: loading ? "default" : "pointer", boxShadow: loading ? "none" : "0 2px 6px rgba(44,90,130,0.25)" }}>Skicka</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════ TEKNIKER ══════ */}
      {view === "tekniker" && (() => {
        const selectedOrder = orders.find((o) => o.id === selectedOrderId) || orders[0];
        const sortedOrders = [...orders].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        const urgentCount = orders.filter((o) => {
          const tl = timeLeft(o.createdAt);
          return tl.urgency === "critical" || tl.urgency === "over";
        }).length;

        return (
        <div style={{ flex: 1, padding: 16, maxWidth: 1200, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>Inkomna ärenden</h2>
            <span style={{ fontSize: 13, color: "#7A8794" }}>{orders.length} totalt</span>
            {urgentCount > 0 && (
              <span style={{ fontSize: 12, background: "#FDECEA", color: "#A3352B", borderRadius: 12, padding: "3px 10px", fontWeight: 700 }}>
                ⚠ {urgentCount} kräver återkoppling snart
              </span>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 14, alignItems: "start" }}>

            {/* VÄNSTER: Lista av ärenden */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {sortedOrders.map((o) => {
                const tl = timeLeft(o.createdAt);
                const isSelected = o.id === (selectedOrder && selectedOrder.id);
                const urgencyColor = tl.urgency === "over" ? "#A3352B" : tl.urgency === "critical" ? "#C77B1E" : tl.urgency === "warning" ? "#8A5A10" : "#1E7A4D";
                const urgencyBg = tl.urgency === "over" ? "#FDECEA" : tl.urgency === "critical" ? "#FBF1E3" : tl.urgency === "warning" ? "#FBF1E3" : "#E4F3EB";
                return (
                  <button key={o.id} onClick={() => setSelectedOrderId(o.id)} style={{
                    ...S.card, padding: 12, textAlign: "left", cursor: "pointer",
                    border: isSelected ? "2px solid #2C5A82" : "1px solid #E2E6EA",
                    background: isSelected ? "#F7FAFC" : "#FFFFFF",
                    display: "flex", flexDirection: "column", gap: 6,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                      <strong style={{ fontSize: 14, color: "#1B2733" }}>{o.kund_namn || o.kund}</strong>
                      <span style={{ fontSize: 11, color: "#7A8794", fontFamily: "ui-monospace,Menlo,monospace" }}>{o.id}</span>
                    </div>
                    <div style={{ fontSize: 13, color: "#37485A" }}>
                      {o.produkttyp}{o.marke ? ` · ${o.marke}` : ""}{o.modell ? ` ${o.modell}` : ""}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, marginTop: 2 }}>
                      <span style={{ fontSize: 11.5, color: "#7A8794" }}>{timeSince(o.createdAt)}</span>
                      <span style={{ fontSize: 11.5, color: urgencyColor, background: urgencyBg, borderRadius: 10, padding: "2px 8px", fontWeight: 700 }}>
                        {tl.text}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* HÖGER: Detaljvy */}
            {selectedOrder && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

                {/* Header */}
                <div style={{ ...S.card, padding: 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: "#1B2733" }}>{selectedOrder.kund_namn || selectedOrder.kund}</div>
                      <div style={{ fontSize: 13, color: "#7A8794", fontFamily: "ui-monospace,Menlo,monospace", marginTop: 2 }}>{selectedOrder.id}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 12, color: "#7A8794" }}>Inskickat {timeSince(selectedOrder.createdAt)}</div>
                      {(() => {
                        const tl = timeLeft(selectedOrder.createdAt);
                        const c = tl.urgency === "over" ? "#A3352B" : tl.urgency === "critical" ? "#C77B1E" : tl.urgency === "warning" ? "#8A5A10" : "#1E7A4D";
                        const bg = tl.urgency === "over" ? "#FDECEA" : tl.urgency === "critical" ? "#FBF1E3" : tl.urgency === "warning" ? "#FBF1E3" : "#E4F3EB";
                        return (
                          <div style={{ marginTop: 4, fontSize: 13, fontWeight: 700, color: c, background: bg, borderRadius: 8, padding: "4px 10px", display: "inline-block" }}>
                            🕐 {tl.text} till 24h-återkoppling
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Kontakta kunden */}
                <div style={{ ...S.card, padding: 18, borderLeft: "4px solid #2C5A82" }}>
                  <div style={{ ...S.eyebrow, marginBottom: 12, color: "#2C5A82" }}>📞 Kontakta kunden</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 11.5, color: "#7A8794", marginBottom: 2 }}>TELEFON</div>
                      <a href={`tel:${selectedOrder.kund_telefon || ""}`} style={{ fontSize: 15, color: "#2C5A82", fontWeight: 600, textDecoration: "none" }}>
                        {selectedOrder.kund_telefon || "—"}
                      </a>
                    </div>
                    <div>
                      <div style={{ fontSize: 11.5, color: "#7A8794", marginBottom: 2 }}>E-POST</div>
                      <a href={`mailto:${selectedOrder.kund_epost || ""}`} style={{ fontSize: 14, color: "#2C5A82", fontWeight: 600, textDecoration: "none" }}>
                        {selectedOrder.kund_epost || "—"}
                      </a>
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <div style={{ fontSize: 11.5, color: "#7A8794", marginBottom: 2 }}>ADRESS</div>
                      <div style={{ fontSize: 14, color: "#1B2733" }}>{selectedOrder.kund_adress || "—"}</div>
                    </div>
                    {selectedOrder.rot_avdrag && (
                      <div>
                        <div style={{ fontSize: 11.5, color: "#7A8794", marginBottom: 2 }}>ROT-AVDRAG</div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: selectedOrder.rot_avdrag === "ja" ? "#1E7A4D" : "#7A8794", background: selectedOrder.rot_avdrag === "ja" ? "#E4F3EB" : "#F0F2F4", borderRadius: 6, padding: "3px 10px", display: "inline-block" }}>
                          {selectedOrder.rot_avdrag === "ja" ? "✓ Ja" : "Nej"}
                        </span>
                      </div>
                    )}
                    {selectedOrder.kund_personnr && (
                      <div>
                        <div style={{ fontSize: 11.5, color: "#7A8794", marginBottom: 2 }}>PERSONNUMMER</div>
                        <div style={{ fontSize: 13, color: "#1B2733", fontFamily: "ui-monospace,Menlo,monospace" }}>{selectedOrder.kund_personnr}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Vitvaran & felet */}
                <div style={{ ...S.card, padding: 18 }}>
                  <div style={{ ...S.eyebrow, marginBottom: 12 }}>🔧 Vitvaran & problemet</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12, marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 11.5, color: "#7A8794", marginBottom: 2 }}>PRODUKTTYP</div>
                      <div style={{ fontSize: 14, color: "#1B2733", fontWeight: 600 }}>{selectedOrder.produkttyp || "—"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11.5, color: "#7A8794", marginBottom: 2 }}>MÄRKE / MODELL</div>
                      <div style={{ fontSize: 14, color: "#1B2733", fontFamily: "ui-monospace,Menlo,monospace" }}>{[selectedOrder.marke, selectedOrder.modell].filter(Boolean).join(" ") || "—"}</div>
                    </div>
                    {selectedOrder.serienr && (
                      <div>
                        <div style={{ fontSize: 11.5, color: "#7A8794", marginBottom: 2 }}>SERIENUMMER</div>
                        <div style={{ fontSize: 13, color: "#1B2733", fontFamily: "ui-monospace,Menlo,monospace" }}>{selectedOrder.serienr}</div>
                      </div>
                    )}
                    {selectedOrder.felkod && selectedOrder.felkod !== "—" && (
                      <div>
                        <div style={{ fontSize: 11.5, color: "#7A8794", marginBottom: 2 }}>FELKOD</div>
                        <div style={{ fontSize: 14, color: "#1B2733", fontWeight: 700, fontFamily: "ui-monospace,Menlo,monospace" }}>{selectedOrder.felkod}</div>
                      </div>
                    )}
                  </div>

                  {selectedOrder.symptom && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11.5, color: "#7A8794", marginBottom: 4 }}>SYMPTOM</div>
                      <div style={{ fontSize: 14, color: "#1B2733", lineHeight: 1.5 }}>{selectedOrder.symptom}</div>
                    </div>
                  )}

                  {selectedOrder.atgarder && selectedOrder.atgarder.length > 0 && (
                    <div style={{ marginBottom: 4 }}>
                      <div style={{ fontSize: 11.5, color: "#7A8794", marginBottom: 6 }}>REDAN TESTAT AV KUNDEN</div>
                      {selectedOrder.atgarder.map((a, i) => (
                        <div key={i} style={{ fontSize: 13, color: "#37485A", padding: "3px 0" }}>✓ {a}</div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Diagnos & åtgärd */}
                {(selectedOrder.trolig_orsak || selectedOrder.reservdel || selectedOrder.specialist) && (
                  <div style={{ ...S.card, padding: 18, borderLeft: "4px solid #1E7A4D" }}>
                    <div style={{ ...S.eyebrow, marginBottom: 12, color: "#1E7A4D" }}>🧰 FIXA:s bedömning</div>
                    {selectedOrder.specialist && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 11.5, color: "#7A8794", marginBottom: 2 }}>RÄTT KOMPETENS</div>
                        <div style={{ fontSize: 14, color: "#1B2733", fontWeight: 600 }}>{selectedOrder.specialist}</div>
                      </div>
                    )}
                    {selectedOrder.trolig_orsak && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 11.5, color: "#7A8794", marginBottom: 2 }}>TROLIG ORSAK</div>
                        <div style={{ fontSize: 14, color: "#1B2733", lineHeight: 1.5 }}>{selectedOrder.trolig_orsak}</div>
                      </div>
                    )}
                    {selectedOrder.reservdel && (
                      <div style={{ background: "#E4F3EB", borderRadius: 8, padding: "10px 12px", marginTop: 10 }}>
                        <div style={{ fontSize: 11.5, color: "#1E7A4D", marginBottom: 2, fontWeight: 700 }}>TA MED TILL BESÖKET</div>
                        <div style={{ fontSize: 14, color: "#1B2733", fontWeight: 600 }}>{selectedOrder.reservdel}</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Sammanfattning */}
                {selectedOrder.rapport && (
                  <div style={{ ...S.card, padding: 18, background: "#F7F9FB" }}>
                    <div style={{ ...S.eyebrow, marginBottom: 8 }}>📋 Sammanfattning från FIXA</div>
                    <div style={{ fontSize: 13.5, color: "#37485A", lineHeight: 1.6 }}>{selectedOrder.rapport}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        );
      })()}

      {/* ══════ SERVICECHEF ══════ */}
      {view === "chef" && (() => {
        // Beräkna nyckeltal utifrån faktiska ärenden i systemet + demodata
        const totaltArenden = 372; // Basvolym demo + orders
        const totaltArendenAktuella = orders.length + totaltArenden;
        const lostPaDistans = sessionStats.lost + 34; // demo + session
        const vidareToTeknik = orders.length + 338; // demo + session
        const distansAndel = Math.round((lostPaDistans / totaltArendenAktuella) * 100);
        const teknikerAndel = Math.round((vidareToTeknik / totaltArendenAktuella) * 100);

        // Vanligaste vitvaran från riktiga ärenden
        const vitvarutypRaknare = {};
        orders.forEach((o) => {
          if (o.produkttyp) vitvarutypRaknare[o.produkttyp] = (vitvarutypRaknare[o.produkttyp] || 0) + 1;
        });
        // Kombinera med demodata
        const demoVitvara = { "Tvättmaskin": 156, "Diskmaskin": 89, "Kyl/frys": 67, "Ugn": 34, "Torktumlare": 26 };
        Object.keys(vitvarutypRaknare).forEach((k) => {
          demoVitvara[k] = (demoVitvara[k] || 0) + vitvarutypRaknare[k];
        });
        const sortAppliances = Object.entries(demoVitvara).sort((a, b) => b[1] - a[1]);
        const mostCommon = sortAppliances[0];
        const totalMed = sortAppliances.reduce((s, [, v]) => s + v, 0);

        // Vanligaste orsak (från reservdelsförslag)
        const orsakRaknare = { "Pumpfel": 47, "Filter igensatt": 32, "Termostatfel": 28, "Motorfel": 19, "Kretskortsfel": 15 };
        orders.forEach((o) => {
          if (o.trolig_orsak) orsakRaknare[o.trolig_orsak] = (orsakRaknare[o.trolig_orsak] || 0) + 1;
        });
        const sortOrsaker = Object.entries(orsakRaknare).sort((a, b) => b[1] - a[1]);
        const mostCommonOrsak = sortOrsaker[0];
        const totalOrsaker = sortOrsaker.reduce((s, [, v]) => s + v, 0);

        return (
        <div style={{ flex: 1, padding: 16, maxWidth: 1080, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>Pilot — Servicechefens vy</h2>
          </div>
          <div style={{ fontSize: 13, color: "#7A8794", marginBottom: 18, maxWidth: 720, lineHeight: 1.5 }}>
            Övergripande statistik för FIXA-piloten på icke-garantiärenden. Datan används för att bevisa värde för Elon Group vid nästa steg.
          </div>

          {/* GRUNDNYCKELTAL - 5 stora */}
          <div style={{ ...S.eyebrow, marginBottom: 10 }}>Grundnyckeltal</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginBottom: 22 }}>
            <div style={{ ...S.card, padding: 16 }}>
              <div style={{ fontSize: 11.5, color: "#7A8794", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Antal ärenden</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#1B2733", lineHeight: 1 }}>{fmt(totaltArendenAktuella)}</div>
              <div style={{ fontSize: 12, color: "#1E7A4D", marginTop: 6, fontWeight: 600 }}>↑ 12 % vs föregående vecka</div>
            </div>

            <div style={{ ...S.card, padding: 16, background: "linear-gradient(135deg, #E4F3EB 0%, #D0EBDA 100%)", border: "1px solid #A8D5BC" }}>
              <div style={{ fontSize: 11.5, color: "#1E5A3D", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Löst på distans ⭐</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#1E5A3D", lineHeight: 1 }}>{distansAndel} %</div>
              <div style={{ fontSize: 12.5, color: "#1E5A3D", marginTop: 6, fontWeight: 600 }}>{fmt(lostPaDistans)} ärenden — inga besök</div>
            </div>

            <div style={{ ...S.card, padding: 16 }}>
              <div style={{ fontSize: 11.5, color: "#7A8794", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Vidare till tekniker</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#1B2733", lineHeight: 1 }}>{teknikerAndel} %</div>
              <div style={{ fontSize: 12.5, color: "#7A8794", marginTop: 6 }}>{fmt(vidareToTeknik)} ärenden med förberett underlag</div>
            </div>

            <div style={{ ...S.card, padding: 16 }}>
              <div style={{ fontSize: 11.5, color: "#7A8794", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Triage-tid ⌀</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#1B2733", lineHeight: 1 }}>4:22</div>
              <div style={{ fontSize: 12.5, color: "#7A8794", marginTop: 6 }}>min per ärende</div>
            </div>

            <div style={{ ...S.card, padding: 16 }}>
              <div style={{ fontSize: 11.5, color: "#7A8794", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Kundnöjdhet (NPS)</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#1B2733", lineHeight: 1 }}>8,4<span style={{ fontSize: 16, color: "#7A8794" }}>/10</span></div>
              <div style={{ fontSize: 12, color: "#7A8794", marginTop: 6 }}>Baserat på 187 svar efter avslutat ärende</div>
            </div>
          </div>

          {/* SEKUNDÄRA NYCKELTAL */}
          <div style={{ ...S.eyebrow, marginBottom: 10 }}>Sekundära nyckeltal</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 12, marginBottom: 22 }}>
            {/* Vanligaste vitvara */}
            <div style={{ ...S.card, padding: 18 }}>
              <div style={{ ...S.eyebrow, marginBottom: 12 }}>Vanligaste vitvaran</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#1B2733", marginBottom: 4 }}>{mostCommon[0]}</div>
              <div style={{ fontSize: 13, color: "#7A8794", marginBottom: 14 }}>{Math.round((mostCommon[1] / totalMed) * 100)} % av alla ärenden ({fmt(mostCommon[1])} st)</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sortAppliances.slice(0, 5).map(([namn, antal]) => {
                  const pct = Math.round((antal / totalMed) * 100);
                  return (
                    <div key={namn} style={{ display: "grid", gridTemplateColumns: "110px 1fr 60px", gap: 10, alignItems: "center", fontSize: 13 }}>
                      <span style={{ color: "#37485A" }}>{namn}</span>
                      <div style={{ height: 8, background: "#E9EDF0", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: "#2C5A82", borderRadius: 4 }} />
                      </div>
                      <span style={{ color: "#7A8794", textAlign: "right", fontSize: 12.5 }}>{pct} %</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Vanligaste orsak */}
            <div style={{ ...S.card, padding: 18 }}>
              <div style={{ ...S.eyebrow, marginBottom: 12 }}>Vanligaste orsak till besök</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#1B2733", marginBottom: 4 }}>{mostCommonOrsak[0]}</div>
              <div style={{ fontSize: 13, color: "#7A8794", marginBottom: 14 }}>{Math.round((mostCommonOrsak[1] / totalOrsaker) * 100)} % av tekniker-ärenden ({fmt(mostCommonOrsak[1])} st)</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sortOrsaker.slice(0, 5).map(([namn, antal]) => {
                  const pct = Math.round((antal / totalOrsaker) * 100);
                  return (
                    <div key={namn} style={{ display: "grid", gridTemplateColumns: "130px 1fr 60px", gap: 10, alignItems: "center", fontSize: 13 }}>
                      <span style={{ color: "#37485A" }}>{namn}</span>
                      <div style={{ height: 8, background: "#E9EDF0", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: "#F0A03C", borderRadius: 4 }} />
                      </div>
                      <span style={{ color: "#7A8794", textAlign: "right", fontSize: 12.5 }}>{pct} %</span>
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: 12, color: "#7A8794", marginTop: 12, lineHeight: 1.4, fontStyle: "italic" }}>
                Guld för samtalet med Elvita-fabriken.
              </div>
            </div>
          </div>

          {/* GRAF: Utveckling över tid */}
          <div style={{ ...S.eyebrow, marginBottom: 10 }}>Utveckling över tid</div>
          <div style={{ ...S.card, padding: 16, marginBottom: 22 }}>
            <div style={{ ...S.eyebrow, marginBottom: 10 }}>Löst på distans vs vidare till tekniker per vecka</div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={WEEKS}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EA" />
                <XAxis dataKey="v" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="avvarjda" name="Löst på distans" stackId="a" fill="#1E7A4D" />
                <Bar dataKey="tekniker" name="Vidare till tekniker" stackId="a" fill="#9AA6B1" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ fontSize: 11.5, color: "#8A96A1", padding: "0 4px" }}>
            Demodata blandas med session-data live från kundvyn. NPS-poäng är fiktiv tills verklig enkätfunktion är på plats.
          </div>
        </div>
        );
      })()}

    </div>
  );
}
}
