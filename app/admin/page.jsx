"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

const ADMIN_PASSWORD = "fixa2026";

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [cases, setCases] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (loggedIn) fetchCases();
  }, [loggedIn]);

  const fetchCases = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("cases")
      .select("*")
      .order("created_at", { ascending: false });
    setCases(data || []);
    setLoading(false);
  };

  if (!loggedIn) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F7F9FB" }}>
      <div style={{ background: "#FFF", borderRadius: 16, padding: 40, width: 360, boxShadow: "0 2px 16px rgba(0,0,0,0.08)" }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>🔧</div>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>FIXA Admin</div>
        <div style={{ fontSize: 14, color: "#7A8794", marginBottom: 24 }}>Logga in för att se ärenden</div>
        <input
          type="password"
          placeholder="Lösenord"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && password === ADMIN_PASSWORD && setLoggedIn(true)}
          style={{ width: "100%", padding: "12px 14px", border: "1px solid #E2E6EA", borderRadius: 8, fontSize: 16, marginBottom: 12, boxSizing: "border-box" }}
        />
        <button
          onClick={() => password === ADMIN_PASSWORD ? setLoggedIn(true) : alert("Fel lösenord")}
          style={{ width: "100%", background: "#2C5A82", color: "#FFF", border: "none", borderRadius: 8, padding: "12px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}
        >
          Logga in
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F7F9FB", padding: 24 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <span style={{ fontSize: 24 }}>🔧</span>
          <span style={{ fontSize: 22, fontWeight: 700 }}>FIXA Admin</span>
          <span style={{ marginLeft: "auto", fontSize: 13, color: "#7A8794" }}>{cases.length} ärenden totalt</span>
          <button onClick={fetchCases} style={{ background: "#2C5A82", color: "#FFF", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>Uppdatera</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* Ärendelista */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {loading && <div style={{ color: "#7A8794", padding: 20 }}>Laddar ärenden...</div>}
            {!loading && cases.length === 0 && <div style={{ color: "#7A8794", padding: 20 }}>Inga ärenden än.</div>}
            {cases.map(c => (
              <div key={c.id} onClick={() => setSelected(c)} style={{
                background: "#FFF", borderRadius: 12, padding: 16, cursor: "pointer",
                border: selected?.id === c.id ? "2px solid #2C5A82" : "1px solid #EAEEF2",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{c.kund_namn || "Okänd kund"}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20,
                    background: c.status === "tekniker" ? "#E4F3EB" : c.status === "lost" ? "#E6F1FB" : "#F7F9FB",
                    color: c.status === "tekniker" ? "#1E5A3D" : c.status === "lost" ? "#185FA5" : "#7A8794"
                  }}>
                    {c.status === "tekniker" ? "Tekniker" : c.status === "lost" ? "Löst" : "Pågår"}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: "#37485A" }}>{c.produkttyp || "—"} {c.marke ? `· ${c.marke}` : ""} {c.modell ? `· ${c.modell}` : ""}</div>
                <div style={{ fontSize: 12, color: "#7A8794", marginTop: 4 }}>{c.symptom || "Inget symptom angivet"}</div>
                <div style={{ fontSize: 11, color: "#9AA6B1", marginTop: 6 }}>{new Date(c.created_at).toLocaleString("sv-SE")}</div>
              </div>
            ))}
          </div>

          {/* Detaljvy */}
          {selected ? (
            <div style={{ background: "#FFF", borderRadius: 12, padding: 24, border: "1px solid #EAEEF2", height: "fit-content", position: "sticky", top: 24 }}>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 16 }}>{selected.kund_namn || "Okänd kund"}</div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#7A8794", textTransform: "uppercase", marginBottom: 8 }}>📞 Kontakt</div>
                {selected.kund_telefon && <div style={{ fontSize: 14, marginBottom: 4 }}>📱 <a href={`tel:${selected.kund_telefon}`} style={{ color: "#2C5A82" }}>{selected.kund_telefon}</a></div>}
                {selected.kund_epost && <div style={{ fontSize: 14, marginBottom: 4 }}>✉️ <a href={`mailto:${selected.kund_epost}`} style={{ color: "#2C5A82" }}>{selected.kund_epost}</a></div>}
                {selected.kund_gata && <div style={{ fontSize: 14, marginBottom: 4 }}>📍 {selected.kund_gata}, {selected.kund_postnr} {selected.kund_ort}</div>}
                {selected.rot_avdrag && <div style={{ fontSize: 13, color: "#1E5A3D", marginTop: 4 }}>ROT-avdrag: {selected.rot_avdrag}</div>}
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#7A8794", textTransform: "uppercase", marginBottom: 8 }}>🔧 Vitvaran</div>
                <div style={{ fontSize: 14 }}>{selected.produkttyp || "—"} · {selected.marke || "—"} · {selected.modell || "—"}</div>
                {selected.felkod && <div style={{ fontSize: 13, color: "#7A8794", marginTop: 4 }}>Felkod: {selected.felkod}</div>}
                {selected.symptom && <div style={{ fontSize: 13, marginTop: 4 }}>{selected.symptom}</div>}
              </div>

              {(selected.trolig_orsak || selected.reservdel) && (
                <div style={{ marginBottom: 16, background: "#E4F3EB", borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#1E5A3D", textTransform: "uppercase", marginBottom: 8 }}>🛠 FIXA:s bedömning</div>
                  {selected.specialist && <div style={{ fontSize: 13, marginBottom: 4 }}>Kompetens: <strong>{selected.specialist}</strong></div>}
                  {selected.trolig_orsak && <div style={{ fontSize: 13, marginBottom: 4 }}>Orsak: {selected.trolig_orsak}</div>}
                  {selected.reservdel && <div style={{ fontSize: 13, fontWeight: 700 }}>Ta med: {selected.reservdel}</div>}
                </div>
              )}

              {selected.rapport && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#7A8794", textTransform: "uppercase", marginBottom: 8 }}>📋 Sammanfattning</div>
                  <div style={{ fontSize: 13, color: "#37485A", lineHeight: 1.6 }}>{selected.rapport}</div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ background: "#FFF", borderRadius: 12, padding: 40, border: "1px solid #EAEEF2", display: "flex", alignItems: "center", justifyContent: "center", color: "#7A8794", fontSize: 14 }}>
              Klicka på ett ärende för att se detaljer
            </div>
          )}
        </div>
      </div>
    </div>
  );
}