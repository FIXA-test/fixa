import { test } from "node:test";
import assert from "node:assert/strict";
import { loadConsent, saveConsent, hasConsent, CONSENT_STORAGE_KEY, CONSENT_TTL_MS } from "./cookieConsent.mjs";

// Enkel in-memory-mock av localStorage - testerna körs i plain Node (ingen DOM).
function makeStorage(initial = {}) {
  const store = { ...initial };
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    _dump: () => ({ ...store }),
  };
}

test("loadConsent returnerar null när inget är sparat", () => {
  const storage = makeStorage();
  assert.equal(loadConsent(storage), null);
});

test("hasConsent('necessary') är alltid true, även utan sparat val", () => {
  const storage = makeStorage();
  assert.equal(hasConsent("necessary", storage), true);
});

test("hasConsent('functional') är false innan ett val sparats", () => {
  const storage = makeStorage();
  assert.equal(hasConsent("functional", storage), false);
});

test("saveConsent({functional:true}) gör hasConsent('functional') true", () => {
  const storage = makeStorage();
  saveConsent({ functional: true }, storage);
  assert.equal(hasConsent("functional", storage), true);
});

test("saveConsent({functional:false}) rensar de funktionella nycklarna", () => {
  const storage = makeStorage({
    fixa_draft_case: "{}",
    fixa_orders: "[]",
    fixa_stats: "{}",
  });
  saveConsent({ functional: false }, storage);
  const dump = storage._dump();
  assert.equal("fixa_draft_case" in dump, false);
  assert.equal("fixa_orders" in dump, false);
  assert.equal("fixa_stats" in dump, false);
  // Samtyckesposten själv ska förstås inte rensas
  assert.ok(dump[CONSENT_STORAGE_KEY]);
});

test("saveConsent({functional:true}) rör INTE tidigare sparad funktionell data", () => {
  const storage = makeStorage({ fixa_orders: "[1,2,3]" });
  saveConsent({ functional: true }, storage);
  assert.equal(storage.getItem("fixa_orders"), "[1,2,3]");
});

test("ett utgånget samtycke räknas som inget samtycke alls", () => {
  const storage = makeStorage();
  const now = Date.now();
  saveConsent({ functional: true }, storage, now - CONSENT_TTL_MS - 1000);
  assert.equal(loadConsent(storage), null);
  assert.equal(hasConsent("functional", storage), false);
});

test("en trasig/ogiltig JSON-post i lagringen behandlas som inget samtycke", () => {
  const storage = makeStorage({ [CONSENT_STORAGE_KEY]: "{inte giltig json" });
  assert.equal(loadConsent(storage), null);
});

test("en post med fel version (t.ex. från en framtida kategoriändring) ignoreras", () => {
  const storage = makeStorage();
  saveConsent({ functional: true }, storage);
  const record = JSON.parse(storage.getItem(CONSENT_STORAGE_KEY));
  record.version = 999;
  storage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record));
  assert.equal(loadConsent(storage), null);
});

test("saveConsent returnerar posten den sparade, med necessary alltid true", () => {
  const storage = makeStorage();
  const record = saveConsent({ functional: false }, storage);
  assert.equal(record.categories.necessary, true);
  assert.equal(record.categories.functional, false);
  assert.ok(record.expiresAt > record.givenAt);
});
