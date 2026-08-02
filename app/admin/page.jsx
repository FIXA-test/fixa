"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://lwnwoeftisepokhgcudq.supabase.co",
  "sb_publishable_bes2DlczBvaK3msGAQmDrw_PZoTHmqZ"
);

const ADMIN_PASSWORD = "fixa2026";

// Hur lång tid sedan ärendet skapades
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

// Räknar ner mot 24h-återkopplingsgränsen
function timeLeft(createdAt) {
  if (!createdAt) return { text: "—", urgency: "ok" };
  const deadline = createdAt + 24 * 60 * 60 * 1000;
  const diffMs = deadline - Date.now();
  if (diffMs <= 0) {
    const overHrs = Math.floor(-diffMs / 3600000);
    return { text: `Försenat med ${overHrs}h`, urgency: "over" };
  }
  const hrs = Math.floor(diffMs / 3600000);
  const mins = Math.floor((diffMs % 3600000) / 60000);
  const text = hrs > 0 ? `${hrs}h ${mins}min kvar` : `${mins}min kvar`;
  let urgency = "ok";
  if (hrs < 2) urgency = "critical";
  else if (hrs < 6) urgency = "warning";
  return { text, urgency };
}
const URGENCY_META = {
  ok: { color: "#1E7A4D", bg: "#E4F3EB" },
  warning: { color: "#8A5A10", bg: "#FBF1E3" },
  critical: { color: "#B54708", bg: "#FBF1E3" },
  over: { color: "#A3352B", bg: "#FDECEA" },
};

