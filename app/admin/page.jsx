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
    .map((c) => (c.created_at ? new Date(c.created_at) : null))
    .filter((d) => d && !isNaN(d));
  if (!dated.length) return { granularity: "week", data: [] };

  const now = new Date();
  const earliestMs = Math.min(...dated.map((d) => d.getTime()));
  const spanDays = (now - earliestMs) / 86400000;
  const granularity = spanDays > 70 ? "month" : "week";

  const buckets = new Map();
  let cursor = bucketStart(new Date(earliestMs), granularity);
  const end = bucketStart(now, granularity);
  let guard = 0;
  while (cursor <= end && guard < 260) {
    buckets.set(cursor.getTime(), { date: new Date(cursor), count: 0 });
    cursor = nextBucket(cursor, granularity);
    guard++;
  }
  dated.forEach((d) => {
    const key = bucketStart(d, granularity).getTime();
    if (buckets.has(key)) buckets.get(key).count += 1;
  });

  const data = Array.from(buckets.values()).map((b) => ({
    label: granularity === "week"
      ? b.date.toLocaleDateString("sv-SE", { day: "numeric", month: "short" })
      : b.date.toLocaleDateString("sv-SE", { month: "short", year: "numeric" }),
    count: b.count,
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

function StatsView({ cases }) {
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

  return (
    <div>
      <div style={{ background: "#FFF", borderRadius: 12, border: "1px solid #EAEEF2", padding: 32, marginBottom: 16, textAlign: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#7A8794", textTransform: "uppercase", letterSpacing: 0.3 }}>
          Löst helt på distans - utan besök av tekniker
        </div>
        <div style={{ fontSize: 72, fontWeight: 800, color: "#1E7A4D", lineHeight: 1.1, marginTop: 12 }}>
          {remotePct !== null ? `${remotePct}%` : "–"}
        </div>
        <div style={{ fontSize: 15, color: "#37485A", marginTop: 8 }}>
          {total
            ? `${lostRemoteCount} av ${total} ärenden löstes direkt tillsammans med kunden, helt utan att en tekniker behövde åka ut.`
            : "Inga ärenden registrerade ännu."}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div style={{ background: "#FFF", borderRadius: 12, border: "1px solid #EAEEF2", padding: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#7A8794", textTransform: "uppercase", marginBottom: 8 }}>
            🎯 Löst vid första besöket
          </div>
          <div style={{ fontSize: 14, color: "#37485A", lineHeight: 1.6 }}>
            Går inte att beräkna tillförlitligt ännu - vi loggar inte historik över statusändringar,
            så vi kan inte se om ett ärende gått tillbaka till ett tidigare steg (t.ex. bokad om på nytt).
          </div>
          <div style={{ marginTop: 12, background: "#F7F9FB", borderRadius: 8, padding: 12, fontSize: 13, color: "#37485A" }}>
            Förslag: lägg till en kryssruta ("Löst vid första besöket?") som teknikern bockar i när
            ärendet avslutas, så går måttet att räkna fram korrekt framöver.
          </div>
        </div>

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
      </div>

      <div style={{ background: "#FFF", borderRadius: 12, border: "1px solid #EAEEF2", padding: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#7A8794", textTransform: "uppercase", marginBottom: 8 }}>
          🗓 {timelineTitle}
        </div>
        {timeline.data.length === 0 ? (
          <EmptyStatCard text="Inga ärenden att visa volym för än." />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
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
              <Bar dataKey="count" fill="#2C5A82" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
