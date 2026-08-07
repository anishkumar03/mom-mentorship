"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Bold, Italic, List, ListOrdered } from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Note = {
  id: string;
  student_id: string | null;
  title: string | null;
  content_html: string;
  created_at: string;
  updated_at: string;
};

type Student = {
  id: string;
  name: string | null;
  full_name: string | null;
};

function studentName(s: Student) {
  return (s.full_name || s.name || "Unnamed").trim() || "Unnamed";
}

function timeAgo(dateStr: string) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function plainText(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [studentFilter, setStudentFilter] = useState<string>("__ALL__");

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [formStudentId, setFormStudentId] = useState<string>("__NONE__");
  const [saving, setSaving] = useState(false);

  const editorRef = useRef<HTMLDivElement | null>(null);
  const contentHtmlRef = useRef("");

  const fetchAll = async () => {
    setLoading(true);
    const [notesRes, studentsRes] = await Promise.all([
      supabase.from("notes").select("*").order("updated_at", { ascending: false }),
      supabase.from("students").select("id,name,full_name").order("created_at", { ascending: false }),
    ]);

    if (notesRes.error) {
      console.error(notesRes.error);
      setNotes([]);
    } else {
      setNotes(Array.isArray(notesRes.data) ? (notesRes.data as Note[]) : []);
    }

    if (studentsRes.error) {
      console.error(studentsRes.error);
      setStudents([]);
    } else {
      setStudents(Array.isArray(studentsRes.data) ? (studentsRes.data as Student[]) : []);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const studentParam = sp.get("student");
    if (studentParam) {
      setStudentFilter(studentParam);
      setFormStudentId(studentParam);
    }
  }, []);

  const studentById = useMemo(() => {
    const map = new Map<string, Student>();
    for (const s of students) map.set(s.id, s);
    return map;
  }, [students]);

  const filteredNotes = useMemo(() => {
    let result = notes;
    if (studentFilter === "__GENERAL__") {
      result = result.filter((n) => !n.student_id);
    } else if (studentFilter !== "__ALL__") {
      result = result.filter((n) => n.student_id === studentFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((n) => {
        const studentLabel = n.student_id ? studentName(studentById.get(n.student_id) ?? { id: "", name: null, full_name: null }) : "";
        const searchable = [n.title, plainText(n.content_html), studentLabel].filter(Boolean).join(" ").toLowerCase();
        return searchable.includes(q);
      });
    }
    return result;
  }, [notes, studentFilter, searchQuery, studentById]);

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setFormStudentId("__NONE__");
    contentHtmlRef.current = "";
    if (editorRef.current) editorRef.current.innerHTML = "";
  };

  const openNewNote = () => {
    resetForm();
    if (studentFilter !== "__ALL__" && studentFilter !== "__GENERAL__") {
      setFormStudentId(studentFilter);
    }
    setFormOpen(true);
  };

  const openEditNote = (n: Note) => {
    setEditingId(n.id);
    setTitle(n.title ?? "");
    setFormStudentId(n.student_id ?? "__NONE__");
    contentHtmlRef.current = n.content_html ?? "";
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => {
      if (editorRef.current) editorRef.current.innerHTML = n.content_html ?? "";
    }, 0);
  };

  const syncContent = () => {
    if (editorRef.current) contentHtmlRef.current = editorRef.current.innerHTML;
  };

  const exec = (command: string) => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    document.execCommand(command);
    syncContent();
  };

  const saveNote = async () => {
    syncContent();
    const html = contentHtmlRef.current.trim();
    if (!title.trim() && plainText(html).length === 0) {
      alert("Add a title or some note content first");
      return;
    }

    setSaving(true);
    const payload = {
      title: title.trim() ? title.trim() : null,
      student_id: formStudentId === "__NONE__" ? null : formStudentId,
      content_html: html,
      updated_at: new Date().toISOString(),
    };

    const res = editingId
      ? await supabase.from("notes").update(payload).eq("id", editingId)
      : await supabase.from("notes").insert(payload);

    setSaving(false);
    if (res.error) {
      alert(res.error.message);
      return;
    }

    resetForm();
    setFormOpen(false);
    fetchAll();
  };

  const deleteNote = async (n: Note) => {
    const ok = confirm(`Delete "${n.title || "this note"}"? This cannot be undone.`);
    if (!ok) return;
    const { error } = await supabase.from("notes").delete().eq("id", n.id);
    if (error) {
      alert(error.message);
      return;
    }
    fetchAll();
  };

  return (
    <div style={page}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0 }}>Notes</h2>
          <div style={{ opacity: 0.6, marginTop: 4, fontSize: 13 }}>
            General mentorship notes, or notes linked to a specific student.
          </div>
        </div>
        <button
          onClick={() => (formOpen ? (resetForm(), setFormOpen(false)) : openNewNote())}
          style={{ ...btnPrimary, padding: "10px 20px", fontSize: 14, fontWeight: 700 }}
        >
          {formOpen ? "Close Form" : "+ New Note"}
        </button>
      </div>

      {formOpen && (
        <div style={{ ...panel, marginTop: 12 }}>
          <h3 style={{ marginTop: 0, fontSize: 15 }}>{editingId ? "Edit Note" : "New Note"}</h3>

          <div style={grid2}>
            <div>
              <label style={label}>Title (optional)</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Note title" style={input} />
            </div>
            <div>
              <label style={label}>Link to student (optional)</label>
              <select value={formStudentId} onChange={(e) => setFormStudentId(e.target.value)} style={input}>
                <option value="__NONE__">General note (no student)</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{studentName(s)}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={label}>Note</label>
            <div style={toolbarRow}>
              <button type="button" onClick={() => exec("bold")} title="Bold" style={toolbarBtn}>
                <Bold size={16} color="#E2E8F0" />
              </button>
              <button type="button" onClick={() => exec("italic")} title="Italic" style={toolbarBtn}>
                <Italic size={16} color="#E2E8F0" />
              </button>
              <button type="button" onClick={() => exec("insertUnorderedList")} title="Bullet List" style={toolbarBtn}>
                <List size={16} color="#E2E8F0" />
              </button>
              <button type="button" onClick={() => exec("insertOrderedList")} title="Numbered List" style={toolbarBtn}>
                <ListOrdered size={16} color="#E2E8F0" />
              </button>
            </div>
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={syncContent}
              style={{
                ...input,
                width: "100%",
                minHeight: 140,
                fontFamily: "inherit",
                outline: "none",
                whiteSpace: "pre-wrap",
                overflow: "auto",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button onClick={saveNote} disabled={saving} style={{ ...btnPrimary, padding: "12px 24px", fontWeight: 700 }}>
              {saving ? "Saving..." : editingId ? "Update Note" : "Save Note"}
            </button>
            <button onClick={() => { resetForm(); setFormOpen(false); }} style={btnSecondary}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ ...panel, marginTop: 12 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <select value={studentFilter} onChange={(e) => setStudentFilter(e.target.value)} style={{ ...inputSmall, minWidth: 180 }}>
            <option value="__ALL__">All notes</option>
            <option value="__GENERAL__">General (not linked)</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>{studentName(s)}</option>
            ))}
          </select>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes..."
            style={{ ...inputSmall, minWidth: 180, flex: "1 1 180px" }}
          />
          <div style={{ marginLeft: "auto", opacity: 0.6, fontSize: 13 }}>
            {loading ? "Loading..." : `${filteredNotes.length} notes`}
          </div>
        </div>

        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          {!loading && filteredNotes.length === 0 && (
            <div style={{ textAlign: "center", padding: 40, opacity: 0.5 }}>
              {notes.length > 0 ? "No notes match your search." : "No notes yet. Add your first note!"}
            </div>
          )}
          {filteredNotes.map((n) => {
            const linked = n.student_id ? studentById.get(n.student_id) : null;
            return (
              <div key={n.id} style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{n.title || "Untitled note"}</span>
                      {linked ? (
                        <span style={studentBadge}>{studentName(linked)}</span>
                      ) : (
                        <span style={generalBadge}>General</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.5, marginTop: 4 }}>
                      Updated {timeAgo(n.updated_at)}
                    </div>
                    <div
                      style={{ marginTop: 8, fontSize: 13, opacity: 0.9 }}
                      dangerouslySetInnerHTML={{ __html: n.content_html || "<span style='opacity:0.5'>(empty)</span>" }}
                    />
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "flex-end", alignContent: "flex-start" }}>
                    <button onClick={() => openEditNote(n)} style={btnSecondary}>Edit</button>
                    <button onClick={() => deleteNote(n)} style={btnDanger}>Delete</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
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

const grid2: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 12,
};

const label: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  opacity: 0.7,
  marginBottom: 6,
  fontWeight: 600,
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
  boxSizing: "border-box",
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

const toolbarRow: React.CSSProperties = {
  display: "flex",
  gap: 6,
  marginBottom: 8,
};

const toolbarBtn: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.05)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const cardStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 14,
  padding: 16,
  background: "rgba(255,255,255,0.03)",
};

const studentBadge: React.CSSProperties = {
  display: "inline-block",
  padding: "3px 10px",
  borderRadius: 999,
  background: "rgba(79,163,255,0.15)",
  color: "#93c5fd",
  fontSize: 11,
  fontWeight: 700,
};

const generalBadge: React.CSSProperties = {
  display: "inline-block",
  padding: "3px 10px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.08)",
  color: "rgba(255,255,255,0.7)",
  fontSize: 11,
  fontWeight: 700,
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

const btnDanger: React.CSSProperties = {
  padding: "9px 14px",
  borderRadius: 10,
  border: "1px solid rgba(255,59,48,0.3)",
  background: "rgba(255,59,48,0.15)",
  color: "#fca5a5",
  cursor: "pointer",
  fontSize: 13,
};
