"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList,
} from "recharts";

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
  const [view, setView] = useState("cases");

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

  const updateSingleVisit = async (caseId, value) => {
    const prevCases = cases;
    const prevSelected = selected;
    setCases((cs) => cs.map((c) => (c.id === caseId ? { ...c, loest_forsta_besoket: value } : c)));
    setSelected((s) => (s && s.id === caseId ? { ...s, loest_forsta_besoket: value } : s));
    const { error } = await supabase.from("cases").update({ loest_forsta_besoket: value }).eq("id", caseId);
    if (error) {
      console.error("Kunde inte uppdatera löst vid första besöket:", error);
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
          {view === "cases" && (
            <span style={{ marginLeft: "auto", fontSize: 13, color: "#7A8794" }}>{filteredCases.length} av {cases.length} ärenden</span>
          )}
          <button onClick={fetchCases} style={{ marginLeft: view === "cases" ? 0 : "auto", background: "#2C5A82", color: "#FFF", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>Uppdatera</button>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[
            { key: "cases", label: "Ärenden" },
            { key: "stats", label: "Statistik" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setView(t.key)}
              style={{
                padding: "8px 18px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700,
                border: view === t.key ? "1px solid #2C5A82" : "1px solid #E2E6EA",
                background: view === t.key ? "#2C5A82" : "#FFF",
                color: view === t.key ? "#FFF" : "#37485A",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        {view === "cases" && (
        <>
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
                <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 13, color: "#37485A", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={!!selected.loest_forsta_besoket}
                    onChange={(e) => updateSingleVisit(selected.id, e.target.checked)}
                    style={{ width: 16, height: 16, cursor: "pointer" }}
                  />
                  Löst vid första besöket (inga återbesök krävdes)
                </label>
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
        </>
        )}
        {view === "stats" && <StatsView cases={cases} />}
      </div>
    </div>
  );
}

// Fasta ISO-vecko-/månadsgränser oberoende av lokal tidszonsdrift
function bucketStart(date, granularity) {
  if (granularity === "month") return new Date(date.getFullYear(), date.getMonth(), 1);
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayIdx = (d.getDay() + 6) % 7; // måndag = 0
  d.setDate(d.getDate() - dayIdx);
  return d;
}

function nextBucket(date, granularity) {
  return granularity === "month"
    ? new Date(date.getFullYear(), date.getMonth() + 1, 1)
    : new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7);
}

// Ärenden per vecka om historiken är kort, annars per månad - båda med nollfyllda
// luckor så tidslinjen ser hel ut även med få ärenden och skalar av sig själv.
function buildTimeline(cases) {
  const dated = cases
    .map((c) => (c.created_at ? { case: c, date: new Date(c.created_at) } : null))
    .filter((d) => d && !isNaN(d.date));
  if (!dated.length) return { granularity: "week", data: [] };

  const now = new Date();
  const earliestMs = Math.min(...dated.map((d) => d.date.getTime()));
  const spanDays = (now - earliestMs) / 86400000;
  const granularity = spanDays > 70 ? "month" : "week";

  const buckets = new Map();
  let cursor = bucketStart(new Date(earliestMs), granularity);
  const end = bucketStart(now, granularity);
  let guard = 0;
  while (cursor <= end && guard < 260) {
    buckets.set(cursor.getTime(), { date: new Date(cursor), count: 0, cases: [] });
    cursor = nextBucket(cursor, granularity);
    guard++;
  }
  dated.forEach(({ case: c, date: d }) => {
    const key = bucketStart(d, granularity).getTime();
    if (buckets.has(key)) {
      const b = buckets.get(key);
      b.count += 1;
      b.cases.push(c);
    }
  });

  // "key" identifierar bucketen entydigt (vecko-/månadsstart i ms) - används för
  // klick-/urvalslogik i veckodiagrammet, oberoende av den visade textetiketten.
  const data = Array.from(buckets.entries()).map(([key, b]) => ({
    key,
    label: granularity === "week"
      ? b.date.toLocaleDateString("sv-SE", { day: "numeric", month: "short" })
      : b.date.toLocaleDateString("sv-SE", { month: "short", year: "numeric" }),
    count: b.count,
    cases: b.cases,
  }));
  return { granularity, data };
}

// Validerad kategorisk palett (dataviz-skillet), fast ordning - återanvänds inte
// av statusfärgerna ovan så en produkttyp aldrig kan förväxlas med en status.
const CATEGORICAL_PALETTE = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];

function EmptyStatCard({ text }) {
  return (
    <div style={{ color: "#7A8794", fontSize: 14, padding: "20px 0", textAlign: "center" }}>{text}</div>
  );
}

// Generisk gruppering: räknar ärenden per nyckel (märke, modell, orsak, ...) och
// behåller de underliggande ärendena i varje grupp (g.cases). En framtida
// kostnadsdimension (t.ex. ÅTA-tid eller reservdelspris per ärende) kan då
// summeras direkt ovanpå samma gruppering - t.ex.
// g.cases.reduce((sum, c) => sum + (c.reservdelskostnad || 0), 0) - utan att
// grupperingslogiken i sig behöver ändras.
function groupCases(cases, keyFn) {
  const groups = new Map();
  cases.forEach((c) => {
    const key = keyFn(c);
    if (!key) return;
    if (!groups.has(key)) groups.set(key, { key, count: 0, cases: [] });
    const g = groups.get(key);
    g.count += 1;
    g.cases.push(c);
  });
  return Array.from(groups.values());
}

function RankedList({ rows, emptyText, onRowClick, total }) {
  if (rows.length === 0) return <EmptyStatCard text={emptyText} />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {rows.map((row, i) => (
        <div
          key={row.name}
          onClick={onRowClick ? () => onRowClick(row) : undefined}
          style={{
            display: "flex", alignItems: "flex-start", gap: 10,
            cursor: onRowClick ? "pointer" : "default",
            borderRadius: 8, padding: onRowClick ? "6px 8px" : 0, margin: onRowClick ? "-6px -8px" : 0,
            transition: "background 0.1s",
          }}
          onMouseEnter={onRowClick ? (e) => (e.currentTarget.style.background = "#F7F9FB") : undefined}
          onMouseLeave={onRowClick ? (e) => (e.currentTarget.style.background = "transparent") : undefined}
        >
          <div style={{ width: 18, fontSize: 12, fontWeight: 700, color: "#9AA6B1", textAlign: "right", flexShrink: 0, marginTop: 1 }}>
            {i + 1}
          </div>
          <div style={{ flex: 1, fontSize: 13, color: onRowClick ? "#2C5A82" : "#37485A", lineHeight: 1.5, fontWeight: onRowClick ? 600 : 400 }}>
            {row.name}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#2C5A82", background: "#E7EFF6", borderRadius: 10, padding: "2px 10px", flexShrink: 0, whiteSpace: "nowrap" }}>
            {total ? `${row.count} av ${total} ärenden` : `${row.count} ${row.count === 1 ? "ärende" : "ärenden"}`}
          </div>
        </div>
      ))}
    </div>
  );
}

// Modellens detaljvy i "Vanligaste modeller" - trolig_orsak/reservdel grupperas på
// exakt textmatchning (samma mönster som groupCases()/RankedList ovan). Det fungerar
// bra så fort samma formulering återkommer, men i skarp drift skriver FIXA:s AI
// dessa fält som fri text per samtal, så exakta dubbletter blir sällsynta tills
// volymen är riktigt hög. De faktiska symptombeskrivningarna listas därför alltid
// som citat rakt av - det ger ett konkret underlag oavsett hur väl orsak/reservdel
// råkar matcha ord för ord.
function ModelDetail({ group, onBack }) {
  if (!group) return null;
  const modelCases = group.cases;
  const total = modelCases.length;

  const orsakData = groupCases(modelCases, (c) => (c.trolig_orsak || "").trim() || null)
    .map((g) => ({ name: g.key, count: g.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const reservdelData = groupCases(modelCases, (c) => (c.reservdel || "").trim() || null)
    .map((g) => ({ name: g.key, count: g.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const symptoms = modelCases
    .filter((c) => (c.symptom || "").trim())
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, 5)
    .map((c) => c.symptom.trim());

  return (
    <div>
      <button
        onClick={onBack}
        style={{ background: "none", border: "none", color: "#2C5A82", fontSize: 13, fontWeight: 700, cursor: "pointer", padding: 0, marginBottom: 14 }}
      >
        ← Tillbaka till modeller
      </button>

      <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>{group.key}</div>
      <div style={{ fontSize: 13, color: "#7A8794", marginTop: 2, marginBottom: 18 }}>
        {total} {total === 1 ? "ärende" : "ärenden"} totalt
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#7A8794", textTransform: "uppercase", marginBottom: 8 }}>
          Vanligaste trolig orsak
        </div>
        <RankedList rows={orsakData} emptyText="Ingen bedömd orsak registrerad för denna modell än." total={total} />
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#7A8794", textTransform: "uppercase", marginBottom: 8 }}>
          Vanligaste reservdel
        </div>
        <RankedList rows={reservdelData} emptyText="Ingen reservdel registrerad för denna modell än." total={total} />
      </div>

      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#7A8794", textTransform: "uppercase", marginBottom: 8 }}>
          Kundernas egna beskrivningar
        </div>
        {symptoms.length === 0 ? (
          <EmptyStatCard text="Inga symptombeskrivningar registrerade för denna modell än." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {symptoms.map((s, i) => (
              <div key={i} style={{ fontSize: 13, color: "#37485A", lineHeight: 1.5, background: "#F7F9FB", borderRadius: 8, padding: "8px 12px" }}>
                "{s}"
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const STATS_TABS = [
  { key: "overview", label: "Översikt" },
  { key: "product-brand", label: "Produkt & märke" },
  { key: "models-causes", label: "Modeller & orsaker" },
];

function StatsView({ cases }) {
  const [statsTab, setStatsTab] = useState("overview");
  const [selectedModel, setSelectedModel] = useState(null);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const total = cases.length;
  const lostRemoteCount = cases.filter((c) => normalizeStatus(c.status) === "lost_remote").length;
  const remotePct = total ? Math.round((lostRemoteCount / total) * 100) : null;

  const produktCounts = new Map();
  cases.forEach((c) => {
    const key = c.produkttyp || "Okänd typ";
    produktCounts.set(key, (produktCounts.get(key) || 0) + 1);
  });
  const produktData = Array.from(produktCounts.entries())
    .map(([name, count]) => ({
      name,
      count,
      pct: total ? Math.round((count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .map((row, i) => ({ ...row, fill: CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length], labelText: `${row.count} (${row.pct}%)` }));

  const timeline = buildTimeline(cases);
  const timelineTitle = timeline.granularity === "week" ? "Ärenden per vecka" : "Ärenden per månad";
  const selectedWeekBucket = selectedWeek !== null ? timeline.data.find((d) => d.key === selectedWeek) : null;

  // "loest_forsta_besoket" bockas i av teknikern per ärende - null/undefined betyder
  // "inte ifyllt än", så de räknas inte in i måttet (varken som lyckat eller misslyckat).
  const singleVisitMarked = cases.filter((c) => c.loest_forsta_besoket === true || c.loest_forsta_besoket === false);
  const singleVisitTrue = singleVisitMarked.filter((c) => c.loest_forsta_besoket === true).length;
  const singleVisitPct = singleVisitMarked.length ? Math.round((singleVisitTrue / singleVisitMarked.length) * 100) : null;

  // Märkes- och modellfördelning - grupperad med groupCases() ovan så en framtida
  // kostnadskolumn (ÅTA-tid, reservdelspris) kan summeras per grupp utan omstrukturering.
  const MAX_BRAND_SLOTS = 8;
  const markeGroups = groupCases(cases, (c) => c.marke || "Okänt märke")
    .map((g) => ({ name: g.key, count: g.count }))
    .sort((a, b) => b.count - a.count);
  const markeRest = markeGroups.slice(MAX_BRAND_SLOTS - 1).reduce((sum, r) => sum + r.count, 0);
  const markeData = (markeGroups.length > MAX_BRAND_SLOTS
    ? [...markeGroups.slice(0, MAX_BRAND_SLOTS - 1), { name: "Övriga märken", count: markeRest }]
    : markeGroups
  ).map((row, i) => ({
    ...row,
    pct: total ? Math.round((row.count / total) * 100) : 0,
    fill: CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length],
  })).map((row) => ({ ...row, labelText: `${row.count} (${row.pct}%)` }));

  const modelGroups = groupCases(cases, (c) => (c.marke && c.modell ? `${c.marke} ${c.modell}` : null))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  const modelData = modelGroups.map((g) => ({ name: g.key, count: g.count }));
  const selectedModelGroup = selectedModel ? modelGroups.find((g) => g.key === selectedModel) : null;

  const orsakData = groupCases(cases, (c) => (c.trolig_orsak || "").trim() || null)
    .map((g) => ({ name: g.key, count: g.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {STATS_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setStatsTab(t.key)}
            style={{
              padding: "8px 18px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700,
              border: statsTab === t.key ? "1px solid #2C5A82" : "1px solid #E2E6EA",
              background: statsTab === t.key ? "#2C5A82" : "#FFF",
              color: statsTab === t.key ? "#FFF" : "#37485A",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {statsTab === "overview" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div style={{ background: "#FFF", borderRadius: 12, border: "1px solid #EAEEF2", padding: 28, textAlign: "center" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#7A8794", textTransform: "uppercase", letterSpacing: 0.3 }}>
                Löst helt på distans
              </div>
              <div style={{ fontSize: 56, fontWeight: 800, color: "#1E7A4D", lineHeight: 1.1, marginTop: 10 }}>
                {remotePct !== null ? `${remotePct}%` : "–"}
              </div>
              <div style={{ fontSize: 13, color: "#37485A", marginTop: 8 }}>
                {total
                  ? `${lostRemoteCount} av ${total} ärenden löstes direkt med kunden, utan att en tekniker behövde åka ut.`
                  : "Inga ärenden registrerade ännu."}
              </div>
            </div>

            <div style={{ background: "#FFF", borderRadius: 12, border: "1px solid #EAEEF2", padding: 28, textAlign: "center" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#7A8794", textTransform: "uppercase", letterSpacing: 0.3 }}>
                🎯 Löst vid första besöket
              </div>
              {singleVisitPct === null ? (
                <div style={{ fontSize: 14, color: "#37485A", lineHeight: 1.6, marginTop: 16 }}>
                  Ingen data ännu - teknikern bockar i "Löst vid första besöket" i ärendets detaljvy
                  när ett ärende avslutas, och måttet börjar fyllas i här automatiskt.
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 56, fontWeight: 800, color: "#2C5A82", lineHeight: 1.1, marginTop: 10 }}>
                    {singleVisitPct}%
                  </div>
                  <div style={{ fontSize: 13, color: "#37485A", marginTop: 8 }}>
                    {singleVisitTrue} av {singleVisitMarked.length} ärenden löstes utan återbesök.
                    Baseras på ärenden där detta är ifyllt av teknikern.
                  </div>
                </>
              )}
            </div>
          </div>

          <div style={{ background: "#FFF", borderRadius: 12, border: "1px solid #EAEEF2", padding: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#7A8794", textTransform: "uppercase", marginBottom: 4 }}>
              🗓 {timelineTitle}
            </div>
            {timeline.data.length > 0 && (
              <div style={{ fontSize: 12, color: "#9AA6B1", marginBottom: 12 }}>
                Klicka på en stapel för att se ärendena den {timeline.granularity === "week" ? "veckan" : "månaden"}.
              </div>
            )}
            {timeline.data.length === 0 ? (
              <EmptyStatCard text="Inga ärenden att visa volym för än." />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={timeline.data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid vertical={false} stroke="#EDEFF1" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "#7A8794" }}
                    axisLine={{ stroke: "#E2E6EA" }}
                    tickLine={false}
                    interval={timeline.data.length > 12 ? "preserveStartEnd" : 0}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#7A8794" }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip
                    cursor={{ fill: "#F7F9FB" }}
                    formatter={(v) => [`${v} ärenden`, ""]}
                    contentStyle={{ borderRadius: 8, border: "1px solid #EAEEF2", fontSize: 13 }}
                  />
                  <Bar
                    dataKey="count"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                    onClick={(row) => setSelectedWeek(row.key)}
                    activeBar={{ fill: "#1c3f5c" }}
                  >
                    {timeline.data.map((row) => (
                      <Cell
                        key={row.key}
                        fill={row.key === selectedWeek ? "#1c3f5c" : selectedWeek !== null ? "#C9D5DE" : "#2C5A82"}
                        style={{ cursor: "pointer", transition: "fill 0.2s ease" }}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}

            {selectedWeekBucket && (
              <div style={{ marginTop: 16, borderTop: "1px solid #EAEEF2", paddingTop: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>
                    Ärenden {timeline.granularity === "week" ? "vecka" : "månad"} {selectedWeekBucket.label}
                    {" "}({selectedWeekBucket.count})
                  </div>
                  <button
                    onClick={() => setSelectedWeek(null)}
                    style={{ background: "none", border: "none", color: "#2C5A82", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0 }}
                  >
                    ✕ Visa alla veckor
                  </button>
                </div>
                {selectedWeekBucket.cases.length === 0 ? (
                  <EmptyStatCard text="Inga ärenden registrerade den här perioden." />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {selectedWeekBucket.cases.map((c) => {
                      const statusMeta = STATUS_OPTIONS.find((o) => o.value === normalizeStatus(c.status));
                      return (
                        <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#F7F9FB", borderRadius: 8 }}>
                          <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#111827" }}>{c.kund_namn || "Okänd kund"}</div>
                          <div style={{ fontSize: 12, color: "#7A8794", width: 130, flexShrink: 0 }}>{c.produkttyp || "—"}</div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: statusMeta.color, background: statusMeta.bg, borderRadius: 10, padding: "2px 10px", flexShrink: 0, whiteSpace: "nowrap" }}>
                            {statusMeta.label}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {statsTab === "product-brand" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ background: "#FFF", borderRadius: 12, border: "1px solid #EAEEF2", padding: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#7A8794", textTransform: "uppercase", marginBottom: 8 }}>
              📦 Fördelning per produkttyp
            </div>
            {produktData.length === 0 ? (
              <EmptyStatCard text="Inga ärenden att visa fördelning för än." />
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(produktData.length * 40, 80)}>
                <BarChart data={produktData} layout="vertical" margin={{ top: 4, right: 56, left: 4, bottom: 4 }}>
                  <CartesianGrid horizontal={false} stroke="#EDEFF1" />
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    tick={{ fontSize: 12, fill: "#37485A" }}
                    axisLine={{ stroke: "#E2E6EA" }}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "#F7F9FB" }}
                    formatter={(_, __, props) => [`${props.payload.count} ärenden (${props.payload.pct}%)`, props.payload.name]}
                    contentStyle={{ borderRadius: 8, border: "1px solid #EAEEF2", fontSize: 13 }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
                    {produktData.map((row) => (
                      <Cell key={row.name} fill={row.fill} />
                    ))}
                    <LabelList dataKey="labelText" position="right" style={{ fill: "#37485A", fontSize: 12, fontWeight: 700 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div style={{ background: "#FFF", borderRadius: 12, border: "1px solid #EAEEF2", padding: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#7A8794", textTransform: "uppercase", marginBottom: 8 }}>
              🏷 Ärenden per märke
            </div>
            {markeData.length === 0 ? (
              <EmptyStatCard text="Inga ärenden att visa märkesfördelning för än." />
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(markeData.length * 40, 80)}>
                <BarChart data={markeData} layout="vertical" margin={{ top: 4, right: 56, left: 4, bottom: 4 }}>
                  <CartesianGrid horizontal={false} stroke="#EDEFF1" />
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    tick={{ fontSize: 12, fill: "#37485A" }}
                    axisLine={{ stroke: "#E2E6EA" }}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "#F7F9FB" }}
                    formatter={(_, __, props) => [`${props.payload.count} ärenden (${props.payload.pct}%)`, props.payload.name]}
                    contentStyle={{ borderRadius: 8, border: "1px solid #EAEEF2", fontSize: 13 }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
                    {markeData.map((row) => (
                      <Cell key={row.name} fill={row.fill} />
                    ))}
                    <LabelList dataKey="labelText" position="right" style={{ fill: "#37485A", fontSize: 12, fontWeight: 700 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {statsTab === "models-causes" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ background: "#FFF", borderRadius: 12, border: "1px solid #EAEEF2", padding: 24 }}>
            {selectedModel ? (
              <ModelDetail group={selectedModelGroup} onBack={() => setSelectedModel(null)} />
            ) : (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#7A8794", textTransform: "uppercase", marginBottom: 8 }}>
                  🔩 Vanligaste modeller
                </div>
                <RankedList rows={modelData} emptyText="Inga modelldata att visa än." onRowClick={(row) => setSelectedModel(row.name)} />
              </>
            )}
          </div>

          <div style={{ background: "#FFF", borderRadius: 12, border: "1px solid #EAEEF2", padding: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#7A8794", textTransform: "uppercase", marginBottom: 8 }}>
              🧠 Vanligaste trolig orsak
            </div>
            <RankedList rows={orsakData} emptyText="Inga bedömda orsaker att visa än." />
          </div>
        </div>
      )}
    </div>
  );
}
