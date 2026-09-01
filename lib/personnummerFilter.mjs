// Maskerar svenska personnummer (inkl. samordningsnummer) i fri text -
// t.ex. text som lästs av från kvittobilder i chatten - INNAN texten
// sparas i databasen eller skickas vidare.
//
// Format som täcks:
//   ÅÅÅÅMMDD-XXXX   ÅÅMMDD-XXXX
//   ÅÅÅÅMMDDXXXX    ÅÅMMDDXXXX
//   (samma med "+" som avgränsare, används för personer över 100 år)
// samt samordningsnummer (dag + 60, dvs. dag 61-91 istället för 01-31).
//
// Principen är medvetet konservativ: vi kräver att siffrorna bildar ett
// giltigt datum (månad 01-12, dag 01-31 eller 61-91), men kontrollerar
// INTE kontrollsiffran (Luhn/mod-10). Det gör att t.ex. ett ordernummer
// som råkar se ut som ett personnummer (ÅÅÅÅMMDD-XXXX) också maskeras -
// hellre maskera en gång för mycket än att missa ett riktigt personnummer.

const MASK = "[MASKERAT]";

const MONTH = "(?:0[1-9]|1[0-2])";
const DAY = "(?:0[1-9]|[12]\\d|3[01]|6[1-9]|7\\d|8\\d|9[01])"; // 01-31 eller 61-91 (samordningsnummer)
const SEP = "[-+]?";

function personnummerRegex() {
  // (sekel)?(år)(månad)(dag)(avgränsare)(4 siffror)
  return new RegExp(`\\b(?:\\d{2})?\\d{2}${MONTH}${DAY}${SEP}\\d{4}\\b`, "g");
}

// Maskerar alla personnummer-liknande sekvenser i en textsträng.
// Icke-strängar (null, undefined, tal, osv.) returneras oförändrade.
export function maskPersonnummer(text) {
  if (typeof text !== "string" || text.length === 0) return text;
  return text.replace(personnummerRegex(), MASK);
}

// Maskerar personnummer i alla strängfält i ett objekt (en nivå djupt),
// t.ex. caseData innan den skrivs till Supabase. Fältnamn i `skipFields`
// lämnas orörda - används för fält där personnummer avsiktligt samlas in
// (t.ex. kund_personnr för ROT-avdrag), till skillnad från personnummer
// som råkar dyka upp i fritext från en avläst kvittobild.
export function maskPersonnummerInObject(obj, skipFields = []) {
  if (!obj || typeof obj !== "object") return obj;
  const result = { ...obj };
  for (const key of Object.keys(result)) {
    if (skipFields.includes(key)) continue;
    if (typeof result[key] === "string") {
      result[key] = maskPersonnummer(result[key]);
    }
  }
  return result;
}
