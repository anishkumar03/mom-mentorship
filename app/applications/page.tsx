"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const STATUSES = ["all", "new", "contacted", "qualified", "enrolled", "not_a_fit"];

const STATUS_STYLES = {
  new:        { bg: "#1a2f1a", border: "#4caf50", text: "#81c784", label: "New" },
  contacted:  { bg: "#1a2540", border: "#4c7fc9", text: "#82b1ff", label: "Contacted" },
  qualified:  { bg: "#2a1f10", border: "#c9a84c", text: "#f0d080", label: "Qualified" },
  enrolled:   { bg: "#1f1040", border: "#9c6dff", text: "#ce93d8", label: "Enrolled" },
  not_a_fit:  { bg: "#2a1212", border: "#c94c4c", text: "#ef9a9a", label: "Not a Fit" },
};

const EXPERIENCE_LABELS = {
  less_1: "< 1 year",
  "1_3":  "1–3 years",
  "3_5":  "3–5 years",
  "5_plus": "5+ years",
};

export default function ApplicationsPage() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => { fetchApps(); }, []);

  async function fetchApps() {
    setLoading(true);
    const { data } = await supabase
      .from("applications")
      .select("*")
      .order("created_at", { ascending: false });
    setApps(data || []);
    setLoading(false);
  }

  async function updateStatus(id, status) {
    await supabase.from("applications").update({ status }).eq("id", id);
    setApps(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    if (selected?.id === id) setSelected(prev => ({ ...prev, status }));
  }

  async function saveNotes() {
    setSaving(true);
    await supabase.from("applications").update({ notes }).eq("id", selected.id);
    setApps(prev => prev.map(a => a.id === selected.id ? { ...a, notes } : a));
    setSaving(false);
  }

  function openDetail(app) {
    setSelected(app);
    setNotes(app.notes || "");
  }

  const filtered = apps.filter(a => {
    const matchStatus = filter === "all" || a.status === filter;
    const matchSearch = !search ||
      a.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      a.email?.toLowerCase().includes(search.toLowerCase()) ||
      a.challenge?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = s === "all" ? apps.length : apps.filter(a => a.status === s).length;
    return acc;
  }, {});

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Applications</h1>
          <p style={s.subtitle}>Mentorship applications from your apply page</p>
        </div>
        <div style={s.statsRow}>
          <Stat label="Total" value={apps.length} />
          <Stat label="New" value={counts.new} gold />
          <Stat label="Qualified" value={counts.qualified} />
          <Stat label="Enrolled" value={counts.enrolled} />
        </div>
      </div>

      {/* Filter + Search */}
      <div style={s.toolbar}>
        <div style={s.filters}>
          {STATUSES.map(st => (
            <button
              key={st}
              onClick={() => setFilter(st)}
              style={{ ...s.filterBtn, ...(filter === st ? s.filterBtnActive : {}) }}
            >
              {st === "all" ? "All" : STATUS_STYLES[st]?.label}
              <span style={s.filterCount}>{counts[st]}</span>
            </button>
          ))}
        </div>
        <input
          style={s.search}
          placeholder="Search name, email, challenge..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div style={s.layout}>
        {/* List */}
        <div style={s.list}>
          {loading ? (
            <div style={s.empty}>Loading applications...</div>
          ) : filtered.length === 0 ? (
            <div style={s.empty}>No applications found.</div>
          ) : filtered.map(app => (
            <div
              key={app.id}
              onClick={() => openDetail(app)}
              style={{
                ...s.card,
                ...(selected?.id === app.id ? s.cardActive : {}),
              }}
            >
              <div style={s.cardTop}>
                <div style={s.avatar}>{app.full_name?.[0]?.toUpperCase() || "?"}</div>
                <div style={s.cardInfo}>
                  <span style={s.cardName}>{app.full_name}</span>
                  <span style={s.cardExp}>{EXPERIENCE_LABELS[app.experience] || app.experience}</span>
                </div>
                <StatusBadge status={app.status} />
              </div>
              <div style={s.cardChallenge}>{app.challenge}</div>
              <div style={s.cardMeta}>
                {app.email && <span style={s.metaItem}>✉ {app.email}</span>}
                {app.phone && <span style={s.metaItem}>📱 {app.phone}</span>}
                <span style={s.metaDate}>{formatDate(app.created_at)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Detail Panel */}
        {selected ? (
          <div style={s.detail}>
            <div style={s.detailHeader}>
              <div style={s.detailAvatar}>{selected.full_name?.[0]?.toUpperCase()}</div>
              <div>
                <h2 style={s.detailName}>{selected.full_name}</h2>
                <p style={s.detailSub}>{formatDate(selected.created_at)}</p>
              </div>
            </div>

            {/* Status changer */}
            <div style={s.section}>
              <label style={s.sectionLabel}>Status</label>
              <div style={s.statusGrid}>
                {Object.entries(STATUS_STYLES).map(([key, val]) => (
                  <button
                    key={key}
                    onClick={() => updateStatus(selected.id, key)}
                    style={{
                      ...s.statusBtn,
                      background: selected.status === key ? val.bg : "transparent",
                      border: `1px solid ${selected.status === key ? val.border : "rgba(201,168,76,0.15)"}`,
                      color: selected.status === key ? val.text : "rgba(232,224,206,0.4)",
                    }}
                  >
                    {val.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Info */}
            <div style={s.section}>
              <label style={s.sectionLabel}>Details</label>
              <div style={s.infoGrid}>
                <InfoRow label="Experience" value={EXPERIENCE_LABELS[selected.experience] || selected.experience} />
                <InfoRow label="Challenge" value={selected.challenge} />
                <InfoRow label="Email" value={selected.email || "—"} />
                <InfoRow label="Phone" value={selected.phone || "—"} />
                <InfoRow label="Source" value={selected.source || "apply_page"} />
              </div>
            </div>

            {/* Challenge detail */}
            {selected.challenge_detail && (
              <div style={s.section}>
                <label style={s.sectionLabel}>Their Story</label>
                <p style={s.storyText}>{selected.challenge_detail}</p>
              </div>
            )}

            {/* Notes */}
            <div style={s.section}>
              <label style={s.sectionLabel}>Your Notes</label>
              <textarea
                style={s.notesArea}
                rows={4}
                placeholder="Add private notes about this applicant..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
              <button onClick={saveNotes} disabled={saving} style={s.saveBtn}>
                {saving ? "Saving..." : "Save Notes"}
              </button>
            </div>

            {/* Quick Actions */}
            <div style={s.section}>
              <label style={s.sectionLabel}>Quick Actions</label>
              <div style={s.actions}>
                {selected.email && (
                  <a href={`mailto:${selected.email}`} style={s.actionBtn}>
                    ✉ Email
                  </a>
                )}
                {selected.phone && (
                  <a href={`tel:${selected.phone}`} style={s.actionBtn}>
                    📱 Call
                  </a>
                )}
                {selected.phone && (
                  <a
                    href={`https://wa.me/${selected.phone?.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    style={s.actionBtn}
                  >
                    💬 WhatsApp
                  </a>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div style={s.detailEmpty}>
            <p style={{ color: "rgba(232,224,206,0.3)", fontSize: 14 }}>
              Select an application to view details
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const st = STATUS_STYLES[status] || STATUS_STYLES.new;
  return (
    <span style={{
      padding: "3px 10px",
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 500,
      background: st.bg,
      border: `1px solid ${st.border}`,
      color: st.text,
      whiteSpace: "nowrap",
    }}>
      {st.label}
    </span>
  );
}

function Stat({ label, value, gold }) {
  return (
    <div style={s.stat}>
      <span style={{ ...s.statVal, color: gold ? "#C9A84C" : "#E8E0CE" }}>{value}</span>
      <span style={s.statLabel}>{label}</span>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={s.infoRow}>
      <span style={s.infoLabel}>{label}</span>
      <span style={s.infoVal}>{value}</span>
    </div>
  );
}

function formatDate(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString("en-CA", {
    month: "short", day: "numeric", year: "numeric",
  });
}

const NAVY = "#0A1628";
const NAVY_MID = "#0E1E38";
const GOLD = "#C9A84C";
const GOLD_BORDER = "rgba(201,168,76,0.2)";
const TEXT = "#E8E0CE";
const MUTED = "rgba(232,224,206,0.5)";

const s = {
  page: { padding: "2rem", minHeight: "100vh", background: NAVY, color: TEXT, fontFamily: "Inter, sans-serif" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem", flexWrap: "wrap", gap: 16 },
  title: { fontSize: 26, fontWeight: 700, color: TEXT, margin: 0 },
  subtitle: { fontSize: 13, color: MUTED, margin: "4px 0 0", fontWeight: 300 },
  statsRow: { display: "flex", gap: 20 },
  stat: { display: "flex", flexDirection: "column", alignItems: "center" },
  statVal: { fontSize: 22, fontWeight: 700 },
  statLabel: { fontSize: 11, color: MUTED, fontWeight: 300 },
  toolbar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", gap: 12, flexWrap: "wrap" },
  filters: { display: "flex", gap: 6, flexWrap: "wrap" },
  filterBtn: { padding: "6px 14px", borderRadius: 20, border: `1px solid ${GOLD_BORDER}`, background: "transparent", color: MUTED, fontSize: 12, fontWeight: 400, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "Inter, sans-serif" },
  filterBtnActive: { background: "rgba(201,168,76,0.1)", border: `1px solid ${GOLD}`, color: GOLD },
  filterCount: { background: "rgba(255,255,255,0.08)", borderRadius: 10, padding: "1px 7px", fontSize: 10 },
  search: { padding: "8px 14px", border: `1px solid ${GOLD_BORDER}`, borderRadius: 8, background: NAVY_MID, color: TEXT, fontSize: 13, fontFamily: "Inter, sans-serif", outline: "none", width: 240 },
  layout: { display: "grid", gridTemplateColumns: "1fr 380px", gap: 16, alignItems: "start" },
  list: { display: "flex", flexDirection: "column", gap: 10 },
  empty: { color: MUTED, fontSize: 14, padding: "2rem", textAlign: "center" },
  card: { background: NAVY_MID, border: `1px solid ${GOLD_BORDER}`, borderRadius: 12, padding: "1rem 1.25rem", cursor: "pointer", transition: "border-color 0.15s" },
  cardActive: { border: `1px solid ${GOLD}` },
  cardTop: { display: "flex", alignItems: "center", gap: 10, marginBottom: 8 },
  avatar: { width: 34, height: 34, borderRadius: "50%", background: "rgba(201,168,76,0.15)", border: `1px solid ${GOLD_BORDER}`, color: GOLD, fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  cardInfo: { flex: 1, display: "flex", flexDirection: "column", gap: 2 },
  cardName: { fontSize: 14, fontWeight: 600, color: TEXT },
  cardExp: { fontSize: 11, color: MUTED, fontWeight: 300 },
  cardChallenge: { fontSize: 12, color: MUTED, marginBottom: 8, fontWeight: 300 },
  cardMeta: { display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" },
  metaItem: { fontSize: 11, color: MUTED, fontWeight: 300 },
  metaDate: { fontSize: 11, color: "rgba(232,224,206,0.3)", marginLeft: "auto" },
  detail: { background: NAVY_MID, border: `1px solid ${GOLD_BORDER}`, borderRadius: 12, padding: "1.5rem", position: "sticky", top: 20 },
  detailEmpty: { background: NAVY_MID, border: `1px solid ${GOLD_BORDER}`, borderRadius: 12, padding: "3rem", display: "flex", alignItems: "center", justifyContent: "center" },
  detailHeader: { display: "flex", gap: 12, alignItems: "center", marginBottom: "1.5rem", paddingBottom: "1.25rem", borderBottom: `1px solid ${GOLD_BORDER}` },
  detailAvatar: { width: 44, height: 44, borderRadius: "50%", background: "rgba(201,168,76,0.15)", border: `1px solid ${GOLD}`, color: GOLD, fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" },
  detailName: { fontSize: 17, fontWeight: 700, color: TEXT, margin: 0 },
  detailSub: { fontSize: 11, color: MUTED, margin: "3px 0 0", fontWeight: 300 },
  section: { marginBottom: "1.25rem" },
  sectionLabel: { fontSize: 11, color: GOLD, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 8 },
  statusGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 },
  statusBtn: { padding: "7px 10px", borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif", transition: "all 0.15s" },
  infoGrid: { display: "flex", flexDirection: "column", gap: 6 },
  infoRow: { display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(201,168,76,0.08)" },
  infoLabel: { fontSize: 12, color: MUTED, fontWeight: 300 },
  infoVal: { fontSize: 12, color: TEXT, fontWeight: 400, textAlign: "right", maxWidth: "60%" },
  storyText: { fontSize: 13, color: MUTED, lineHeight: 1.6, fontWeight: 300, background: "rgba(255,255,255,0.02)", padding: "10px 12px", borderRadius: 8, border: `1px solid ${GOLD_BORDER}` },
  notesArea: { width: "100%", background: "rgba(255,255,255,0.03)", border: `1px solid ${GOLD_BORDER}`, borderRadius: 8, padding: "10px 12px", color: TEXT, fontSize: 13, fontFamily: "Inter, sans-serif", fontWeight: 300, resize: "vertical", outline: "none", boxSizing: "border-box" },
  saveBtn: { marginTop: 8, padding: "8px 18px", background: GOLD, color: NAVY, border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif" },
  actions: { display: "flex", gap: 8 },
  actionBtn: { padding: "8px 14px", border: `1px solid ${GOLD_BORDER}`, borderRadius: 8, color: TEXT, fontSize: 12, textDecoration: "none", fontWeight: 400, fontFamily: "Inter, sans-serif" },
};
