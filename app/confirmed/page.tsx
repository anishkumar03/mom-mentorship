"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { PAYMENT_METHODS } from "../../lib/constants";
import { usePrograms } from "../../lib/usePrograms";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Lead = {
  id: string;
  full_name: string | null;
  name: string | null;
  source: string | null;
  handle: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  program: string | null;
  status: string | null;
  batch: string | null;
  total_fee: number | null;
  archived?: boolean | null;
  created_at?: string | null;
  student_id?: string | null;
  converted_at?: string | null;
};

type LeadPayment = {
  id: string;
  lead_id: string;
  amount: number;
  paid_at: string | null;
  method: string | null;
  note: string | null;
  created_at: string | null;
};

function safeName(l: Lead) {
  return (l.full_name ?? l.name ?? "").trim() || "(no name)";
}

function money(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function downloadCSV(filename: string, rows: string[][]) {
  const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function timeAgo(dateStr: string) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function toLocalInputValue(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ConfirmedPage() {
  const { programs } = usePrograms();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [program, setProgram] = useState<string>("__ALL__");
  const [searchQuery, setSearchQuery] = useState("");

  // Payments state
  const [payments, setPayments] = useState<LeadPayment[]>([]);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentLead, setPaymentLead] = useState<Lead | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentNote, setPaymentNote] = useState("");

  // Fee editing state
  const [editingFeeId, setEditingFeeId] = useState<string | null>(null);
  const [editingFeeValue, setEditingFeeValue] = useState("");

  // Convert to student state
  const [convertError, setConvertError] = useState<string | null>(null);
  const [convertSuccess, setConvertSuccess] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .or("archived.is.null,archived.eq.false")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setLeads([]);
    } else {
      setLeads(Array.isArray(data) ? (data as Lead[]) : []);
    }
    setLoading(false);
  };

  const fetchPayments = async () => {
    const { data, error } = await supabase
      .from("lead_payments")
      .select("*")
      .order("paid_at", { ascending: false });

    if (error) {
      console.error(error);
      setPayments([]);
    } else {
      setPayments(Array.isArray(data) ? (data as LeadPayment[]) : []);
    }
  };

  useEffect(() => {
    fetchAll();
    fetchPayments();
  }, []);

  const confirmed = useMemo(() => {
    return leads
      .filter((l) => {
        const v = (l.status ?? "").toString().trim().toLowerCase().replace(/\s+/g, "");
        return v === "confirmed";
      })
      .filter((l) => program === "__ALL__" || (l.program ?? "") === program)
      .filter((l) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const searchable = [l.full_name, l.name, l.email, l.handle, l.phone, l.notes, l.source]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return searchable.includes(q);
      });
  }, [leads, program, searchQuery]);

  const paymentsByLead = useMemo(() => {
    const map = new Map<string, LeadPayment[]>();
    for (const p of payments) {
      const arr = map.get(p.lead_id) ?? [];
      arr.push(p);
      map.set(p.lead_id, arr);
    }
    return map;
  }, [payments]);

  const totalsByLead = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of payments) {
      map.set(p.lead_id, (map.get(p.lead_id) ?? 0) + p.amount);
    }
    return map;
  }, [payments]);

  const programCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of confirmed) {
      const p = l.program || "Unassigned";
      counts[p] = (counts[p] ?? 0) + 1;
    }
    return counts;
  }, [confirmed]);

  // Payment stats
  const paymentStats = useMemo(() => {
    let totalFees = 0;
    let totalCollected = 0;
    let paidCount = 0;
    let partialCount = 0;
    for (const l of confirmed) {
      const fee = l.total_fee ?? 0;
      const paid = totalsByLead.get(l.id) ?? 0;
      totalFees += fee;
      totalCollected += paid;
      if (fee > 0 && paid >= fee) paidCount++;
      else if (paid > 0) partialCount++;
    }
    return { totalFees, totalCollected, remaining: totalFees - totalCollected, paidCount, partialCount };
  }, [confirmed, totalsByLead]);

  const exportConfirmed = () => {
    const header = ["Name", "Program", "Email", "Phone", "Instagram", "Source", "Total Fee", "Paid", "Remaining", "Notes", "Created At"];
    const body = confirmed.map((l) => {
      const fee = l.total_fee ?? 0;
      const paid = totalsByLead.get(l.id) ?? 0;
      return [
        safeName(l),
        l.program ?? "",
        l.email ?? "",
        l.phone ?? "",
        l.handle ? `@${l.handle}` : "",
        l.source ?? "",
        fee.toFixed(2),
        paid.toFixed(2),
        Math.max(0, fee - paid).toFixed(2),
        l.notes ?? "",
        l.created_at ? new Date(l.created_at).toLocaleString() : "",
      ];
    });
    downloadCSV(`MOM_Confirmed_${program === "__ALL__" ? "ALL" : program}.csv`, [header, ...body]);
  };

  const saveFee = async (leadId: string) => {
    const fee = Number(editingFeeValue);
    if (!Number.isFinite(fee) || fee < 0) {
      alert("Enter a valid fee amount");
      return;
    }
    const { error } = await supabase.from("leads").update({ total_fee: fee }).eq("id", leadId);
    if (error) {
      alert(error.message);
      return;
    }
    setEditingFeeId(null);
    setEditingFeeValue("");
    fetchAll();
  };

  const openPayments = (l: Lead) => {
    setPaymentLead(l);
    setPaymentAmount("");
    setPaymentDate(toLocalInputValue(new Date().toISOString()));
    setPaymentMethod("");
    setPaymentNote("");
    setPaymentOpen(true);
  };

  const savePayment = async () => {
    if (!paymentLead) return;
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Enter a valid payment amount");
      return;
    }

    const dateVal = paymentDate ? new Date(paymentDate).toISOString() : new Date().toISOString();
    const { error } = await supabase.from("lead_payments").insert({
      lead_id: paymentLead.id,
      amount,
      paid_at: dateVal,
      method: paymentMethod.trim() || null,
      note: paymentNote.trim() || null,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setPaymentAmount("");
    setPaymentMethod("");
    setPaymentNote("");
    fetchPayments();
  };

  const convertToStudent = async (l: Lead) => {
    if (l.student_id) return;
    setConvertError(null);
    setConvertSuccess(null);
    const email = (l.email ?? "").trim().toLowerCase();
    if (email) {
      const existing = await supabase
        .from("students")
        .select("id,email")
        .ilike("email", email)
        .limit(1);
      if (existing.error) {
        setConvertError(existing.error.message);
        return;
      }
      if (existing.data && existing.data.length > 0) {
        const { error } = await supabase
          .from("leads")
          .update({ student_id: existing.data[0].id, status: "Confirmed", converted_at: new Date().toISOString() })
          .eq("id", l.id);
        if (error) {
          setConvertError(error.message);
          return;
        }
        setConvertSuccess(`${safeName(l)} linked to existing student.`);
        fetchAll();
        return;
      }
    }

    const sName =
      (l.full_name ?? "").trim() ||
      (l.name ?? "").trim() ||
      email ||
      "Unnamed";
    const sFullName = (l.full_name ?? l.name ?? "").trim() || null;

    const payload = {
      name: sName,
      full_name: sFullName,
      email: email || "",
      phone: l.phone ?? null,
      program: l.program ?? null,
      notes: l.notes ?? null,
      total_fee: 0,
      paid_in_full: false,
    };

    const inserted = await supabase.from("students").insert(payload).select("id").single();

    if (inserted.error) {
      setConvertError(inserted.error.message);
      return;
    }

    const { error } = await supabase
      .from("leads")
      .update({ student_id: inserted.data.id, status: "Confirmed", converted_at: new Date().toISOString() })
      .eq("id", l.id);

    if (error) {
      setConvertError(error.message);
      return;
    }

    setConvertSuccess(`${safeName(l)} converted to student.`);
    fetchAll();
  };

  const deletePayment = async (p: LeadPayment) => {
    const ok = confirm("Delete this payment?");
    if (!ok) return;
    const { error } = await supabase.from("lead_payments").delete().eq("id", p.id);
    if (error) alert(error.message);
    else fetchPayments();
  };

  return (
    <div style={page}>
      {/* Convert banners */}
      {convertError && (
        <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(255,59,48,0.15)", border: "1px solid rgba(255,59,48,0.3)", color: "#fca5a5", fontSize: 13, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Error: {convertError}</span>
          <button onClick={() => setConvertError(null)} style={{ background: "none", border: "none", color: "#fca5a5", cursor: "pointer", fontSize: 16 }}>×</button>
        </div>
      )}
      {convertSuccess && (
        <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", color: "#86efac", fontSize: 13, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{convertSuccess}</span>
          <button onClick={() => setConvertSuccess(null)} style={{ background: "none", border: "none", color: "#86efac", cursor: "pointer", fontSize: 16 }}>×</button>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Confirmed Leads</h2>
          <div style={{ opacity: 0.6, fontSize: 13, marginTop: 4 }}>
            Leads with confirmed status, ready for onboarding
          </div>
        </div>
        <button onClick={exportConfirmed} style={btnPrimary}>
          Export CSV
        </button>
      </div>

      {/* Stats Row */}
      <div style={{ ...grid3, marginTop: 16 }}>
        <div style={statCard}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#86efac" }}>{confirmed.length}</div>
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>Total Confirmed</div>
        </div>
        <div style={statCard}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#86efac" }}>{money(paymentStats.totalCollected)}</div>
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>Total Collected</div>
        </div>
        <div style={statCard}>
          <div style={{ fontSize: 28, fontWeight: 800, color: paymentStats.remaining > 0 ? "#fbbf24" : "#86efac" }}>{money(paymentStats.remaining)}</div>
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>Remaining</div>
        </div>
        {Object.entries(programCounts).map(([prog, count]) => (
          <div key={prog} style={statCard}>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{count}</div>
            <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>{prog}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ ...panel, marginTop: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search confirmed leads..."
            style={{ ...inputSmall, minWidth: 180, flex: "1 1 180px" }}
          />
          <select value={program} onChange={(e) => setProgram(e.target.value)} style={inputSmall}>
            <option value="__ALL__">All Programs</option>
            {programs.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <div style={{ marginLeft: "auto", opacity: 0.7, fontSize: 13 }}>
            {loading ? "Loading..." : `${confirmed.length} confirmed`}
          </div>
        </div>
      </div>

      {/* Cards */}
      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        {loading && confirmed.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, opacity: 0.5 }}>Loading...</div>
        )}
        {!loading && confirmed.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, opacity: 0.5 }}>
            No confirmed leads found. {leads.length > 0 ? "Try adjusting your filters." : ""}
          </div>
        )}
        {confirmed.map((l) => {
          const fee = l.total_fee ?? 0;
          const paid = totalsByLead.get(l.id) ?? 0;
          const remaining = Math.max(0, fee - paid);
          const isFullyPaid = fee > 0 && paid >= fee;
          const isPartial = paid > 0 && !isFullyPaid;

          return (
            <div key={l.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{safeName(l)}</span>
                    <span style={confirmedBadge}>Confirmed</span>
                    {isFullyPaid && <span style={paidBadge}>Paid in Full</span>}
                    {isPartial && <span style={partialBadge}>Partial</span>}
                    {l.batch && <span style={batchBadgeStyle}>{l.batch}</span>}
                    {l.source && <span style={channelBadge}>{l.source}</span>}
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8, fontSize: 13, opacity: 0.8 }}>
                    {l.program && <span>{l.program}</span>}
                    {l.handle && <span>@{l.handle}</span>}
                    {l.email && <span>{l.email}</span>}
                    {l.phone && <span>{l.phone}</span>}
                  </div>

                  {/* Payment Info Row */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 10, alignItems: "center" }}>
                    {/* Total Fee - click to edit */}
                    <div style={{ fontSize: 13 }}>
                      <span style={{ opacity: 0.6 }}>Fee: </span>
                      {editingFeeId === l.id ? (
                        <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                          <input
                            type="number"
                            step="0.01"
                            value={editingFeeValue}
                            onChange={(e) => setEditingFeeValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") saveFee(l.id); if (e.key === "Escape") setEditingFeeId(null); }}
                            autoFocus
                            style={{ ...inputSmall, width: 100, padding: "4px 8px" }}
                          />
                          <button onClick={() => saveFee(l.id)} style={{ ...btnSmall, padding: "3px 8px", fontSize: 11 }}>Save</button>
                          <button onClick={() => setEditingFeeId(null)} style={{ ...btnSecondary, padding: "3px 8px", fontSize: 11 }}>Cancel</button>
                        </span>
                      ) : (
                        <span
                          onClick={() => { setEditingFeeId(l.id); setEditingFeeValue(String(fee || "")); }}
                          style={{ cursor: "pointer", fontWeight: 600, borderBottom: "1px dashed rgba(255,255,255,0.3)" }}
                          title="Click to set/edit fee"
                        >
                          {fee > 0 ? money(fee) : "Set fee"}
                        </span>
                      )}
                    </div>

                    {fee > 0 && (
                      <>
                        <div style={{ fontSize: 13 }}>
                          <span style={{ opacity: 0.6 }}>Paid: </span>
                          <span style={{ fontWeight: 600, color: "#86efac" }}>{money(paid)}</span>
                        </div>
                        <div style={{ fontSize: 13 }}>
                          <span style={{ opacity: 0.6 }}>Remaining: </span>
                          <span style={{ fontWeight: 600, color: remaining > 0 ? "#fbbf24" : "#86efac" }}>{money(remaining)}</span>
                        </div>

                        {/* Progress bar */}
                        <div style={{ flex: "1 1 120px", minWidth: 80, display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={progressBarBg}>
                            <div style={{ ...progressBarFill, width: `${Math.min(100, (paid / fee) * 100)}%` }} />
                          </div>
                          <span style={{ fontSize: 11, opacity: 0.6 }}>{Math.round(Math.min(100, (paid / fee) * 100))}%</span>
                        </div>
                      </>
                    )}

                    <button onClick={() => openPayments(l)} style={btnSmall}>
                      Record Payment
                    </button>
                    <button
                      onClick={() => convertToStudent(l)}
                      disabled={!!l.student_id}
                      style={{
                        ...btnSmall,
                        background: l.student_id ? "rgba(34,197,94,0.08)" : "rgba(34,197,94,0.15)",
                        border: "1px solid rgba(34,197,94,0.3)",
                        color: l.student_id ? "rgba(134,239,172,0.5)" : "#86efac",
                        cursor: l.student_id ? "default" : "pointer",
                      }}
                    >
                      {l.student_id ? "Converted" : "Convert to Student"}
                    </button>
                  </div>

                  {l.notes && (
                    <div style={noteBlock}>
                      {l.notes.length > 120 ? `${l.notes.slice(0, 120).trimEnd()}…` : l.notes}
                    </div>
                  )}

                  {l.created_at && (
                    <div style={{ fontSize: 12, opacity: 0.5, marginTop: 8 }}>
                      Added {timeAgo(l.created_at)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Payment Modal */}
      {paymentOpen && paymentLead && (() => {
        const fee = paymentLead.total_fee ?? 0;
        const paid = totalsByLead.get(paymentLead.id) ?? 0;
        const remaining = Math.max(0, fee - paid);
        const leadPayments = paymentsByLead.get(paymentLead.id) ?? [];

        return (
          <div style={modalOverlay} onClick={() => setPaymentOpen(false)}>
            <div style={modalCard} onClick={(e) => e.stopPropagation()}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Payments</div>
              <div style={{ opacity: 0.85, marginTop: 4, fontSize: 14 }}>
                {safeName(paymentLead)}
              </div>
              <div style={{ opacity: 0.6, fontSize: 12, marginTop: 2 }}>
                Fee: {fee > 0 ? money(fee) : "Not set"} | Paid: {money(paid)}
                {fee > 0 && <> | Remaining: <span style={{ color: remaining > 0 ? "#fbbf24" : "#86efac" }}>{money(remaining)}</span></>}
              </div>

              <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
                <div>
                  <label style={label}>Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    style={input}
                  />
                </div>
                <div>
                  <label style={label}>Date</label>
                  <input
                    type="datetime-local"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    style={input}
                  />
                </div>
                <div>
                  <label style={label}>Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    style={input}
                  >
                    <option value="">Select method...</option>
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={label}>Note</label>
                  <input
                    placeholder="Payment note (optional)"
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                    style={input}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 14, justifyContent: "flex-end" }}>
                <button onClick={() => setPaymentOpen(false)} style={btnSecondary}>Close</button>
                <button onClick={savePayment} style={btnPrimary}>Add Payment</button>
              </div>

              {/* Previous payments */}
              <div style={{ marginTop: 18, fontWeight: 700, fontSize: 13 }}>Previous payments</div>
              <div style={{ display: "grid", gap: 8, marginTop: 8, maxHeight: 240, overflow: "auto" }}>
                {leadPayments.map((p) => (
                  <div key={p.id} style={{ ...cardInner, padding: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{money(p.amount)}</div>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>
                          {p.paid_at ? new Date(p.paid_at).toLocaleString() : "-"}
                          {p.method && (
                            <span style={{
                              marginLeft: 8, padding: "2px 6px", borderRadius: 4,
                              background: "rgba(255,255,255,0.08)", fontSize: 11,
                            }}>
                              {p.method}
                            </span>
                          )}
                        </div>
                        {p.note && <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>{p.note}</div>}
                      </div>
                      <button onClick={() => deletePayment(p)} style={btnDangerSmall}>Delete</button>
                    </div>
                  </div>
                ))}
                {leadPayments.length === 0 && (
                  <div style={{ opacity: 0.5, fontSize: 13 }}>No payments yet.</div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

const page: React.CSSProperties = {
  maxWidth: 1100,
  margin: "20px auto",
  padding: 16,
  color: "white",
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  background: "linear-gradient(180deg, #071427 0%, #061122 100%)",
  minHeight: "100vh",
};

const panel: React.CSSProperties = {
  padding: 16,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
};

const card: React.CSSProperties = {
  border: "1px solid rgba(34,197,94,0.15)",
  borderRadius: 14,
  padding: 16,
  background: "rgba(34,197,94,0.03)",
  transition: "border-color 0.2s",
};

const cardInner: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 10,
  padding: 10,
  background: "rgba(255,255,255,0.03)",
};

const statCard: React.CSSProperties = {
  padding: 16,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
  textAlign: "center",
};

const grid3: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 12,
};

const confirmedBadge: React.CSSProperties = {
  display: "inline-block",
  padding: "3px 10px",
  borderRadius: 999,
  background: "rgba(34,197,94,0.15)",
  color: "#86efac",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.02em",
};

const paidBadge: React.CSSProperties = {
  display: "inline-block",
  padding: "3px 10px",
  borderRadius: 999,
  background: "rgba(34,197,94,0.25)",
  color: "#4ade80",
  fontSize: 11,
  fontWeight: 700,
};

const partialBadge: React.CSSProperties = {
  display: "inline-block",
  padding: "3px 10px",
  borderRadius: 999,
  background: "rgba(251,191,36,0.15)",
  color: "#fbbf24",
  fontSize: 11,
  fontWeight: 700,
};

const batchBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "3px 10px",
  borderRadius: 999,
  background: "rgba(79,163,255,0.15)",
  color: "#93c5fd",
  fontSize: 11,
  fontWeight: 700,
};

const channelBadge: React.CSSProperties = {
  display: "inline-block",
  padding: "3px 8px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.08)",
  color: "rgba(255,255,255,0.75)",
  fontSize: 11,
  fontWeight: 600,
};

const noteBlock: React.CSSProperties = {
  marginTop: 8,
  fontSize: 12,
  opacity: 0.9,
  padding: "6px 10px",
  borderRadius: 8,
  background: "rgba(255,255,255,0.04)",
  borderLeft: "3px solid rgba(34,197,94,0.3)",
};

const progressBarBg: React.CSSProperties = {
  flex: 1,
  height: 6,
  borderRadius: 3,
  background: "rgba(255,255,255,0.1)",
  overflow: "hidden",
};

const progressBarFill: React.CSSProperties = {
  height: "100%",
  borderRadius: 3,
  background: "linear-gradient(90deg, #22c55e, #4ade80)",
  transition: "width 0.3s",
};

const inputSmall: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(0,0,0,0.3)",
  color: "white",
  fontSize: 13,
  outline: "none",
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(0,0,0,0.3)",
  color: "white",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box" as const,
};

const label: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  opacity: 0.7,
  marginBottom: 6,
  fontWeight: 600,
};

const btnPrimary: React.CSSProperties = {
  padding: "9px 14px",
  borderRadius: 10,
  border: "1px solid rgba(31,79,255,0.4)",
  background: "#1f4fff",
  color: "white",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
};

const btnSecondary: React.CSSProperties = {
  padding: "9px 14px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  cursor: "pointer",
  fontSize: 13,
};

const btnSmall: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 8,
  border: "1px solid rgba(31,79,255,0.3)",
  background: "rgba(31,79,255,0.15)",
  color: "#93c5fd",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 600,
};

const btnDangerSmall: React.CSSProperties = {
  padding: "5px 10px",
  borderRadius: 6,
  border: "1px solid rgba(255,59,48,0.3)",
  background: "rgba(255,59,48,0.12)",
  color: "#fca5a5",
  cursor: "pointer",
  fontSize: 11,
  flexShrink: 0,
};

const modalOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.7)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
  padding: 16,
};

const modalCard: React.CSSProperties = {
  width: 440,
  maxWidth: "100%",
  maxHeight: "90vh",
  overflow: "auto",
  padding: 24,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "#0e1a2e",
  color: "white",
};