// Ärendets resa, från triage till avslutat besök
const STATUS_OPTIONS = [
  { value: "lost_remote", label: "Löst av kund (distans)", color: "#1E7A4D", bg: "#E4F3EB" },
  { value: "new", label: "Ny - ej kontaktad", color: "#B54708", bg: "#FBF1E3" },
  { value: "contacted", label: "Kontaktad", color: "#2C5A82", bg: "#E7EFF6" },
  { value: "part_ordered", label: "Reservdel beställd", color: "#8A5A10", bg: "#FBF1E3" },
  { value: "ready_to_book", label: "Redo att boka", color: "#5B3E8F", bg: "#EEE9F7" },
  { value: "booked", label: "Tekniker bokad", color: "#185FA5", bg: "#E6F1FB" },
  { value: "done", label: "Avslutat", color: "#37485A", bg: "#EDEFF1" },
];
// "tekniker"/"lost" är gamla värden från innan statuslistan fanns - mappas bara vid visning,
// sparas alltid som ett av STATUS_OPTIONS-värdena ovan så fort någon ändrar statusen.
function normalizeStatus(status) {
  if (status === "tekniker") return "new";
  if (status === "lost") return "lost_remote";
  return STATUS_OPTIONS.some((o) => o.value === status) ? status : "new";
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [cases, setCases] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [, setTick] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [produkttypFilter, setProdukttypFilter] = useState("all");

  useEffect(() => { if (loggedIn) fetchCases(); }, [loggedIn]);

  // Uppdaterar återkopplingstimern varje minut
  useEffect(() => {
    if (!loggedIn) return;
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, [loggedIn]);

  const fetchCases = async () => {
    setLoading(true);
    const { data } = await supabase.from("cases").select("*").order("created_at", { ascending: false });
    setCases(data || []);
    setLoading(false);
  };

  const updateStatus = async (caseId, newStatus) => {
    const prevCases = cases;
    const prevSelected = selected;
    setCases((cs) => cs.map((c) => (c.id === caseId ? { ...c, status: newStatus } : c)));
    setSelected((s) => (s && s.id === caseId ? { ...s, status: newStatus } : s));
    const { error } = await supabase.from("cases").update({ status: newStatus }).eq("id", caseId);
    if (error) {
      console.error("Kunde inte uppdatera status:", error);
      setCases(prevCases);
      setSelected(prevSelected);
    }
  };

  // Produkttyper som faktiskt förekommer i ärendena — ingen hårdkodad lista att hålla i synk
  const produkttyper = Array.from(new Set(cases.map((c) => c.produkttyp).filter(Boolean))).sort();

  const filteredCases = cases.filter((c) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || (c.kund_namn || "").toLowerCase().includes(q) || (c.id || "").toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || normalizeStatus(c.status) === statusFilter;
    const matchesProdukttyp = produkttypFilter === "all" || c.produkttyp === produkttypFilter;
    return matchesSearch && matchesStatus && matchesProdukttyp;
  });

  if (!loggedIn) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F7F9FB" }}>
      <div style={{ background: "#FFF", borderRadius: 16, padding: 40, width: 360, boxShadow: "0 2px 16px rgba(0,0,0,0.08)" }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>🔧</div>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>FIXA Admin</div>
        <div style={{ fontSize: 14, color: "#7A8794", marginBottom: 24 }}>Logga in för att se ärenden</div>
        <input type="password" placeholder="Lösenord" value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && password === ADMIN_PASSWORD && setLoggedIn(true)}
          style={{ width: "100%", padding: "12px 14px", border: "1px solid #E2E6EA", borderRadius: 8, fontSize: 16, marginBottom: 12, boxSizing: "border-box" }} />
        <button onClick={() => password === ADMIN_PASSWORD ? setLoggedIn(true) : alert("Fel lösenord")}
          style={{ width: "100%", background: "#2C5A82", color: "#FFF", border: "none", borderRadius: 8, padding: "12px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
          Logga in
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F7F9FB", padding: 24 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <span style={{ fontSize: 24, color: "#1F2937", filter: "brightness(0.55) contrast(1.2)" }}>🔧</span>
          <span style={{ fontSize: 22, fontWeight: 700, color: "#111827" }}>FIXA Admin</span>
          <span style={{ marginLeft: "auto", fontSize: 13, color: "#7A8794" }}>{filteredCases.length} av {cases.length} ärenden</span>
          <button onClick={fetchCases} style={{ background: "#2C5A82", color: "#FFF", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>Uppdatera</button>
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Sök på kundnamn eller ärendenummer..."
            style={{ flex: "2 1 240px", padding: "10px 12px", border: "1px solid #E2E6EA", borderRadius: 8, fontSize: 14, boxSizing: "border-box", color: "#111827", background: "#FFF" }}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ flex: "1 1 180px", padding: "10px 12px", border: "1px solid #E2E6EA", borderRadius: 8, fontSize: 14, background: "#FFF", color: "#111827", cursor: "pointer" }}
          >
            <option value="all">Alla statusar</option>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            value={produkttypFilter}
            onChange={(e) => setProdukttypFilter(e.target.value)}
            style={{ flex: "1 1 180px", padding: "10px 12px", border: "1px solid #E2E6EA", borderRadius: 8, fontSize: 14, background: "#FFF", color: "#111827", cursor: "pointer" }}
          >
            <option value="all">Alla produkttyper</option>
            {produkttyper.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {loading && <div style={{ color: "#7A8794", padding: 20 }}>Laddar ärenden...</div>}
            {!loading && cases.length === 0 && <div style={{ color: "#7A8794", padding: 20 }}>Inga ärenden än.</div>}
            {!loading && cases.length > 0 && filteredCases.length === 0 && <div style={{ color: "#7A8794", padding: 20 }}>Inga ärenden matchar sökningen/filtren.</div>}
            {filteredCases.map(c => {
              const createdMs = c.created_at ? new Date(c.created_at).getTime() : null;
              const tl = timeLeft(createdMs);
              const um = URGENCY_META[tl.urgency];
              const statusValue = normalizeStatus(c.status);
              const statusMeta = STATUS_OPTIONS.find((o) => o.value === statusValue);
              return (
              <div key={c.id} onClick={() => setSelected(c)} style={{
                background: "#FFF", borderRadius: 12, padding: 16, cursor: "pointer",
                border: selected?.id === c.id ? "2px solid #2C5A82" : "1px solid #EAEEF2",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>{c.kund_namn || "Okänd kund"}</span>
                  <select
                    value={statusValue}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => updateStatus(c.id, e.target.value)}
                    style={{
                      fontSize: 11, fontWeight: 700, padding: "3px 6px", borderRadius: 20, border: "none",
                      background: statusMeta.bg, color: statusMeta.color, cursor: "pointer",
                    }}
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div style={{ fontSize: 13, color: "#37485A" }}>{c.produkttyp || "—"} {c.marke ? `· ${c.marke}` : ""} {c.modell ? `· ${c.modell}` : ""}</div>
                <div style={{ fontSize: 12, color: "#7A8794", marginTop: 4 }}>{c.symptom || "Inget symptom"}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, marginTop: 6 }}>
                  <span style={{ fontSize: 11, color: "#9AA6B1" }}>{new Date(c.created_at).toLocaleString("sv-SE")}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: um.color, background: um.bg, borderRadius: 10, padding: "2px 8px" }}>
                    🕐 {tl.text}
                  </span>
                </div>
              </div>
              );
            })}
          </div>
          {selected ? (
            <div style={{ background: "#FFF", borderRadius: 12, padding: 24, border: "1px solid #EAEEF2", height: "fit-content", position: "sticky", top: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 700, fontSize: 18, color: "#111827" }}>{selected.kund_namn || "Okänd kund"}</div>
                {(() => {
                  const createdMs = selected.created_at ? new Date(selected.created_at).getTime() : null;
                  const tl = timeLeft(createdMs);
                  const um = URGENCY_META[tl.urgency];
                  return (
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 12, color: "#7A8794" }}>Inskickat {timeSince(createdMs)}</div>
                      <div style={{ marginTop: 4, fontSize: 13, fontWeight: 700, color: um.color, background: um.bg, borderRadius: 8, padding: "4px 10px", display: "inline-block" }}>
                        🕐 {tl.text} till 24h-återkoppling
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#7A8794", textTransform: "uppercase", marginBottom: 8 }}>Status</div>
                <select
                  value={normalizeStatus(selected.status)}
                  onChange={(e) => updateStatus(selected.id, e.target.value)}
                  style={{
                    fontSize: 14, fontWeight: 700, padding: "8px 12px", borderRadius: 8, border: "1px solid #E2E6EA", cursor: "pointer",
                    background: STATUS_OPTIONS.find((o) => o.value === normalizeStatus(selected.status)).bg,
                    color: STATUS_OPTIONS.find((o) => o.value === normalizeStatus(selected.status)).color,
                  }}
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#7A8794", textTransform: "uppercase", marginBottom: 8 }}>📞 Kontakt</div>
                {selected.kund_telefon && <div style={{ fontSize: 14, marginBottom: 4 }}>📱 <a href={`tel:${selected.kund_telefon}`} style={{ color: "#2C5A82" }}>{selected.kund_telefon}</a></div>}
                {selected.kund_epost && <div style={{ fontSize: 14, marginBottom: 4 }}>✉️ <a href={`mailto:${selected.kund_epost}`} style={{ color: "#2C5A82" }}>{selected.kund_epost}</a></div>}
                {selected.kund_gata && <div style={{ fontSize: 14, marginBottom: 4 }}>📍 {selected.kund_gata}, {selected.kund_postnr} {selected.kund_ort}</div>}
                {selected.rot_avdrag && <div style={{ fontSize: 13, color: "#1E5A3D", marginTop: 4 }}>ROT: {selected.rot_avdrag}</div>}
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#7A8794", textTransform: "uppercase", marginBottom: 8 }}>🔧 Vitvaran</div>
                <div style={{ fontSize: 14, color: "#37485A" }}>{selected.produkttyp || "—"} · {selected.marke || "—"} · {selected.modell || "—"}</div>
                {selected.felkod && <div style={{ fontSize: 13, color: "#7A8794", marginTop: 4 }}>Felkod: {selected.felkod}</div>}
                {selected.symptom && <div style={{ fontSize: 13, marginTop: 4, color: "#37485A" }}>{selected.symptom}</div>}
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
