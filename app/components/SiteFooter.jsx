"use client";
import { useCookieConsent } from "@/app/components/CookieConsentProvider";

// Minimal sidfot - sajten hade ingen tidigare. Finns bara för att uppfylla
// kravet på att kunna ändra sitt cookieval i efterhand; syns först vid
// nedskrollning under chatten/admin-vyn, stör inget befintligt UI.
export default function SiteFooter() {
  const { openSettings } = useCookieConsent();
  return (
    <footer style={{ padding: "14px 22px", textAlign: "center", fontSize: 12, color: "#9AA6B1" }}>
      <button
        onClick={openSettings}
        style={{ background: "none", border: "none", padding: 0, font: "inherit", color: "inherit", cursor: "pointer", textDecoration: "underline" }}
      >
        Cookieinställningar
      </button>
    </footer>
  );
}
