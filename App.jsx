import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase, COACH_EMAIL } from "./supabaseClient";
import {
  CalendarDays, Users, Info, Wallet, Lock, Unlock, LogOut, Plus, Pencil,
  Trash2, Check, X, Copy, MapPin, Phone, Mail, Ticket, RefreshCw, ChevronDown,
  ChevronRight, AlertTriangle, Clock, Save, DoorOpen,
} from "lucide-react";

/* ============================================================
   Szinek - a Razar logo alapjan
   ============================================================ */
const C = {
  bg: "#0A0A0B",
  card: "#141416",
  card2: "#1C1C1F",
  border: "#2B2B30",
  text: "#F5F5F5",
  muted: "#8C8C93",
  lime: "#CFFF01",   // a logo neonzold szine
  cyan: "#35E2F2",   // a logo turkiz szine
  red: "#FF5A5A",
  amber: "#FFB84D",
};

const DAYS_HU = ["vasárnap", "hétfő", "kedd", "szerda", "csütörtök", "péntek", "szombat"];
const MONTHS_HU = ["január", "február", "március", "április", "május", "június",
  "július", "augusztus", "szeptember", "október", "november", "december"];

const LOG_LABELS = {
  jelentkezes: "Jelentkezés",
  jelentkezes_torolve: "Jelentkezés visszavonva",
  gyerek_felveve: "Gyerek felvéve",
  gyerek_modositva: "Gyerek adatai módosítva",
  gyerek_lomtarba: "Gyerek lomtárba került",
  gyerek_visszaallitva: "Gyerek visszaállítva",
  gyerek_veglegesen_torolve: "Gyerek véglegesen törölve",
  alkalom_letrehozva: "Alkalom létrehozva",
  alkalom_sorozat: "Alkalom-sorozat létrehozva",
  alkalom_modositva: "Alkalom módosítva",
  alkalom_lomtarba: "Alkalom lomtárba került",
  alkalom_visszaallitva: "Alkalom visszaállítva",
  alkalom_veglegesen_torolve: "Alkalom véglegesen törölve",
  berlet_valtozas: "Bérlet egyenleg változott",
  fizetes: "Fizetés rögzítve",
  beallitas_modositva: "Beállítás módosítva",
  edzo_belepett: "Edző belépett",
  edzo_kilepett: "Edző kilépett",
};

const DEFAULT_PRICING = {
  min_headcount: 5,
  tiers: [
    { min: 7, drop_in: 6000, pass_extra: 0 },
    { min: 6, drop_in: 7000, pass_extra: 1000 },
    { min: 5, drop_in: 8000, pass_extra: 2000 },
  ],
};

const DEFAULT_INFO = {
  location_title: "Helyszín",
  location: "Óbudai Jégpálya",
  map_url: "",
  schedule: "Minden kedden",
  coaches: "Anna\nZsolt",
  pass_info: "A bérlet részleteit hamarosan kitöltjük.",
  transfer_name: "Szalma-Baráth Anna",
  transfer_account: "11600006-00000002-08354301",
  extra: "",
};

/* ============================================================
   Segedfuggvenyek
   ============================================================ */
function fmtHUF(n) {
  if (n === null || n === undefined || isNaN(n)) return "-";
  return new Intl.NumberFormat("hu-HU").format(Math.round(n)) + " Ft";
}

