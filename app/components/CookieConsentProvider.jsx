"use client";
import { createContext, useContext, useState } from "react";
import { COOKIE_CATEGORIES, loadConsent, saveConsent } from "@/lib/cookieConsent.mjs";

// Delas av hela sajten (kund-chatten och admin) via app/layout.tsx. Håller
// reda på bannern/inställningspanelen och exponerar hasFunctionalConsent()
// + openSettings() så andra komponenter (t.ex. SiteFooter) kan bygga vidare
// utan att själva känna till hur samtycket lagras.
const CookieConsentContext = createContext(null);

export function useCookieConsent() {
  const ctx = useContext(CookieConsentContext);
  if (!ctx) throw new Error("useCookieConsent måste användas inom CookieConsentProvider");
  return ctx;
}

const S = {
  bannerWrap: {
    position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 1000,
    background: "#FFFFFF", borderTop: "1px solid #EAEEF2",
    boxShadow: "0 -2px 12px rgba(0,0,0,0.06)",
    padding: "18px 22px",
  },
  bannerInner: {
    maxWidth: 980, margin: "0 auto", display: "flex", alignItems: "center",
    gap: 20, flexWrap: "wrap", justifyContent: "space-between",
  },
  bannerText: { fontSize: 13.5, color: "#37485A", lineHeight: 1.55, maxWidth: 620 },
  buttonRow: { display: "flex", gap: 10, flexWrap: "wrap" },
  btnGhost: {
    padding: "9px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer",
    border: "1px solid transparent", background: "none", color: "#2C5A82",
  },
  btnOutline: {
    padding: "9px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer",
    border: "1px solid #E2E6EA", background: "#FFFFFF", color: "#37485A",
  },
  btnPrimary: {
    padding: "9px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer",
    border: "none", background: "#2C5A82", color: "#FFFFFF",
  },
  overlay: {
    position: "fixed", inset: 0, background: "rgba(17,24,39,0.45)", zIndex: 1100,
    display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
  },
  modal: {
    background: "#FFFFFF", borderRadius: 16, padding: 28, width: "100%", maxWidth: 460,
    boxShadow: "0 2px 16px rgba(0,0,0,0.08)", maxHeight: "85vh", overflowY: "auto",
  },
  modalHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  modalTitle: { fontSize: 18, fontWeight: 700, color: "#111827" },
  closeBtn: { background: "none", border: "none", fontSize: 18, color: "#7A8794", cursor: "pointer", lineHeight: 1, padding: 4 },
  modalIntro: { fontSize: 13, color: "#7A8794", marginBottom: 20, lineHeight: 1.5 },
  categoryRow: { padding: "14px 0", borderTop: "1px solid #EAEEF2" },
  categoryHead: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  categoryLabel: { fontSize: 14, fontWeight: 700, color: "#111827" },
  categoryDesc: { fontSize: 12.5, color: "#7A8794", marginTop: 4, lineHeight: 1.5 },
  categoryKeys: { fontSize: 11, color: "#9AA6B1", marginTop: 6 },
  modalFooter: { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 },
};

function Toggle({ checked, disabled, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      style={{
        width: 40, height: 22, borderRadius: 999, border: "none", flexShrink: 0,
        background: checked ? "#2C5A82" : "#D7DCE1",
        position: "relative", cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1, padding: 0,
      }}
    >
      <span
        style={{
          position: "absolute", top: 2, left: checked ? 20 : 2,
          width: 18, height: 18, borderRadius: "50%", background: "#FFFFFF",
          transition: "left 0.15s ease", boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
        }}
      />
    </button>
  );
}

export default function CookieConsentProvider({ children }) {
  // Lazy init (som mönstret för övrig localStorage-läsning i app/page.jsx) -
  // körs SSR-säkert tack vare loadConsent()s egna try/catch.
  const [consent, setConsent] = useState(() => loadConsent());
  const [bannerVisible, setBannerVisible] = useState(() => !loadConsent());
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Kryssrutornas läge INNE i panelen, innan man sparar - separat state så
  // man kan bocka i/ur fritt och ändå Avbryt utan att det redan slagit igenom.
  const [draftFunctional, setDraftFunctional] = useState(false);

  const commit = (categories) => {
    const record = saveConsent(categories);
    setConsent(record);
    setBannerVisible(false);
    setSettingsOpen(false);
  };

  const acceptAll = () => commit({ functional: true });
  const acceptNecessaryOnly = () => commit({ functional: false });
  // Speglar nuvarande samtycke in i panelens toggles varje gång den öppnas -
  // så en tidigare öppning som avbröts inte läcker in osparade val.
  const openSettings = () => {
    setDraftFunctional(!!consent?.categories?.functional);
    setSettingsOpen(true);
  };
  const closeSettings = () => setSettingsOpen(false);
  const saveCustom = () => commit({ functional: draftFunctional });

  const value = {
    hasFunctionalConsent: !!consent?.categories?.functional,
    openSettings,
  };

  return (
    <CookieConsentContext.Provider value={value}>
      {children}

      {bannerVisible && (
        <div style={S.bannerWrap} role="region" aria-label="Cookiemeddelande">
          <div style={S.bannerInner}>
            <div style={S.bannerText}>
              🔧 Vi använder cookies och liknande lokal lagring på fixa.se. Vissa är
              nödvändiga för att sidan ska fungera, andra är valfria och sparar t.ex.
              din pågående chatt mellan besök. Du väljer själv vad du godkänner.
            </div>
            <div style={S.buttonRow}>
              <button style={S.btnGhost} onClick={openSettings}>Anpassa</button>
              <button style={S.btnOutline} onClick={acceptNecessaryOnly}>Endast nödvändiga</button>
              <button style={S.btnPrimary} onClick={acceptAll}>Godkänn alla</button>
            </div>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div style={S.overlay} onClick={closeSettings}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Cookieinställningar">
            <div style={S.modalHeader}>
              <span style={S.modalTitle}>🔧 Cookieinställningar</span>
              <button style={S.closeBtn} onClick={closeSettings} aria-label="Stäng">✕</button>
            </div>
            <div style={S.modalIntro}>
              Här ser du exakt vad vi sparar lokalt i din webbläsare och kan välja vad du godkänner.
            </div>

            {COOKIE_CATEGORIES.map((cat) => (
              <div key={cat.id} style={S.categoryRow}>
                <div style={S.categoryHead}>
                  <span style={S.categoryLabel}>{cat.label}</span>
                  <Toggle
                    checked={cat.locked ? true : draftFunctional}
                    disabled={cat.locked}
                    onChange={cat.locked ? () => {} : setDraftFunctional}
                  />
                </div>
                <div style={S.categoryDesc}>{cat.description}</div>
                <div style={S.categoryKeys}>Sparas som: {cat.storageKeys.join(", ")}</div>
              </div>
            ))}

            <div style={S.modalFooter}>
              <button style={S.btnOutline} onClick={closeSettings}>Avbryt</button>
              <button style={S.btnPrimary} onClick={saveCustom}>Spara mina val</button>
            </div>
          </div>
        </div>
      )}
    </CookieConsentContext.Provider>
  );
}
