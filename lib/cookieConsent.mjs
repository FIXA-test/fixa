// Samtyckeslagring för cookiebannern (se app/components/CookieConsentProvider.jsx).
//
// Kategorierna nedan speglar exakt vad kodbasen faktiskt gör med
// localStorage idag - ingen analys-/marknadsföringskategori finns eftersom
// inget sådant är inbyggt (se undersökningen som föregick den här filen).
// "necessary" har bara samtyckesvalet självt att lagra - undantaget kravet
// på samtycke per definition. "functional" är de tre nycklar som
// app/page.jsx skriver för att komma ihåg en pågående chatt, lokala
// arbetsordrar och sessionsstatistik mellan besök.
export const CONSENT_STORAGE_KEY = "fixa_cookie_consent";
const CONSENT_VERSION = 1;
// ~12 månader, per överenskommelse.
export const CONSENT_TTL_MS = 365 * 24 * 60 * 60 * 1000;

export const COOKIE_CATEGORIES = [
  {
    id: "necessary",
    label: "Nödvändiga",
    locked: true,
    description: "Behövs för att komma ihåg vilket val du gör här. Går inte att stänga av.",
    storageKeys: [CONSENT_STORAGE_KEY],
  },
  {
    id: "functional",
    label: "Funktionella",
    locked: false,
    description:
      "Sparar din pågående chatt, dina ärenden och sessionsstatistik lokalt i webbläsaren, så du kan återuppta där du slutade om du stänger fliken eller kommer tillbaka senare.",
    storageKeys: ["fixa_draft_case", "fixa_orders", "fixa_stats"],
  },
];

function getStorage(storage) {
  if (storage) return storage;
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

// Läser och validerar sparat samtycke. Returnerar null om inget finns, det
// har gått ut (CONSENT_TTL_MS), eller versionen inte matchar (t.ex. om
// kategorierna ändras i en framtida release och vi vill fråga om igen).
export function loadConsent(storage) {
  const s = getStorage(storage);
  if (!s) return null;
  try {
    const raw = s.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== CONSENT_VERSION) return null;
    if (!parsed.expiresAt || Date.now() > parsed.expiresAt) return null;
    if (!parsed.categories || typeof parsed.categories !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

// Sparar samtycket och rensar bort tidigare sparad data för kategorier som
// INTE godkänts - annars vore kategorierna bara kosmetiska.
export function saveConsent(categories, storage, now = Date.now()) {
  const s = getStorage(storage);
  const record = {
    version: CONSENT_VERSION,
    givenAt: now,
    expiresAt: now + CONSENT_TTL_MS,
    categories: { necessary: true, functional: !!categories.functional },
  };
  if (s) {
    try {
      s.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record));
    } catch {
      /* t.ex. privat läge där localStorage kastar - inget mer att göra */
    }
    COOKIE_CATEGORIES.forEach((cat) => {
      if (cat.id === "necessary") return; // lagrar själva samtycket, rörs inte
      if (!record.categories[cat.id]) {
        cat.storageKeys.forEach((key) => {
          try {
            s.removeItem(key);
          } catch {
            /* no-op */
          }
        });
      }
    });
  }
  return record;
}

// Har vi (fortfarande giltigt) samtycke till en viss kategori? "necessary"
// är alltid true. Används av UI:t och av app/page.jsx för att avgöra om det
// får läsa/skriva sina localStorage-nycklar.
export function hasConsent(categoryId, storage) {
  if (categoryId === "necessary") return true;
  const consent = loadConsent(storage);
  return !!(consent && consent.categories && consent.categories[categoryId]);
}