function parseLessonStart(lesson) {
  const [h, m] = (lesson.start_time || "00:00").split(":").map(Number);
  const d = new Date(lesson.date + "T00:00:00");
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

function closesAt(lesson) {
  const d = parseLessonStart(lesson);
  d.setMinutes(d.getMinutes() + 30);
  return d;
}

function isClosed(lesson, now = new Date()) {
  return now >= closesAt(lesson);
}

function fmtDateLong(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getFullYear()}. ${MONTHS_HU[d.getMonth()]} ${d.getDate()}., ${DAYS_HU[d.getDay()]}`;
}

function fmtDateShort(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return `${String(d.getMonth() + 1).padStart(2, "0")}. ${String(d.getDate()).padStart(2, "0")}. ${DAYS_HU[d.getDay()].slice(0, 2)}.`;
}

function nextWeekdayISO(weekday = 2, from = new Date()) {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const diff = (weekday - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDaysISO(iso, days) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function initials(name) {
  return (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

/** Melyik arsav ervenyes ennyi fonel? null = az ora elmarad. */
function tierFor(headcount, pricing) {
  const tiers = [...(pricing?.tiers || [])].sort((a, b) => b.min - a.min);
  for (const t of tiers) if (headcount >= t.min) return t;
  return null;
}

function localGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function localSet(key, val) {
  try { if (val === null) localStorage.removeItem(key); else localStorage.setItem(key, val); } catch { /* ignore */ }
}

/* ============================================================
   Apro UI elemek
   ============================================================ */
function Card({ children, className = "", style = {} }) {
  return (
    <div
      className={"rounded-2xl p-4 " + className}
      style={{ background: C.card, border: `1px solid ${C.border}`, ...style }}
    >
      {children}
    </div>
  );
}

function Btn({ children, onClick, tone = "ghost", size = "md", disabled, className = "", type = "button" }) {
  const tones = {
    primary: { background: C.lime, color: "#0A0A0A", border: "1px solid transparent" },
    cyan: { background: C.cyan, color: "#0A0A0A", border: "1px solid transparent" },
    ghost: { background: C.card2, color: C.text, border: `1px solid ${C.border}` },
    danger: { background: "transparent", color: C.red, border: `1px solid ${C.red}44` },
    plain: { background: "transparent", color: C.muted, border: "1px solid transparent" },
  };
  const sizes = {
    sm: "text-xs px-3 py-1.5 rounded-lg",
    md: "text-sm px-4 py-2.5 rounded-xl",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`font-semibold transition active:scale-[0.97] disabled:opacity-40 ${sizes[size]} ${className}`}
      style={tones[tone]}
    >
      {children}
    </button>
  );
}

function Label({ children }) {
  return <div className="text-xs font-semibold mb-1.5" style={{ color: C.muted }}>{children}</div>;
}

function Modal({ title, onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 max-h-[90vh] overflow-y-auto"
        style={{ background: C.card, border: `1px solid ${C.border}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="text-base font-bold">{title}</div>
          <button onClick={onClose} style={{ color: C.muted }}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Empty({ children }) {
  return <div className="text-center text-sm py-10" style={{ color: C.muted }}>{children}</div>;
}

/* ============================================================
   Fo komponens
   ============================================================ */
export default function App() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [isCoach, setIsCoach] = useState(false);

  const [kids, setKids] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [attendance, setAttendance] = useState([]);   // {lesson_id, kid_id, status}
  const [payments, setPayments] = useState([]);       // csak edzonek
  const [trashKids, setTrashKids] = useState([]);     // lomtar, csak edzonek
  const [trashLessons, setTrashLessons] = useState([]);
  const [log, setLog] = useState([]);                 // naplo, csak edzonek
  const [settings, setSettings] = useState({ pricing: DEFAULT_PRICING, info: DEFAULT_INFO, groups: ["U8-10"] });

  const [tab, setTab] = useState("lesson");
  const [selectedLessonId, setSelectedLessonId] = useState(null);
  const [myKidId, setMyKidId] = useState(localGet("razar_my_kid"));
  const [now, setNow] = useState(new Date());
  const actorNameRef = useRef("szülő");

  const [loginOpen, setLoginOpen] = useState(false);
  const [loginPw, setLoginPw] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [busy, setBusy] = useState(false);

  const pricing = settings.pricing || DEFAULT_PRICING;
  const info = { ...DEFAULT_INFO, ...(settings.info || {}) };

  /* --- naplozas: minden valtozas nyoma --- */
  const logEvent = useCallback(async (action, entity, entityId, label, details) => {
    try {
      await supabase.from("razar_log").insert({
        actor: actorNameRef.current,
        action, entity, entity_id: entityId || null,
        label: label || null, details: details || null,
      });
    } catch { /* a naplozas soha ne akassza meg a muveletet */ }
  }, []);

  /* --- adatbetoltes --- */
  const loadAll = useCallback(async (coach) => {
    setErr("");
    try {
      const kidsQuery = coach
        ? supabase.from("razar_kids").select("*").is("deleted_at", null).order("sort_order").order("name")
        : supabase.from("razar_kids_public").select("*").order("sort_order").order("name");

      const [kidsRes, lessonsRes, attRes, setRes] = await Promise.all([
        kidsQuery,
        supabase.from("razar_lessons").select("*").is("deleted_at", null).order("date"),
        supabase.from("razar_attendance").select("*"),
        supabase.from("razar_settings").select("*"),
      ]);

      if (kidsRes.error) throw kidsRes.error;
      if (lessonsRes.error) throw lessonsRes.error;
      if (attRes.error) throw attRes.error;
      if (setRes.error) throw setRes.error;

      setKids(kidsRes.data || []);
      setLessons(lessonsRes.data || []);
      setAttendance(attRes.data || []);

      const s = {};
      (setRes.data || []).forEach((row) => { s[row.key] = row.value; });
      setSettings({
        pricing: s.pricing || DEFAULT_PRICING,
        info: { ...DEFAULT_INFO, ...(s.info || {}) },
        groups: s.groups || ["U8-10"],
      });

      if (coach) {
        const [payRes, tKids, tLessons, logRes] = await Promise.all([
          supabase.from("razar_payments").select("*"),
          supabase.from("razar_kids").select("*").not("deleted_at", "is", null).order("deleted_at", { ascending: false }),
          supabase.from("razar_lessons").select("*").not("deleted_at", "is", null).order("deleted_at", { ascending: false }),
          supabase.from("razar_log").select("*").order("at", { ascending: false }).limit(200),
        ]);
        if (payRes.error) throw payRes.error;
        setPayments(payRes.data || []);
        setTrashKids(tKids.data || []);
        setTrashLessons(tLessons.data || []);
        setLog(logRes.data || []);
      } else {
        setPayments([]); setTrashKids([]); setTrashLessons([]); setLog([]);
      }
    } catch (e) {
      setErr(e.message || "Nem sikerult betolteni az adatokat.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const coach = !!data.session;
      setIsCoach(coach);
      loadAll(coach);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const coach = !!session;
      setIsCoach(coach);
      loadAll(coach);
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, [loadAll]);

  /* --- ki vegzi a muveletet (a naplohoz) --- */
  useEffect(() => {
    actorNameRef.current = isCoach
      ? "edző"
      : (kids.find((k) => k.id === myKidId)?.name || "szülő");
  }, [isCoach, myKidId, kids]);

  /* --- ora allapot frissitese (zaras figyelese + letszam) --- */
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    const onFocus = () => { setNow(new Date()); loadAll(isCoach); };
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(t); window.removeEventListener("focus", onFocus); };
  }, [isCoach, loadAll]);

  /* --- szarmaztatott adatok --- */
  const activeKids = useMemo(() => kids.filter((k) => k.is_active !== false), [kids]);

  const attIndex = useMemo(() => {
    const m = {};
    attendance.forEach((a) => { m[`${a.lesson_id}|${a.kid_id}`] = a.status; });
    return m;
  }, [attendance]);

  const payIndex = useMemo(() => {
    const m = {};
    payments.forEach((p) => { m[`${p.lesson_id}|${p.kid_id}`] = p; });
    return m;
  }, [payments]);

  const headcountOf = useCallback(
    (lessonId) => attendance.filter((a) => a.lesson_id === lessonId && a.status === "yes").length,
    [attendance]
  );

  const upcoming = useMemo(
    () => lessons.filter((l) => !isClosed(l, now)).sort((a, b) => a.date.localeCompare(b.date)),
    [lessons, now]
  );
  const past = useMemo(
    () => lessons.filter((l) => isClosed(l, now)).sort((a, b) => b.date.localeCompare(a.date)),
    [lessons, now]
  );

  const defaultLesson = upcoming[0] || past[0] || null;
  const selectedLesson =
    lessons.find((l) => l.id === selectedLessonId) || defaultLesson;

  /* --- muveletek --- */
  async function login() {
    setBusy(true); setLoginErr("");
    const { error } = await supabase.auth.signInWithPassword({
      email: COACH_EMAIL,
      password: loginPw,
    });
    setBusy(false);
    if (error) { setLoginErr("Hibás jelszó"); return; }
    actorNameRef.current = "edző";
    setLoginOpen(false); setLoginPw("");
    logEvent("edzo_belepett", "auth", null, null, null);
  }

  async function logout() {
    logEvent("edzo_kilepett", "auth", null, null, null);
    await supabase.auth.signOut();
    actorNameRef.current = myKidId
      ? (kids.find((k) => k.id === myKidId)?.name || "szülő")
      : "szülő";
    setTab("lesson");
  }

  function chooseMyKid(id) {
    setMyKidId(id || null);
    localSet("razar_my_kid", id || null);
  }

  async function setResponse(lessonId, kidId, status) {
    const key = `${lessonId}|${kidId}`;
    const prev = attIndex[key];
    const next = prev === status ? null : status;

    // optimista frissites
    setAttendance((rows) => {
      const others = rows.filter((r) => !(r.lesson_id === lessonId && r.kid_id === kidId));
      return next ? [...others, { lesson_id: lessonId, kid_id: kidId, status: next }] : others;
    });

    const kidName = kids.find((k) => k.id === kidId)?.name || "";
    const lessonDate = lessons.find((l) => l.id === lessonId)?.date || "";

    if (next === null) {
      const { error } = await supabase.from("razar_attendance").delete()
        .eq("lesson_id", lessonId).eq("kid_id", kidId);
      if (error) { setErr(error.message); return; }
      logEvent("jelentkezes_torolve", "attendance", lessonId,
        `${kidName} — ${lessonDate}`, { elozo: prev, uj: null });
    } else {
      const { error } = await supabase.from("razar_attendance")
        .upsert({ lesson_id: lessonId, kid_id: kidId, status: next, updated_at: new Date().toISOString() });
      if (error) { setErr(error.message); return; }
      logEvent("jelentkezes", "attendance", lessonId,
        `${kidName} — ${lessonDate}: ${next === "yes" ? "jön" : "nem jön"}`, { elozo: prev, uj: next });
    }
  }

  async function saveSetting(key, value) {
    setSettings((s) => ({ ...s, [key]: value }));
    const { error } = await supabase.from("razar_settings").upsert({ key, value });
    if (error) { setErr(error.message); return; }
    logEvent("beallitas_modositva", "settings", null, key, value);
  }

  async function saveKid(draft) {
    const payload = {
      name: draft.name.trim(),
      group_name: draft.group_name || "U8-10",
      parent_name: draft.parent_name || null,
      parent_phone: draft.parent_phone || null,
      parent_email: draft.parent_email || null,
      pass_sessions_left: Number(draft.pass_sessions_left) || 0,
      is_active: draft.is_active !== false,
      note: draft.note || null,
    };
    if (draft.id) {
      const before = kids.find((k) => k.id === draft.id);
      const { error } = await supabase.from("razar_kids").update(payload).eq("id", draft.id);
      if (error) { setErr(error.message); return false; }
      logEvent("gyerek_modositva", "kid", draft.id, payload.name, { elotte: before, utana: payload });
    } else {
      const { data, error } = await supabase.from("razar_kids").insert(payload).select().single();
      if (error) { setErr(error.message); return false; }
      logEvent("gyerek_felveve", "kid", data?.id, payload.name, payload);
    }
    await loadAll(true);
    return true;
  }

  /** A torles nem veglegesen torol: a lomtarba teszi, ahonnan visszaallithato. */
  async function deleteKid(id) {
    const kid = kids.find((k) => k.id === id);
    const { error } = await supabase.from("razar_kids")
      .update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) { setErr(error.message); return; }
    logEvent("gyerek_lomtarba", "kid", id, kid?.name, kid);
    await loadAll(true);
  }

  async function restoreKid(kid) {
    const { error } = await supabase.from("razar_kids")
      .update({ deleted_at: null }).eq("id", kid.id);
    if (error) { setErr(error.message); return; }
    logEvent("gyerek_visszaallitva", "kid", kid.id, kid.name, null);
    await loadAll(true);
  }

  async function purgeKid(kid) {
    const { error } = await supabase.from("razar_kids").delete().eq("id", kid.id);
    if (error) { setErr(error.message); return; }
    logEvent("gyerek_veglegesen_torolve", "kid", kid.id, kid.name, kid);
    await loadAll(true);
  }

  async function addPassSessions(kid, count) {
    const next = Math.max(0, (kid.pass_sessions_left || 0) + Number(count));
    const { error } = await supabase.from("razar_kids").update({ pass_sessions_left: next }).eq("id", kid.id);
    if (error) { setErr(error.message); return; }
    logEvent("berlet_valtozas", "kid", kid.id, kid.name,
      { elotte: kid.pass_sessions_left || 0, utana: next, valtozas: Number(count) });
    await loadAll(true);
  }

  async function saveLesson(draft) {
    const payload = {
      date: draft.date,
      start_time: draft.start_time,
      end_time: draft.end_time,
      location: draft.location,
      locker_room: draft.locker_room || null,
      group_name: draft.group_name || "U8-10",
      status: draft.status || "open",
      note: draft.note || null,
    };
    if (draft.id) {
      const before = lessons.find((l) => l.id === draft.id);
      const { error } = await supabase.from("razar_lessons").update(payload).eq("id", draft.id);
      if (error) { setErr(error.message); return false; }
      logEvent("alkalom_modositva", "lesson", draft.id, payload.date, { elotte: before, utana: payload });
    } else {
      const { data, error } = await supabase.from("razar_lessons").insert(payload).select().single();
      if (error) { setErr(error.message); return false; }
      logEvent("alkalom_letrehozva", "lesson", data?.id, payload.date, payload);
    }
    await loadAll(true);
    return true;
  }

  async function createSeries(draft, weeks) {
    const rows = [];
    for (let i = 0; i < weeks; i++) {
      rows.push({
        date: addDaysISO(draft.date, i * 7),
        start_time: draft.start_time,
        end_time: draft.end_time,
        location: draft.location,
        locker_room: draft.locker_room || null,
        group_name: draft.group_name || "U8-10",
        status: "open",
      });
    }
    const { error } = await supabase.from("razar_lessons").insert(rows);
    if (error) { setErr(error.message); return false; }
    logEvent("alkalom_sorozat", "lesson", null, `${weeks} alkalom ${draft.date}-tól`, { rows });
    await loadAll(true);
    return true;
  }

  async function deleteLesson(id) {
    const lesson = lessons.find((l) => l.id === id);
    const { error } = await supabase.from("razar_lessons")
      .update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) { setErr(error.message); return; }
    logEvent("alkalom_lomtarba", "lesson", id, lesson?.date, lesson);
    if (selectedLessonId === id) setSelectedLessonId(null);
    await loadAll(true);
  }

  async function restoreLesson(lesson) {
    const { error } = await supabase.from("razar_lessons")
      .update({ deleted_at: null }).eq("id", lesson.id);
    if (error) { setErr(error.message); return; }
    logEvent("alkalom_visszaallitva", "lesson", lesson.id, lesson.date, null);
    await loadAll(true);
  }

  async function purgeLesson(lesson) {
    const { error } = await supabase.from("razar_lessons").delete().eq("id", lesson.id);
    if (error) { setErr(error.message); return; }
    logEvent("alkalom_veglegesen_torolve", "lesson", lesson.id, lesson.date, lesson);
    await loadAll(true);
  }

  /** Mennyit kell fizetnie ennek a gyereknek ezen az oran. */
  const dueFor = useCallback((lesson, kid) => {
    const tier = tierFor(headcountOf(lesson.id), pricing);
    if (!tier || lesson.status === "cancelled") return { amount: 0, tier: null, byPass: false };
    const existing = payIndex[`${lesson.id}|${kid.id}`];
    const byPass = existing ? existing.method === "pass" : (kid.pass_sessions_left || 0) > 0;
    return {
      amount: byPass ? tier.pass_extra : tier.drop_in,
      tier,
      byPass,
    };
  }, [headcountOf, pricing, payIndex]);

  async function setPayment(lesson, kid, patch) {
    const key = `${lesson.id}|${kid.id}`;
    const existing = payIndex[key];
    const due = dueFor(lesson, kid);
    const base = existing || {
      lesson_id: lesson.id,
      kid_id: kid.id,
      amount: due.amount,
      method: due.byPass ? "pass" : null,
      paid: false,
      used_pass: false,
    };
    const next = { ...base, ...patch };

    // osszeg ujraszamolasa, ha a mod valtozott
    const tier = tierFor(headcountOf(lesson.id), pricing);
    if (tier && patch.method !== undefined) {
      next.amount = patch.method === "pass" ? tier.pass_extra : tier.drop_in;
    }
    next.paid_at = next.paid ? (base.paid_at || new Date().toISOString()) : null;

    // berlet alkalom levonasa / visszairasa
    const shouldUsePass = next.method === "pass" && next.paid;
    let passDelta = 0;
    if (shouldUsePass && !base.used_pass) passDelta = -1;
    if (!shouldUsePass && base.used_pass) passDelta = +1;
    next.used_pass = shouldUsePass;

    const { error } = await supabase.from("razar_payments").upsert({
      lesson_id: next.lesson_id,
      kid_id: next.kid_id,
      amount: next.amount,
      method: next.method,
      paid: next.paid,
      used_pass: next.used_pass,
      paid_at: next.paid_at,
      note: next.note || null,
    });
    if (error) { setErr(error.message); return; }

    logEvent("fizetes", "payment", kid.id,
      `${kid.name} — ${lesson.date}: ${next.paid ? "fizetve" : "nincs fizetve"} (${fmtHUF(next.amount)})`,
      { mod: next.method, osszeg: next.amount, fizetve: next.paid });

    if (passDelta !== 0) {
      const current = kids.find((k) => k.id === kid.id);
      const newLeft = Math.max(0, (current?.pass_sessions_left || 0) + passDelta);
      await supabase.from("razar_kids").update({ pass_sessions_left: newLeft }).eq("id", kid.id);
    }
    await loadAll(true);
  }

  /* ============================================================
     Megjelenites
     ============================================================ */
  const [kidModal, setKidModal] = useState(null);     // draft objektum vagy null
  const [lessonModal, setLessonModal] = useState(null);
  const [infoEdit, setInfoEdit] = useState(false);
  const [priceEdit, setPriceEdit] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [passModal, setPassModal] = useState(null);

  const TABS = [
    { id: "lesson", label: "Alkalmak", icon: CalendarDays },
    { id: "kids", label: "Gyerekek", icon: Users },
    { id: "info", label: "Infó", icon: Info },
    ...(isCoach ? [{ id: "money", label: "Pénzügy", icon: Wallet }] : []),
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
        <div className="text-sm" style={{ color: C.muted }}>Betöltés…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28" style={{ background: C.bg, color: C.text }}>
      {/* ---------- Fejlec ---------- */}
      <div
        className="sticky top-0 z-30 px-4 py-3 flex items-center gap-3"
        style={{ background: "rgba(10,10,10,0.92)", backdropFilter: "blur(10px)", borderBottom: `1px solid ${C.border}` }}
      >
        <img src="/razar-logo.jpg" alt="Razar" className="w-10 h-10 rounded-full shrink-0" />
        <img src="/razar-wordmark.jpg" alt="Razar Skating Skill" className="h-7 w-auto" />
        <div className="flex-1" />
        <button onClick={() => loadAll(isCoach)} style={{ color: C.muted }} className="p-2">
          <RefreshCw size={16} />
        </button>
        {isCoach ? (
          <button
            onClick={logout}
            className="flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-full"
            style={{ background: C.card2, color: C.lime }}
          >
            <Unlock size={14} /> Edző <LogOut size={13} />
          </button>
        ) : (
          <button
            onClick={() => setLoginOpen(true)}
            className="flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-full"
            style={{ background: C.card2, color: C.muted }}
          >
            <Lock size={14} /> Edző
          </button>
        )}
      </div>

      {err && (
        <div className="mx-4 mt-3 rounded-xl px-3 py-2 text-xs flex items-start gap-2"
          style={{ background: "#2A1414", color: C.red, border: `1px solid ${C.red}44` }}>
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <div className="flex-1">{err}</div>
          <button onClick={() => setErr("")}><X size={14} /></button>
        </div>
      )}

      <div className="px-4 pt-4 space-y-4">
        {tab === "lesson" && renderLessonView()}
        {tab === "kids" && renderKids()}
        {tab === "info" && renderInfo()}
        {tab === "money" && isCoach && renderMoney()}
      </div>

      {/* ---------- Also menu ---------- */}
      <div
        className="fixed bottom-0 left-0 right-0 z-30 px-2 pt-2 pb-[max(8px,env(safe-area-inset-bottom))] flex"
        style={{ background: "rgba(10,10,10,0.95)", backdropFilter: "blur(10px)", borderTop: `1px solid ${C.border}` }}
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex-1 flex flex-col items-center gap-1 py-1.5 rounded-xl"
              style={{ color: on ? C.lime : C.muted }}
            >
              <Icon size={19} />
              <span className="text-[10px] font-semibold">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ---------- Modalok ---------- */}
      {loginOpen && (
        <Modal title="Edzői belépés" onClose={() => { setLoginOpen(false); setLoginErr(""); }}>
          <Label>Jelszó</Label>
          <input
            type="password"
            value={loginPw}
            autoFocus
            onChange={(e) => setLoginPw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            placeholder="••••••"
          />
          {loginErr && <div className="text-xs mt-2" style={{ color: C.red }}>{loginErr}</div>}
          <div className="mt-4">
            <Btn tone="primary" onClick={login} disabled={busy || loginPw.length < 4} className="w-full">
              {busy ? "Belépés…" : "Belépés"}
            </Btn>
          </div>
          <p className="text-[11px] mt-3" style={{ color: C.muted }}>
            Ez a közös edzői jelszó. A szülők ezt nem ismerik, és nélküle a fizetési adatok
            nem is tölthetők le az adatbázisból.
          </p>
        </Modal>
      )}

      {kidModal && (
        <KidForm
          draft={kidModal}
          groups={settings.groups}
          onClose={() => setKidModal(null)}
          onSave={async (d) => { const ok = await saveKid(d); if (ok) setKidModal(null); }}
          onDelete={kidModal.id ? async () => {
            if (confirm("A gyerek a lomtárba kerül. Az Infó fülön bármikor visszaállítható.")) {
              await deleteKid(kidModal.id); setKidModal(null);
            }
          } : null}
        />
      )}

      {lessonModal && (
        <LessonForm
          draft={lessonModal}
          groups={settings.groups}
          onClose={() => setLessonModal(null)}
          onSave={async (d) => { const ok = await saveLesson(d); if (ok) setLessonModal(null); }}
          onSeries={async (d, weeks) => { const ok = await createSeries(d, weeks); if (ok) setLessonModal(null); }}
          onDelete={lessonModal.id ? async () => {
            if (confirm("Az alkalom a lomtárba kerül. Az Infó fülön bármikor visszaállítható.")) {
              await deleteLesson(lessonModal.id); setLessonModal(null);
            }
          } : null}
        />
      )}

      {passModal && (
        <Modal title={`Bérlet — ${passModal.name}`} onClose={() => setPassModal(null)}>
          <div className="text-sm mb-3" style={{ color: C.muted }}>
            Jelenlegi egyenleg: <b style={{ color: C.lime }}>{passModal.pass_sessions_left || 0} alkalom</b>
          </div>
          <Label>Hány alkalmat adunk hozzá?</Label>
          <div className="flex gap-2 flex-wrap mb-4">
            {[1, 4, 5, 8, 10].map((n) => (
              <Btn key={n} tone="ghost" size="sm" onClick={async () => { await addPassSessions(passModal, n); setPassModal(null); }}>
                + {n}
              </Btn>
            ))}
            <Btn tone="danger" size="sm" onClick={async () => { await addPassSessions(passModal, -1); setPassModal(null); }}>
              − 1
            </Btn>
          </div>
          <p className="text-[11px]" style={{ color: C.muted }}>
            A bérlet alkalmai automatikusan fogynak, amikor a Pénzügy fülön „bérletből” módra
            állítod és kipipálod a fizetést.
          </p>
        </Modal>
      )}
    </div>
  );

  /* ---------- 1. ORA ---------- */
  function renderLessonView() {
    const lesson = selectedLesson;
    if (!lesson) {
      return (
        <>
          <Card>
            <Empty>
              Még nincs felvéve alkalom.<br />
              {isCoach ? "Hozz létre egyet az alábbi gombbal." : "Az edzők hamarosan feltöltik."}
            </Empty>
          </Card>
          {renderLessonsList()}
        </>
      );
    }

    const closed = isClosed(lesson, now) || lesson.status === "cancelled";
    const count = headcountOf(lesson.id);
    const tier = tierFor(count, pricing);
    const cancelled = lesson.status === "cancelled";
    const listKids = activeKids.filter((k) => k.group_name === lesson.group_name);
    const mine = listKids.find((k) => k.id === myKidId);
    const ordered = mine ? [mine, ...listKids.filter((k) => k.id !== mine.id)] : listKids;
    const yesList = ordered.filter((k) => attIndex[`${lesson.id}|${k.id}`] === "yes");
    const noList = ordered.filter((k) => attIndex[`${lesson.id}|${k.id}`] === "no");
    const noAnswer = ordered.filter((k) => !attIndex[`${lesson.id}|${k.id}`]);

    return (
      <>
        {/* --- az ora fejlece --- */}
        <Card style={{ borderColor: cancelled ? `${C.red}55` : C.border }}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[11px] font-semibold tracking-wider" style={{ color: C.cyan }}>
                {upcoming[0]?.id === lesson.id ? "KÖVETKEZŐ ALKALOM" : "ALKALOM"} · {lesson.group_name}
              </div>
              <div className="text-xl font-extrabold mt-1">{fmtDateLong(lesson.date)}</div>
              <div className="text-sm mt-1" style={{ color: C.muted }}>
                {lesson.start_time}–{lesson.end_time} · {lesson.location}
              </div>
              {lesson.locker_room && (
                <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-full text-sm font-bold"
                  style={{ background: C.card2, color: C.cyan }}>
                  <DoorOpen size={14} /> {lesson.locker_room}. öltöző
                </div>
              )}
            </div>
            {isCoach && (
              <button onClick={() => setLessonModal({ ...lesson })} style={{ color: C.muted }} className="p-1">
                <Pencil size={16} />
              </button>
            )}
          </div>
          {lesson.note && <div className="text-sm mt-3 pt-3" style={{ color: C.muted, borderTop: `1px solid ${C.border}` }}>{lesson.note}</div>}
        </Card>

        {/* --- letszam es ar --- */}
        <Card
          className="text-center relative overflow-hidden"
          style={{
            borderColor: cancelled ? `${C.red}55` : tier ? `${C.lime}44` : `${C.amber}55`,
            backgroundImage: "linear-gradient(rgba(20,20,22,0.88), rgba(20,20,22,0.97)), url(/razar-rz.jpg)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {cancelled ? (
            <>
              <div className="text-lg font-extrabold" style={{ color: C.red }}>Ez az alkalom elmarad</div>
              <div className="text-sm mt-1" style={{ color: C.muted }}>Az edzők lemondták.</div>
            </>
          ) : (
            <>
              <div className="text-5xl font-extrabold" style={{ color: tier ? C.lime : C.amber }}>{count}</div>
              <div className="text-sm font-semibold mt-1" style={{ color: C.muted }}>
                {closed ? "fő vett részt" : "fő jelentkezett eddig"}
              </div>

              {tier ? (
                <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
                  <div className="text-2xl font-extrabold">{fmtHUF(tier.drop_in)}</div>
                  <div className="text-xs mt-0.5" style={{ color: C.muted }}>alkalmi díj</div>
                  <div className="text-sm mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                    style={{ background: C.card2, color: C.cyan }}>
                    <Ticket size={14} />
                    Bérletesnek: 1 alkalom{tier.pass_extra > 0 ? ` + ${fmtHUF(tier.pass_extra)}` : ""}
                  </div>
                </div>
              ) : (
                <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
                  <div className="text-base font-bold" style={{ color: C.amber }}>
                    {pricing.min_headcount} főnél kevesebben vagytok
                  </div>
                  <div className="text-xs mt-1" style={{ color: C.muted }}>
                    Ennyi létszámmal az óra elmarad. Még {pricing.min_headcount - count} fő kell.
                  </div>
                </div>
              )}

              {!closed && (
                <div className="text-[11px] mt-4" style={{ color: C.muted }}>
                  Az ár a végleges létszám alapján alakul ki. A jelentkezés az óra kezdete után
                  30 perccel zár.
                </div>
              )}
            </>
          )}
        </Card>

        {closed && !cancelled && (
          <div className="text-center text-xs py-1" style={{ color: C.muted }}>
            A jelentkezés lezárt {isCoach ? "— edzőként még tudod módosítani." : "."}
          </div>
        )}

        {/* --- ki vagyok? --- */}
        {!myKidId && listKids.length > 0 && (
          <Card style={{ borderColor: `${C.cyan}44` }}>
            <Label>Ki a te gyereked?</Label>
            <select value="" onChange={(e) => chooseMyKid(e.target.value)}>
              <option value="">Válassz…</option>
              {listKids.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
            </select>
            <p className="text-[11px] mt-2" style={{ color: C.muted }}>
              Csak ezen a telefonon mentjük el, hogy legfelül lássátok.
            </p>
          </Card>
        )}

        {/* --- gyereklista --- */}
        <div className="space-y-2">
          {ordered.length === 0 && <Card><Empty>Ehhez a csoporthoz még nincs gyerek felvéve.</Empty></Card>}
          {ordered.map((k) => {
            const st = attIndex[`${lesson.id}|${k.id}`];
            const isMine = k.id === myKidId;
            return (
              <div
                key={k.id}
                className="rounded-2xl px-3 py-2.5 flex items-center gap-3"
                style={{
                  background: C.card,
                  border: `1px solid ${isMine ? C.cyan + "77" : C.border}`,
                }}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: C.card2, color: st === "yes" ? C.lime : C.muted }}
                >
                  {initials(k.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{k.name}</div>
                  {isMine && <div className="text-[10px]" style={{ color: C.cyan }}>a te gyereked</div>}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => setResponse(lesson.id, k.id, "yes")}
                    disabled={closed && !isCoach}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30"
                    style={{
                      background: st === "yes" ? C.lime : C.card2,
                      color: st === "yes" ? "#0A0A0A" : C.muted,
                    }}
                  >
                    Jön
                  </button>
                  <button
                    onClick={() => setResponse(lesson.id, k.id, "no")}
                    disabled={closed && !isCoach}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30"
                    style={{
                      background: st === "no" ? C.red : C.card2,
                      color: st === "no" ? "#0A0A0A" : C.muted,
                    }}
                  >
                    Nem
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center text-[11px]" style={{ color: C.muted }}>
          Jön: {yesList.length} · Nem jön: {noList.length} · Nem válaszolt: {noAnswer.length}
        </div>

        <div className="pt-4 mt-2 space-y-4" style={{ borderTop: `1px solid ${C.border}` }}>
          {renderLessonsList()}
        </div>
      </>
    );
  }

  /* ---------- Az alkalmak listaja (a fo nezet aljan) ---------- */
  function renderLessonsList() {
    const row = (l) => {
      const count = headcountOf(l.id);
      const tier = tierFor(count, pricing);
      const cancelled = l.status === "cancelled";
      return (
        <button
          key={l.id}
          onClick={() => { setSelectedLessonId(l.id); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          className="w-full rounded-2xl px-4 py-3 flex items-center gap-3 text-left"
          style={{ background: C.card, border: `1px solid ${l.id === selectedLesson?.id ? C.lime + "66" : C.border}` }}
        >
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm">{fmtDateShort(l.date)}</div>
            <div className="text-[11px] mt-0.5" style={{ color: C.muted }}>
              {l.start_time}–{l.end_time} · {l.location}
              {l.locker_room ? ` · ${l.locker_room}. öltöző` : ""}
            </div>
          </div>
          <div className="text-right shrink-0">
            {cancelled ? (
              <div className="text-xs font-bold" style={{ color: C.red }}>elmarad</div>
            ) : (
              <>
                <div className="text-sm font-extrabold" style={{ color: tier ? C.lime : C.amber }}>{count} fő</div>
                <div className="text-[11px]" style={{ color: C.muted }}>
                  {tier ? fmtHUF(tier.drop_in) : "kevés fő"}
                </div>
              </>
            )}
          </div>
          <ChevronRight size={16} style={{ color: C.muted }} />
        </button>
      );
    };

    return (
      <>
        {isCoach && (
          <div className="flex gap-2">
            <Btn tone="primary" className="flex-1" onClick={() => setLessonModal({
              date: nextWeekdayISO(2), start_time: "16:00", end_time: "16:50",
              location: info.location.split("\n")[0] || "Óbudai Jégpálya",
              group_name: settings.groups[0] || "U8-10", status: "open",
            })}>
              <span className="inline-flex items-center gap-1.5"><Plus size={15} /> Új alkalom</span>
            </Btn>
          </div>
        )}

        <div>
          <div className="text-xs font-bold mb-2" style={{ color: C.muted }}>TOVÁBBI ALKALMAK</div>
          <div className="space-y-2">
            {upcoming.length === 0
              ? <Card><Empty>Nincs közelgő alkalom.</Empty></Card>
              : upcoming.map(row)}
          </div>
        </div>

        <div>
          <button onClick={() => setShowPast((v) => !v)} className="flex items-center gap-1.5 text-xs font-bold mb-2" style={{ color: C.muted }}>
            {showPast ? <ChevronDown size={14} /> : <ChevronRight size={14} />} KORÁBBI ALKALMAK ({past.length})
          </button>
          {showPast && <div className="space-y-2">{past.map(row)}</div>}
        </div>
      </>
    );
  }

  /* ---------- 3. GYEREKEK ---------- */
  function renderKids() {
    return (
      <>
        {isCoach && (
          <Btn tone="primary" className="w-full" onClick={() => setKidModal({
            name: "", group_name: settings.groups[0] || "U8-10", parent_name: "",
            parent_phone: "", parent_email: "", pass_sessions_left: 0, is_active: true, note: "",
          })}>
            <span className="inline-flex items-center gap-1.5"><Plus size={15} /> Új gyerek</span>
          </Btn>
        )}

        <div className="space-y-2">
          {kids.length === 0 && <Card><Empty>Még nincs felvéve gyerek.</Empty></Card>}
          {kids.map((k) => (
            <div key={k.id} className="rounded-2xl px-3 py-3"
              style={{ background: C.card, border: `1px solid ${C.border}`, opacity: k.is_active === false ? 0.5 : 1 }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: C.card2, color: C.lime }}>
                  {initials(k.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{k.name}</div>
                  <div className="text-[11px]" style={{ color: C.muted }}>
                    {k.group_name}{k.is_active === false ? " · inaktív" : ""}
                  </div>
                </div>
                {isCoach && (
                  <>
                    <button onClick={() => setPassModal(k)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1"
                      style={{ background: C.card2, color: (k.pass_sessions_left || 0) > 0 ? C.cyan : C.muted }}>
                      <Ticket size={12} /> {k.pass_sessions_left || 0}
                    </button>
                    <button onClick={() => setKidModal({ ...k })} style={{ color: C.muted }} className="p-1.5">
                      <Pencil size={15} />
                    </button>
                  </>
                )}
              </div>
              {isCoach && (k.parent_name || k.parent_phone || k.parent_email) && (
                <div className="mt-2.5 pt-2.5 text-[12px] space-y-1" style={{ borderTop: `1px solid ${C.border}`, color: C.muted }}>
                  {k.parent_name && <div>Szülő: <span style={{ color: C.text }}>{k.parent_name}</span></div>}
                  {k.parent_phone && (
                    <a href={`tel:${k.parent_phone}`} className="inline-flex items-center gap-1.5" style={{ color: C.cyan }}>
                      <Phone size={12} /> {k.parent_phone}
                    </a>
                  )}
                  {k.parent_email && (
                    <div><a href={`mailto:${k.parent_email}`} className="inline-flex items-center gap-1.5" style={{ color: C.cyan }}>
                      <Mail size={12} /> {k.parent_email}
                    </a></div>
                  )}
                  {k.note && <div className="italic">{k.note}</div>}
                </div>
              )}
            </div>
          ))}
        </div>

        {!isCoach && (
          <p className="text-[11px] text-center" style={{ color: C.muted }}>
            A szülők elérhetősége és a bérletek állása csak az edzők belépése után látszik.
          </p>
        )}
      </>
    );
  }

  /* ---------- 4. INFO ---------- */
  function renderInfo() {
    const tiers = [...(pricing.tiers || [])].sort((a, b) => b.min - a.min);
    return (
      <>
        {isCoach && (
          <div className="flex gap-2">
            <Btn tone={infoEdit ? "primary" : "ghost"} className="flex-1" onClick={() => setInfoEdit((v) => !v)}>
              {infoEdit ? "Szerkesztés kész" : "Szövegek szerkesztése"}
            </Btn>
            <Btn tone={priceEdit ? "primary" : "ghost"} className="flex-1" onClick={() => setPriceEdit((v) => !v)}>
              {priceEdit ? "Árak kész" : "Árak szerkesztése"}
            </Btn>
          </div>
        )}

        {infoEdit && isCoach ? (
          <InfoForm info={info} onSave={async (v) => { await saveSetting("info", v); setInfoEdit(false); }} />
        ) : (
          <>
            <Card>
              <div className="flex items-center gap-2 mb-2">
                <MapPin size={16} style={{ color: C.lime }} />
                <div className="font-bold text-sm">{info.location_title || "Helyszín"}</div>
              </div>
              <div className="text-sm whitespace-pre-line" style={{ color: C.muted }}>{info.location}</div>
              {info.map_url && (
                <a href={info.map_url} target="_blank" rel="noreferrer"
                  className="inline-block mt-3 text-xs font-bold px-3 py-2 rounded-xl"
                  style={{ background: C.card2, color: C.cyan }}>
                  Megnyitás térképen
                </a>
              )}
            </Card>

            <Card>
              <div className="flex items-center gap-2 mb-2">
                <Clock size={16} style={{ color: C.lime }} />
                <div className="font-bold text-sm">Időpont</div>
              </div>
              <div className="text-sm whitespace-pre-line" style={{ color: C.muted }}>{info.schedule}</div>
            </Card>

            <Card>
              <div className="flex items-center gap-2 mb-2">
                <Users size={16} style={{ color: C.lime }} />
                <div className="font-bold text-sm">Edzők elérhetősége</div>
              </div>
              <div className="text-sm whitespace-pre-line" style={{ color: C.muted }}>{info.coaches}</div>
            </Card>

            <Card>
              <div className="flex items-center gap-2 mb-3">
                <Wallet size={16} style={{ color: C.lime }} />
                <div className="font-bold text-sm">Árak</div>
              </div>
              <div className="space-y-2">
                {tiers.map((t, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div style={{ color: C.muted }}>
                      {i === 0 ? `${t.min} fő vagy több` : `${t.min} fő`}
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{fmtHUF(t.drop_in)}</div>
                      <div className="text-[11px]" style={{ color: C.cyan }}>
                        bérlettel: 1 alkalom{t.pass_extra > 0 ? ` + ${fmtHUF(t.pass_extra)}` : ""}
                      </div>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between text-sm pt-2" style={{ borderTop: `1px solid ${C.border}` }}>
                  <div style={{ color: C.muted }}>{pricing.min_headcount - 1} fő vagy kevesebb</div>
                  <div className="font-bold" style={{ color: C.red }}>az óra elmarad</div>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center gap-2 mb-2">
                <Ticket size={16} style={{ color: C.lime }} />
                <div className="font-bold text-sm">Bérlet</div>
              </div>
              <div className="text-sm whitespace-pre-line" style={{ color: C.muted }}>{info.pass_info}</div>
            </Card>

            <Card style={{ borderColor: `${C.lime}33` }}>
              <div className="font-bold text-sm mb-3">Utalási adatok</div>
              <div className="text-xs" style={{ color: C.muted }}>Kedvezményezett</div>
              <div className="text-sm font-semibold mb-3">{info.transfer_name}</div>
              <div className="text-xs" style={{ color: C.muted }}>Számlaszám</div>
              <div className="flex items-center gap-2 mt-1">
                <div className="text-sm font-mono flex-1">{info.transfer_account}</div>
                <button
                  onClick={() => { navigator.clipboard?.writeText(info.transfer_account); }}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1"
                  style={{ background: C.card2, color: C.lime }}
                >
                  <Copy size={12} /> Másol
                </button>
              </div>
              <p className="text-[11px] mt-3" style={{ color: C.muted }}>
                A közlemény rovatba írd be a gyerek nevét, hogy be tudjuk azonosítani.
              </p>
            </Card>

            <Card>
              <div className="font-bold text-sm mb-2">Tedd ki alkalmazásként a telefonod kezdőképernyőjére</div>
              <div className="text-sm" style={{ color: C.muted }}>
                <b style={{ color: C.text }}>iPhone:</b> nyisd meg Safariban, alul a megosztás ikon,
                majd „Főképernyőhöz adás”.<br />
                <b style={{ color: C.text }}>Android:</b> nyisd meg Chrome-ban, jobbra fent a három pont,
                majd „Alkalmazás telepítése”.<br />
                Utána külön ikonról indul, mint egy rendes app.
              </div>
            </Card>

            {info.extra && (
              <Card>
                <div className="font-bold text-sm mb-2">Egyéb tudnivalók</div>
                <div className="text-sm whitespace-pre-line" style={{ color: C.muted }}>{info.extra}</div>
              </Card>
            )}
          </>
        )}

        {priceEdit && isCoach && (
          <PriceForm pricing={pricing} onSave={async (v) => { await saveSetting("pricing", v); setPriceEdit(false); }} />
        )}

        {isCoach && (
          <>
            <Card>
              <button onClick={() => setShowTrash((v) => !v)} className="w-full flex items-center gap-2 text-left">
                <Trash2 size={16} style={{ color: C.amber }} />
                <div className="font-bold text-sm flex-1">
                  Lomtár ({trashKids.length + trashLessons.length})
                </div>
                {showTrash ? <ChevronDown size={16} style={{ color: C.muted }} /> : <ChevronRight size={16} style={{ color: C.muted }} />}
              </button>
              {showTrash && (
                <div className="mt-3 pt-3 space-y-2" style={{ borderTop: `1px solid ${C.border}` }}>
                  {trashKids.length + trashLessons.length === 0 && (
                    <div className="text-xs" style={{ color: C.muted }}>A lomtár üres.</div>
                  )}
                  {trashKids.map((k) => (
                    <div key={k.id} className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: C.card2 }}>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{k.name}</div>
                        <div className="text-[11px]" style={{ color: C.muted }}>gyerek · törölve: {new Date(k.deleted_at).toLocaleDateString("hu-HU")}</div>
                      </div>
                      <Btn size="sm" tone="cyan" onClick={() => restoreKid(k)}>Vissza</Btn>
                      <Btn size="sm" tone="danger" onClick={() => {
                        if (confirm(`${k.name} VÉGLEG törlődik, a jelentkezéseivel és fizetéseivel együtt. Ez nem vonható vissza.`)) purgeKid(k);
                      }}><Trash2 size={13} /></Btn>
                    </div>
                  ))}
                  {trashLessons.map((l) => (
                    <div key={l.id} className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: C.card2 }}>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{fmtDateShort(l.date)}</div>
                        <div className="text-[11px]" style={{ color: C.muted }}>alkalom · törölve: {new Date(l.deleted_at).toLocaleDateString("hu-HU")}</div>
                      </div>
                      <Btn size="sm" tone="cyan" onClick={() => restoreLesson(l)}>Vissza</Btn>
                      <Btn size="sm" tone="danger" onClick={() => {
                        if (confirm(`Ez az alkalom VÉGLEG törlődik a jelentkezésekkel és fizetésekkel együtt. Ez nem vonható vissza.`)) purgeLesson(l);
                      }}><Trash2 size={13} /></Btn>
                    </div>
                  ))}
                  <p className="text-[11px] pt-1" style={{ color: C.muted }}>
                    A törölt gyerekek és alkalmak ide kerülnek, az adataik (jelentkezések,
                    fizetések) megmaradnak. Visszaállításkor minden visszajön.
                  </p>
                </div>
              )}
            </Card>

            <Card>
              <button onClick={() => setShowLog((v) => !v)} className="w-full flex items-center gap-2 text-left">
                <Clock size={16} style={{ color: C.cyan }} />
                <div className="font-bold text-sm flex-1">Napló ({log.length})</div>
                {showLog ? <ChevronDown size={16} style={{ color: C.muted }} /> : <ChevronRight size={16} style={{ color: C.muted }} />}
              </button>
              {showLog && (
                <div className="mt-3 pt-3 space-y-1.5" style={{ borderTop: `1px solid ${C.border}` }}>
                  {log.length === 0 && <div className="text-xs" style={{ color: C.muted }}>Még nincs bejegyzés.</div>}
                  {log.map((e) => (
                    <div key={e.id} className="text-[12px] flex gap-2 py-1" style={{ borderBottom: `1px solid ${C.border}` }}>
                      <div className="shrink-0 font-mono text-[10px] pt-0.5" style={{ color: C.muted }}>
                        {new Date(e.at).toLocaleString("hu-HU", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div style={{ color: C.text }}>{LOG_LABELS[e.action] || e.action}</div>
                        {e.label && <div style={{ color: C.muted }}>{e.label}</div>}
                      </div>
                      <div className="shrink-0 text-[10px] pt-0.5" style={{ color: C.cyan }}>{e.actor}</div>
                    </div>
                  ))}
                  <p className="text-[11px] pt-2" style={{ color: C.muted }}>
                    Minden változás ide kerül: ki mit módosított és mikor. A napló csak
                    bejelentkezve olvasható, a szülők nem látják.
                  </p>
                </div>
              )}
            </Card>
          </>
        )}
      </>
    );
  }

  /* ---------- 5. PENZUGY (csak edzonek) ---------- */
  function renderMoney() {
    const lesson = selectedLesson;

    // Osszesito gyerekenkent. Nem csak a mar rogzitett fizeteseket nezi:
    // minden lezart alkalmat vegigszamol, amelyen a gyerek ott volt, igy
    // az is tartozasnak szamit, amihez meg hozza sem nyultunk.
    const summary = kids.map((k) => {
      let owed = 0, paid = 0;
      lessons.forEach((l) => {
        if (attIndex[`${l.id}|${k.id}`] !== "yes") return;
        if (l.status === "cancelled") return;
        if (!isClosed(l, now)) return;                 // a jovobeli orak meg nem tartozasok
        const t = tierFor(headcountOf(l.id), pricing);
        if (!t) return;                                // elmaradt ora: nincs dij
        const p = payIndex[`${l.id}|${k.id}`];
        const amount = p
          ? (p.amount || 0)
          : ((k.pass_sessions_left || 0) > 0 ? t.pass_extra : t.drop_in);
        if (p?.paid) paid += amount; else owed += amount;
      });
      return { kid: k, owed, paid };
    });
    const totalOwed = summary.reduce((s, r) => s + r.owed, 0);

    const attendingKids = lesson
      ? kids.filter((k) => attIndex[`${lesson.id}|${k.id}`] === "yes")
      : [];
    const tier = lesson ? tierFor(headcountOf(lesson.id), pricing) : null;

    return (
      <>
        <Card style={{ borderColor: totalOwed > 0 ? `${C.amber}55` : `${C.lime}33` }}>
          <div className="text-xs font-semibold" style={{ color: C.muted }}>NYITOTT TARTOZÁS ÖSSZESEN</div>
          <div className="text-3xl font-extrabold mt-1" style={{ color: totalOwed > 0 ? C.amber : C.lime }}>
            {fmtHUF(totalOwed)}
          </div>
        </Card>

        {/* --- egy alkalom elszamolasa --- */}
        <Card>
          <div className="font-bold text-sm mb-1">Alkalom elszámolása</div>
          <select
            value={lesson?.id || ""}
            onChange={(e) => setSelectedLessonId(e.target.value)}
            className="mb-3"
          >
            {[...upcoming, ...past].map((l) => (
              <option key={l.id} value={l.id}>
                {fmtDateShort(l.date)} — {headcountOf(l.id)} fő
              </option>
            ))}
          </select>

          {!lesson ? <Empty>Nincs alkalom.</Empty> : !tier ? (
            <Empty>
              Ezen az alkalmon {headcountOf(lesson.id)} fő volt, ennyinél az óra elmarad —
              nincs mit elszámolni.
            </Empty>
          ) : attendingKids.length === 0 ? (
            <Empty>Erre az alkalomra még senki nem jelentkezett.</Empty>
          ) : (
            <div className="space-y-2">
              {attendingKids.map((k) => {
                const p = payIndex[`${lesson.id}|${k.id}`];
                const due = dueFor(lesson, k);
                const method = p?.method || (due.byPass ? "pass" : "cash");
                const amount = p ? p.amount : due.amount;
                const paid = !!p?.paid;
                return (
                  <div key={k.id} className="rounded-xl p-3" style={{ background: C.card2, border: `1px solid ${paid ? C.lime + "44" : C.border}` }}>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">{k.name}</div>
                        <div className="text-[11px]" style={{ color: C.muted }}>
                          bérlet egyenleg: {k.pass_sessions_left || 0} alkalom
                        </div>
                      </div>
                      <div className="text-base font-extrabold" style={{ color: paid ? C.lime : C.text }}>
                        {fmtHUF(amount)}
                      </div>
                      <button
                        onClick={() => setPayment(lesson, k, { paid: !paid, method })}
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: paid ? C.lime : "transparent", color: paid ? "#0A0A0A" : C.muted, border: `1px solid ${paid ? C.lime : C.border}` }}
                      >
                        <Check size={17} />
                      </button>
                    </div>
                    <div className="flex gap-1.5 mt-2.5">
                      {[
                        { id: "cash", label: "Készpénz" },
                        { id: "transfer", label: "Utalás" },
                        { id: "pass", label: "Bérletből" },
                      ].map((m) => (
                        <button
                          key={m.id}
                          onClick={() => setPayment(lesson, k, { method: m.id })}
                          className="flex-1 py-1.5 rounded-lg text-[11px] font-bold"
                          style={{
                            background: method === m.id ? C.card : "transparent",
                            color: method === m.id ? (m.id === "pass" ? C.cyan : C.lime) : C.muted,
                            border: `1px solid ${method === m.id ? (m.id === "pass" ? C.cyan + "66" : C.lime + "66") : C.border}`,
                          }}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                    {method === "pass" && (
                      <div className="text-[11px] mt-2" style={{ color: C.cyan }}>
                        Kipipálva 1 alkalom lejön a bérletből
                        {tier.pass_extra > 0 ? `, és ${fmtHUF(tier.pass_extra)} felárat fizet.` : "."}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* --- gyerekenkenti osszesito --- */}
        <Card>
          <div className="font-bold text-sm mb-3">Egyenlegek gyerekenként</div>
          <div className="space-y-1.5">
            {summary.filter((r) => r.owed > 0 || r.paid > 0).length === 0 && (
              <Empty>Még nincs rögzített fizetés.</Empty>
            )}
            {summary
              .filter((r) => r.owed > 0 || r.paid > 0)
              .sort((a, b) => b.owed - a.owed)
              .map((r) => (
                <div key={r.kid.id} className="flex items-center gap-2 text-sm py-1.5"
                  style={{ borderBottom: `1px solid ${C.border}` }}>
                  <div className="flex-1 truncate">{r.kid.name}</div>
                  <div className="text-[11px]" style={{ color: C.muted }}>befizetve {fmtHUF(r.paid)}</div>
                  <div className="font-bold w-24 text-right" style={{ color: r.owed > 0 ? C.amber : C.lime }}>
                    {r.owed > 0 ? fmtHUF(r.owed) : "rendben"}
                  </div>
                </div>
              ))}
          </div>
        </Card>

        <p className="text-[11px] text-center pb-2" style={{ color: C.muted }}>
          Ezt az oldalt csak bejelentkezve lehet megnyitni. A szülők böngészőjéből a fizetési
          adatok nem tölthetők le.
        </p>
      </>
    );
  }
}

/* ============================================================
   Urlapok
   ============================================================ */
function KidForm({ draft, groups, onClose, onSave, onDelete }) {
  const [d, setD] = useState(draft);
  const set = (k, v) => setD((p) => ({ ...p, [k]: v }));
  return (
    <Modal title={draft.id ? "Gyerek szerkesztése" : "Új gyerek"} onClose={onClose}>
      <div className="space-y-3">
        <div><Label>Gyerek neve</Label><input value={d.name || ""} onChange={(e) => set("name", e.target.value)} autoFocus /></div>
        <div>
          <Label>Csoport</Label>
          <select value={d.group_name || "U8-10"} onChange={(e) => set("group_name", e.target.value)}>
            {(groups || ["U8-10"]).map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div><Label>Szülő neve</Label><input value={d.parent_name || ""} onChange={(e) => set("parent_name", e.target.value)} /></div>
        <div><Label>Szülő telefonszáma</Label><input value={d.parent_phone || ""} onChange={(e) => set("parent_phone", e.target.value)} placeholder="+36 30 123 4567" /></div>
        <div><Label>Szülő e-mail címe</Label><input value={d.parent_email || ""} onChange={(e) => set("parent_email", e.target.value)} /></div>
        <div><Label>Bérlet egyenleg (alkalom)</Label><input type="number" value={d.pass_sessions_left ?? 0} onChange={(e) => set("pass_sessions_left", e.target.value)} /></div>
        <div><Label>Megjegyzés</Label><textarea rows={2} value={d.note || ""} onChange={(e) => set("note", e.target.value)} /></div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="w-4 h-4" style={{ width: 16, height: 16 }}
            checked={d.is_active !== false} onChange={(e) => set("is_active", e.target.checked)} />
          Aktív (szerepel a jelentkezési listán)
        </label>
      </div>
      <div className="flex gap-2 mt-5">
        <Btn tone="primary" className="flex-1" disabled={!d.name?.trim()} onClick={() => onSave(d)}>
          <span className="inline-flex items-center gap-1.5"><Save size={15} /> Mentés</span>
        </Btn>
        {onDelete && <Btn tone="danger" onClick={onDelete}><Trash2 size={15} /></Btn>}
      </div>
    </Modal>
  );
}

function LessonForm({ draft, groups, onClose, onSave, onSeries, onDelete }) {
  const [d, setD] = useState(draft);
  const [weeks, setWeeks] = useState(8);
  const [series, setSeries] = useState(false);
  const set = (k, v) => setD((p) => ({ ...p, [k]: v }));
  return (
    <Modal title={draft.id ? "Alkalom szerkesztése" : "Új alkalom"} onClose={onClose}>
      <div className="space-y-3">
        <div><Label>Dátum</Label><input type="date" value={d.date || ""} onChange={(e) => set("date", e.target.value)} /></div>
        <div className="flex gap-2">
          <div className="flex-1"><Label>Kezdés</Label><input type="time" value={d.start_time || ""} onChange={(e) => set("start_time", e.target.value)} /></div>
          <div className="flex-1"><Label>Vége</Label><input type="time" value={d.end_time || ""} onChange={(e) => set("end_time", e.target.value)} /></div>
        </div>
        <div><Label>Helyszín</Label><input value={d.location || ""} onChange={(e) => set("location", e.target.value)} /></div>
        <div>
          <Label>Öltöző</Label>
          <select value={d.locker_room || ""} onChange={(e) => set("locker_room", e.target.value)}>
            <option value="">Nincs megadva</option>
            <option value="3">3-as öltöző</option>
            <option value="4">4-es öltöző</option>
          </select>
        </div>
        <div>
          <Label>Csoport</Label>
          <select value={d.group_name || "U8-10"} onChange={(e) => set("group_name", e.target.value)}>
            {(groups || ["U8-10"]).map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div><Label>Megjegyzés (a szülők is látják)</Label><textarea rows={2} value={d.note || ""} onChange={(e) => set("note", e.target.value)} /></div>
        {draft.id && (
          <div>
            <Label>Állapot</Label>
            <select value={d.status || "open"} onChange={(e) => set("status", e.target.value)}>
              <option value="open">Megtartjuk</option>
              <option value="cancelled">Elmarad</option>
            </select>
          </div>
        )}
        {!draft.id && (
          <div className="rounded-xl p-3" style={{ background: C.card2, border: `1px solid ${C.border}` }}>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={series} style={{ width: 16, height: 16 }}
                onChange={(e) => setSeries(e.target.checked)} />
              Több hétre előre, hetente
            </label>
            {series && (
              <div className="mt-2">
                <Label>Hány hétre?</Label>
                <input type="number" min={2} max={30} value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} />
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex gap-2 mt-5">
        <Btn tone="primary" className="flex-1" disabled={!d.date}
          onClick={() => (series && !draft.id ? onSeries(d, weeks) : onSave(d))}>
          <span className="inline-flex items-center gap-1.5">
            <Save size={15} /> {series && !draft.id ? `${weeks} alkalom létrehozása` : "Mentés"}
          </span>
        </Btn>
        {onDelete && <Btn tone="danger" onClick={onDelete}><Trash2 size={15} /></Btn>}
      </div>
    </Modal>
  );
}

function InfoForm({ info, onSave }) {
  const [d, setD] = useState(info);
  const set = (k, v) => setD((p) => ({ ...p, [k]: v }));
  return (
    <Card>
      <div className="space-y-3">
        <div><Label>Helyszín címe (fejléc)</Label><input value={d.location_title || ""} onChange={(e) => set("location_title", e.target.value)} /></div>
        <div><Label>Helyszín</Label><textarea rows={3} value={d.location || ""} onChange={(e) => set("location", e.target.value)} /></div>
        <div><Label>Google Maps link</Label><input value={d.map_url || ""} onChange={(e) => set("map_url", e.target.value)} placeholder="https://maps.app.goo.gl/..." /></div>
        <div><Label>Időpont</Label><textarea rows={2} value={d.schedule || ""} onChange={(e) => set("schedule", e.target.value)} /></div>
        <div><Label>Edzők elérhetősége</Label><textarea rows={4} value={d.coaches || ""} onChange={(e) => set("coaches", e.target.value)} /></div>
        <div><Label>Bérlet részletei</Label><textarea rows={5} value={d.pass_info || ""} onChange={(e) => set("pass_info", e.target.value)} /></div>
        <div><Label>Kedvezményezett neve</Label><input value={d.transfer_name || ""} onChange={(e) => set("transfer_name", e.target.value)} /></div>
        <div><Label>Számlaszám</Label><input value={d.transfer_account || ""} onChange={(e) => set("transfer_account", e.target.value)} /></div>
        <div><Label>Egyéb tudnivalók</Label><textarea rows={4} value={d.extra || ""} onChange={(e) => set("extra", e.target.value)} /></div>
      </div>
      <Btn tone="primary" className="w-full mt-4" onClick={() => onSave(d)}>
        <span className="inline-flex items-center gap-1.5"><Save size={15} /> Szövegek mentése</span>
      </Btn>
    </Card>
  );
}

function PriceForm({ pricing, onSave }) {
  const [d, setD] = useState(JSON.parse(JSON.stringify(pricing)));
  const setTier = (i, k, v) =>
    setD((p) => {
      const tiers = [...p.tiers];
      tiers[i] = { ...tiers[i], [k]: Number(v) || 0 };
      return { ...p, tiers };
    });
  const sorted = [...d.tiers].sort((a, b) => b.min - a.min);
  return (
    <Card>
      <div className="font-bold text-sm mb-3">Árak</div>
      <div className="space-y-4">
        {sorted.map((t) => {
          const i = d.tiers.indexOf(t);
          return (
            <div key={i} className="rounded-xl p-3" style={{ background: C.card2 }}>
              <div className="flex gap-2">
                <div className="w-20"><Label>Fő</Label><input type="number" value={t.min} onChange={(e) => setTier(i, "min", e.target.value)} /></div>
                <div className="flex-1"><Label>Alkalmi díj</Label><input type="number" value={t.drop_in} onChange={(e) => setTier(i, "drop_in", e.target.value)} /></div>
                <div className="flex-1"><Label>Bérlet felár</Label><input type="number" value={t.pass_extra} onChange={(e) => setTier(i, "pass_extra", e.target.value)} /></div>
              </div>
            </div>
          );
        })}
        <div>
          <Label>Ennyi fő alatt elmarad az óra (legkisebb létszám)</Label>
          <input type="number" value={d.min_headcount} onChange={(e) => setD((p) => ({ ...p, min_headcount: Number(e.target.value) || 0 }))} />
        </div>
      </div>
      <Btn tone="primary" className="w-full mt-4" onClick={() => onSave(d)}>
        <span className="inline-flex items-center gap-1.5"><Save size={15} /> Árak mentése</span>
      </Btn>
    </Card>
  );
}
