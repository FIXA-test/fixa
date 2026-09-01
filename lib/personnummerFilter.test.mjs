import { test } from "node:test";
import assert from "node:assert/strict";
import { maskPersonnummer, maskPersonnummerInObject } from "./personnummerFilter.mjs";

test("maskerar personnummer med bindestreck, kort format (ÅÅMMDD-XXXX)", () => {
  assert.equal(
    maskPersonnummer("Kvitto tillhör 850613-1234, ring vid frågor."),
    "Kvitto tillhör [MASKERAT], ring vid frågor."
  );
});

test("maskerar personnummer utan bindestreck, kort format (ÅÅMMDDXXXX)", () => {
  assert.equal(maskPersonnummer("Kund: 8506131234"), "Kund: [MASKERAT]");
});

test("maskerar personnummer med bindestreck, långt format (ÅÅÅÅMMDD-XXXX)", () => {
  assert.equal(
    maskPersonnummer("Personnummer 19850613-1234 noterat på kvittot"),
    "Personnummer [MASKERAT] noterat på kvittot"
  );
});

test("maskerar personnummer utan bindestreck, långt format (ÅÅÅÅMMDDXXXX)", () => {
  assert.equal(maskPersonnummer("199510312222 stod på lappen"), "[MASKERAT] stod på lappen");
});

test("maskerar personnummer med plus-avgränsare (över 100 år)", () => {
  assert.equal(maskPersonnummer("Kund 200101+1234"), "Kund [MASKERAT]");
});

test("maskerar samordningsnummer, kort format (dag+60)", () => {
  // 13 -> 73 (13 + 60)
  assert.equal(maskPersonnummer("Samordningsnr: 850673-1234"), "Samordningsnr: [MASKERAT]");
});

test("maskerar samordningsnummer, långt format utan bindestreck", () => {
  assert.equal(maskPersonnummer("199506731234 finns med"), "[MASKERAT] finns med");
});

test("mellanslag som avgränsare stöds inte (endast '-', '+' eller inget)", () => {
  const text = "19850673 1234 finns med";
  assert.equal(maskPersonnummer(text), text);
});

test("maskerar flera personnummer i samma text", () => {
  assert.equal(
    maskPersonnummer("Kund 850613-1234, medsökande 900101-5678."),
    "Kund [MASKERAT], medsökande [MASKERAT]."
  );
});

test("lämnar text utan personnummer orörd", () => {
  const text = "Kylskåp Electrolux, modell EN3201, felkod E45.";
  assert.equal(maskPersonnummer(text), text);
});

test("hanterar null/undefined/icke-sträng utan att krascha", () => {
  assert.equal(maskPersonnummer(null), null);
  assert.equal(maskPersonnummer(undefined), undefined);
  assert.equal(maskPersonnummer(42), 42);
  assert.equal(maskPersonnummer(""), "");
});

test("false positive: ordernummer med ogiltig månad/dag maskeras INTE", () => {
  // 99 kan inte vara månad, 88 kan inte vara dag -> matchar inte mönstret alls
  const text = "Ordernummer 202499-8899";
  assert.equal(maskPersonnummer(text), text);
});

test("false positive: rent löpnummer utan datumstruktur maskeras INTE", () => {
  const text = "Ärendenr: 1122334455";
  assert.equal(maskPersonnummer(text), text);
});

test("konservativt: ordernummer som RÅKAR se ut som personnummer maskeras ändå (medvetet val)", () => {
  // 20240115-4589 tolkas som sekel 20, år 24, månad 01, dag 15 -> giltigt "datum",
  // så det maskeras trots att det egentligen är ett ordernummer. Detta är
  // avsiktligt: hellre maskera en gång för mycket än missa ett riktigt
  // personnummer (kontrollsiffran valideras medvetet inte).
  assert.equal(
    maskPersonnummer("Ordernummer 20240115-4589 på kvittot"),
    "Ordernummer [MASKERAT] på kvittot"
  );
});

test("kort telefonnummer (9-10 siffror) med ogiltigt datum maskeras INTE", () => {
  const text = "Ring 070-1234567";
  assert.equal(maskPersonnummer(text), text);
});

test("maskPersonnummerInObject maskerar strängfält men hoppar över skipFields", () => {
  const input = {
    kund_personnr: "850613-1234",
    rapport: "Läste av kvitto, kundens personnr 900101-5678 stod med av misstag.",
    produkttyp: "Kylskåp",
    pris: 1999,
  };
  const result = maskPersonnummerInObject(input, ["kund_personnr"]);
  assert.equal(result.kund_personnr, "850613-1234"); // avsiktligt insamlat fält, orört
  assert.equal(
    result.rapport,
    "Läste av kvitto, kundens personnr [MASKERAT] stod med av misstag."
  );
  assert.equal(result.produkttyp, "Kylskåp");
  assert.equal(result.pris, 1999); // icke-sträng, orörd
});

test("maskPersonnummerInObject hanterar null/icke-objekt utan att krascha", () => {
  assert.equal(maskPersonnummerInObject(null), null);
  assert.equal(maskPersonnummerInObject(undefined), undefined);
});
