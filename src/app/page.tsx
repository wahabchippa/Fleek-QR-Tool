"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";

async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers || {});
  if (typeof window !== "undefined") {
    const token = window.sessionStorage.getItem("auth_token");
    if (token) headers.set("x-auth-token", token);
  }
  return window.fetch(input, { ...init, headers });
}

/* ═══════════════════════════════════════════════════════════════
   FLEEKTRACK - WAREHOUSE MANAGEMENT SYSTEM
   Premium Dark Theme with 3D Animations
   ═══════════════════════════════════════════════════════════════ */

// ─── Types ───
interface User { id: number; email: string; name: string; role: string; }
interface SearchResult { id: number; fleekId: string; latestStatus: string | null; latestStatusDate: string | null; totalOrderLineAmount: string | null; customerCountry: string | null; vendor: string | null; customerName: string | null; quantitySold: string | null; category: string | null; receivedStatus: string | null; receivedDate: string | null; receivedBoxCount: string | null; receivedBy: string | null; }
interface QrResult { fleekId: string; success: boolean; qrImageData?: string; error?: string; }
interface SavedQrCode { id: number; fleekId: string; fleekIdNormalized: string; qrImageData: string; createdAt: string; }
interface UserRow { id: number; email: string; name: string; role: string; isActive: boolean; plainPassword: string | null; createdAt: string; }
interface ScanLog { id: number; userId: number; userName: string; userEmail: string; fleekId: string; fleekIdNormalized: string; boxCount: string | null; status: string; scannedAt: string; notes?: string | null; boxDetails?: string | null; photoUrl?: string | null; }
interface Toast { id: number; message: string; type: "success" | "error" | "info"; }
interface BoxDetail { weight: string; height: string; width: string; length: string; }

interface PermUser { id: number; email: string; name: string; role: string; isActive: boolean; permissions: Record<string, boolean>; permUpdatedBy: string | null; permUpdatedAt: string | null; isDefault: boolean; }

// ═══ Single Calendar Date Range Picker — Portal-based popup ═══
function DateRangePicker({ from, to, onFromChange, onToChange, label }: {
  from: string; to: string;
  onFromChange: (v: string) => void; onToChange: (v: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = from ? new Date(from) : new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [picking, setPicking] = useState<"from" | "to">("from");
  const btnRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [popupPos, setPopupPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  // Track mount for portal
  useEffect(() => { setMounted(true); }, []);

  const isLight = mounted && document.documentElement.classList.contains("light-mode");

  // Position popup below button using fixed coords (viewport-relative)
  useEffect(() => {
    if (open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      let left = rect.left;
      let top = rect.bottom + 6;
      // Keep within viewport
      if (left + 280 > window.innerWidth) left = window.innerWidth - 290;
      if (left < 5) left = 5;
      // If popup would go below viewport, show above button
      if (top + 380 > window.innerHeight) top = rect.top - 380;
      if (top < 5) top = 5;
      setPopupPos({ top, left });
    }
  }, [open]);

  // Close on outside click only
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target)) return;
      if (popupRef.current?.contains(target)) return;
      setOpen(false);
    };
    // Use setTimeout so the opening click doesn't immediately close it
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handler);
    }, 10);
    return () => { clearTimeout(timer); document.removeEventListener("mousedown", handler); };
  }, [open]);

  const daysInMonth = new Date(viewMonth.year, viewMonth.month + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewMonth.year, viewMonth.month, 1).getDay();
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  const pad = (n: number) => String(n).padStart(2, "0");
  const toStr = (d: number) => `${viewMonth.year}-${pad(viewMonth.month + 1)}-${pad(d)}`;
  const fmtShort = (s: string) => { if (!s) return "—"; try { return new Date(s + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short" }); } catch { return s; } };
  const fmtLabel = (s: string) => { if (!s) return "Select"; try { return new Date(s + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); } catch { return s; } };

  const handleDayClick = (day: number) => {
    const dateStr = toStr(day);
    if (picking === "from") {
      onFromChange(dateStr);
      if (to && dateStr > to) onToChange(dateStr);
      setPicking("to");
    } else {
      if (dateStr < from) {
        onFromChange(dateStr);
        setPicking("to");
      } else {
        onToChange(dateStr);
        setPicking("from");
        setOpen(false);
      }
    }
  };

  const isInRange = (day: number) => { const d = toStr(day); return from && to && d >= from && d <= to; };
  const isFrom = (day: number) => toStr(day) === from;
  const isTo = (day: number) => toStr(day) === to;
  const isToday = (day: number) => toStr(day) === new Date().toISOString().slice(0, 10);

  const prevMonth = () => setViewMonth(p => p.month === 0 ? { year: p.year - 1, month: 11 } : { year: p.year, month: p.month - 1 });
  const nextMonth = () => setViewMonth(p => p.month === 11 ? { year: p.year + 1, month: 0 } : { year: p.year, month: p.month + 1 });
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const btnBg = isLight ? "bg-gray-50 border-gray-200 hover:border-indigo-400" : "bg-white/[0.03] border-white/10 hover:border-indigo-500/30";
  const popupBgCls = isLight ? "bg-white border-gray-200" : "bg-[#12121a] border-white/10";
  const navBtn = isLight ? "hover:bg-gray-100 text-gray-500" : "hover:bg-white/5 text-zinc-400";
  const monthTitle = isLight ? "text-gray-900" : "text-white";
  const dayHeader = isLight ? "text-gray-400" : "text-zinc-600";
  const dayNormal = isLight ? "text-gray-700 hover:bg-gray-100" : "text-zinc-400 hover:bg-white/5";
  const dayRange = isLight ? "bg-indigo-50 text-indigo-600" : "bg-indigo-500/15 text-indigo-300";
  const todayRing = isLight ? "ring-1 ring-indigo-400/50" : "ring-1 ring-indigo-500/40";
  const quickBtn = isLight ? "bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700" : "bg-white/[0.03] text-zinc-500 hover:bg-white/5 hover:text-zinc-300";
  const quickBorder = isLight ? "border-gray-100" : "border-white/5";
  const arrowColor = isLight ? "text-gray-400" : "text-zinc-600";
  const dayCount = isLight ? "text-gray-400" : "text-zinc-600";
  const labelColor = isLight ? "text-gray-500" : "text-zinc-400";
  const pickInactive = isLight ? "text-gray-400" : "text-zinc-500";

  const popup = open && mounted ? createPortal(
    <div
      ref={popupRef}
      className={`border rounded-xl p-3 w-[280px] animate-fade-in ${popupBgCls}`}
      style={{ position: "fixed", top: popupPos.top, left: popupPos.left, zIndex: 99999, boxShadow: isLight ? "0 10px 40px rgba(0,0,0,0.15)" : "0 20px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.06)" }}
    >
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={prevMonth} className={`w-7 h-7 flex items-center justify-center rounded-lg text-sm ${navBtn}`}>‹</button>
        <span className={`${monthTitle} text-xs font-semibold`}>{monthNames[viewMonth.month]} {viewMonth.year}</span>
        <button type="button" onClick={nextMonth} className={`w-7 h-7 flex items-center justify-center rounded-lg text-sm ${navBtn}`}>›</button>
      </div>
      <div className="flex gap-2 mb-2 text-[10px]">
        <span className={`flex-1 text-center py-1 rounded-md ${picking === "from" ? "bg-indigo-500/20 text-indigo-500 font-bold" : pickInactive}`}>From: {fmtLabel(from)}</span>
        <span className={`flex-1 text-center py-1 rounded-md ${picking === "to" ? "bg-emerald-500/20 text-emerald-500 font-bold" : pickInactive}`}>To: {fmtLabel(to)}</span>
      </div>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
          <div key={d} className={`${dayHeader} text-[9px] font-medium text-center py-0.5`}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day, i) => day === null ? (
          <div key={`e${i}`} />
        ) : (
          <button key={day} type="button" onClick={() => handleDayClick(day)}
            className={`w-full aspect-square flex items-center justify-center text-[11px] rounded-lg transition-all
              ${isFrom(day) ? "bg-indigo-500 text-white font-bold" : ""}
              ${isTo(day) && !isFrom(day) ? "bg-emerald-500 text-white font-bold" : ""}
              ${isInRange(day) && !isFrom(day) && !isTo(day) ? dayRange : ""}
              ${!isInRange(day) && !isFrom(day) && !isTo(day) ? dayNormal : ""}
              ${isToday(day) && !isFrom(day) && !isTo(day) && !isInRange(day) ? todayRing : ""}
            `}
          >{day}</button>
        ))}
      </div>
      <div className={`flex gap-1.5 mt-2 pt-2 border-t ${quickBorder}`}>
        {[
          { label: "Today", fn: () => { const t = new Date().toISOString().slice(0,10); onFromChange(t); onToChange(t); setOpen(false); }},
          { label: "7 days", fn: () => { const t = new Date(); const f = new Date(t); f.setDate(f.getDate()-6); onFromChange(f.toISOString().slice(0,10)); onToChange(t.toISOString().slice(0,10)); setOpen(false); }},
          { label: "30 days", fn: () => { const t = new Date(); const f = new Date(t); f.setDate(f.getDate()-29); onFromChange(f.toISOString().slice(0,10)); onToChange(t.toISOString().slice(0,10)); setOpen(false); }},
          { label: "Clear", fn: () => { onFromChange(""); onToChange(""); setPicking("from"); }},
        ].map(b => (
          <button key={b.label} type="button" onClick={b.fn} className={`flex-1 py-1 rounded-md text-[9px] font-medium transition-all ${quickBtn}`}>{b.label}</button>
        ))}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div>
      {label && <label className={`${labelColor} text-[11px] font-medium mb-1.5 block`}>{label}</label>}
      <button
        ref={btnRef}
        type="button"
        onClick={() => { setOpen(v => !v); setPicking("from"); }}
        className={`w-full flex items-center gap-2 border rounded-xl px-3 py-2 text-xs cursor-pointer transition-all ${btnBg}`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-500 shrink-0"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <span className={from ? "text-indigo-500 font-semibold" : pickInactive}>{fmtShort(from)}</span>
        <span className={arrowColor}>→</span>
        <span className={to ? "text-emerald-500 font-semibold" : pickInactive}>{fmtShort(to)}</span>
        {from && to && from !== to && <span className={`ml-auto ${dayCount} text-[10px]`}>{Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1}d</span>}
      </button>
      {popup}
    </div>
  );
}

// ═══ Custom Themed Select Dropdown — Portal-based, matches calendar theme ═══
function ThemedSelect({ value, onChange, options, label, className }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => { setMounted(true); }, []);
  const isLight = mounted && document.documentElement.classList.contains("light-mode");

  useEffect(() => {
    if (open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      let top = r.bottom + 4;
      const maxH = Math.min(options.length * 36 + 16, 280);
      if (top + maxH > window.innerHeight) top = r.top - maxH - 4;
      if (top < 4) top = 4;
      setPos({ top, left: r.left, width: r.width });
    }
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || popupRef.current?.contains(t)) return;
      setOpen(false);
    };
    const timer = setTimeout(() => document.addEventListener("mousedown", handler), 10);
    return () => { clearTimeout(timer); document.removeEventListener("mousedown", handler); };
  }, [open]);

  const selected = options.find(o => o.value === value);
  const bg = isLight ? "bg-gray-50 border-gray-200 hover:border-indigo-400" : "bg-white/[0.04] border-white/10 hover:border-indigo-500/40";
  const popBg = isLight ? "bg-white border-gray-200" : "bg-[#12121a] border-white/10";
  const itemHover = isLight ? "hover:bg-indigo-50" : "hover:bg-white/[0.06]";
  const itemActive = isLight ? "bg-indigo-50 text-indigo-600 font-semibold" : "bg-indigo-500/15 text-indigo-400 font-semibold";
  const textNormal = isLight ? "text-gray-700" : "text-zinc-300";
  const labelCls = isLight ? "text-gray-500" : "text-zinc-400";

  const popup = open && mounted ? createPortal(
    <div
      ref={popupRef}
      className={`border rounded-xl py-1.5 animate-fade-in ${popBg}`}
      style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, zIndex: 99999, boxShadow: isLight ? "0 10px 40px rgba(0,0,0,0.12)" : "0 20px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.06)", maxHeight: 280, overflowY: "auto" }}
    >
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          onClick={() => { onChange(o.value); setOpen(false); }}
          className={`w-full text-left px-3 py-2 text-xs transition-all flex items-center justify-between ${o.value === value ? itemActive : `${textNormal} ${itemHover}`}`}
        >
          <span>{o.label}</span>
          {o.value === value && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-indigo-400 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
        </button>
      ))}
    </div>,
    document.body
  ) : null;

  return (
    <div className={className}>
      {label && <label className={`${labelCls} text-[11px] font-medium mb-1 block`}>{label}</label>}
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center justify-between border rounded-xl px-3 py-2 text-xs cursor-pointer transition-all ${bg}`}
      >
        <span className={selected ? (isLight ? "text-gray-900" : "text-white") : (isLight ? "text-gray-400" : "text-zinc-500")}>{selected?.label || "Select..."}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`shrink-0 transition-transform ${open ? "rotate-180" : ""} ${isLight ? "text-gray-400" : "text-zinc-500"}`}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
      </button>
      {popup}
    </div>
  );
}

// Format date+time for display: "15 Jan 2025 · 2:30 PM"
function fmtDt(val: string | null | undefined): string {
  if (!val) return "—";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + " · " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  } catch { return val; }
}

// Tool-wise tab configurations
const TOOL_CONFIG = {
  fleek: {
    name: "🏢 Fleek Tool",
    desc: "Admin, Manager & Employee users",
    color: "indigo",
    roles: ["admin", "manager", "employee"],
    tabs: [
      "upload", "search", "qrcodes", "received", "gddetails", "extras", "activity", "backend", "users", "granted",
      // Granular action permissions
      "action_delete_orders", "action_delete_qr", "action_delete_scan", "action_delete_seller",
      "action_export_csv", "action_assign_3pl", "action_edit_scan",
      "action_add_users", "action_disable_users", "action_delete_users",
      "action_change_permissions", "action_approve_requests",
      "action_view_seller_tool", "action_view_3pl_tool",
    ],
    tabLabels: {
      upload: "📤 Upload CSV",
      search: "🔍 Search Orders",
      qrcodes: "📱 QR Codes",
      received: "✅ Received Logs",
      gddetails: "📦 GD Details",
      extras: "📋 Extra Items",
      activity: "📊 Activity Logs",
      backend: "🗄️ Database",
      users: "👥 User Mgmt",
      granted: "🔑 Permissions",
      // Granular labels
      action_delete_orders: "🗑️ Delete Orders",
      action_delete_qr: "🗑️ Delete QR Codes",
      action_delete_scan: "🗑️ Delete Scan Logs",
      action_delete_seller: "🗑️ Delete Seller Entries",
      action_export_csv: "📥 Export CSV",
      action_assign_3pl: "🔗 Assign 3PL",
      action_edit_scan: "✏️ Edit Scan Logs",
      action_add_users: "➕ Add Users",
      action_disable_users: "🚫 Enable/Disable Users",
      action_delete_users: "🗑️ Delete Users",
      action_change_permissions: "🔐 Change Permissions",
      action_approve_requests: "✅ Approve Requests",
      action_view_seller_tool: "👁️ View Seller Tool",
      action_view_3pl_tool: "👁️ View 3PL Tool",
    },
  },
  "3pl": {
    name: "🏭 3PL Tool",
    desc: "ECL & GE warehouse users",
    color: "emerald",
    roles: ["3pl_ecl", "3pl_ge"],
    tabs: ["scan", "history", "extras", "gd", "action_scan_receive", "action_report_extra", "action_view_gd"],
    tabLabels: {
      scan: "📷 Scan & Receive",
      history: "📜 Scan History",
      extras: "📋 Report Extra",
      gd: "📦 GD Orders",
      action_scan_receive: "✅ Scan & Mark Received",
      action_report_extra: "📋 Report Extra Items",
      action_view_gd: "👁️ View GD Pending",
    },
  },
  seller: {
    name: "🛍️ Seller Tool",
    desc: "Seller / vendor users",
    color: "pink",
    roles: ["seller"],
    tabs: ["entry", "details", "qrcodes", "history", "action_order_entry", "action_csv_upload", "action_view_qr", "action_delete_own"],
    tabLabels: {
      entry: "📝 Order Entry",
      details: "📋 My Submissions",
      qrcodes: "📱 QR Codes",
      history: "📜 Upload History",
      action_order_entry: "📝 Submit Orders",
      action_csv_upload: "📤 CSV Upload",
      action_view_qr: "📱 View/Print QR",
      action_delete_own: "🗑️ Delete Own Entries",
    },
  },
};

type ToolKey = keyof typeof TOOL_CONFIG;

function GrantedTab({ permUsers, permLoading, permSearch, setPermSearch, permToolFilter, setPermToolFilter, permSaving, loadPermUsers, updatePermission, toggleAllPermissions, resetPermissions, Spinner }: {
  permUsers: PermUser[];
  permLoading: boolean;
  permSearch: string;
  setPermSearch: (v: string) => void;
  permToolFilter: string;
  setPermToolFilter: (v: string) => void;
  permSaving: number | null;
  loadPermUsers: () => void;
  updatePermission: (userId: number, tabKey: string, enabled: boolean) => void;
  toggleAllPermissions: (userId: number, enable: boolean, tabs: string[]) => void;
  resetPermissions: (userId: number) => void;
  Spinner: React.ComponentType<{ size?: number }>;
}) {
  // Group users by tool
  const getUserTool = (role: string): ToolKey => {
    if (TOOL_CONFIG.fleek.roles.includes(role)) return "fleek";
    if (TOOL_CONFIG["3pl"].roles.includes(role)) return "3pl";
    if (TOOL_CONFIG.seller.roles.includes(role)) return "seller";
    return "fleek"; // default
  };

  const filteredPermUsers = permUsers.filter(u => {
    if (permToolFilter !== "all") {
      const userTool = getUserTool(u.role);
      if (userTool !== permToolFilter) return false;
    }
    if (permSearch && !u.name.toLowerCase().includes(permSearch.toLowerCase()) && !u.email.toLowerCase().includes(permSearch.toLowerCase())) return false;
    return true;
  });

  // Group by tool
  const groupedByTool: Record<ToolKey, PermUser[]> = { fleek: [], "3pl": [], seller: [] };
  filteredPermUsers.forEach(u => {
    const tool = getUserTool(u.role);
    groupedByTool[tool].push(u);
  });

  const toolKeys: ToolKey[] = permToolFilter === "all" ? ["fleek", "3pl", "seller"] : [permToolFilter as ToolKey];

  const renderUserCard = (u: PermUser, tool: ToolKey) => {
    const isAdminUser = u.role === "admin";
    const config = TOOL_CONFIG[tool];
    const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
      indigo: { bg: "bg-indigo-500/15", text: "text-indigo-400", border: "border-indigo-500/30" },
      emerald: { bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/30" },
      pink: { bg: "bg-pink-500/15", text: "text-pink-400", border: "border-pink-500/30" },
      amber: { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/30" },
      purple: { bg: "bg-purple-500/15", text: "text-purple-400", border: "border-purple-500/30" },
    };
    const roleColor = isAdminUser ? "amber" : u.role === "manager" ? "purple" : config.color;
    const rc = colorClasses[roleColor] || colorClasses.indigo;

    return (
      <div key={u.id} className={`card-static overflow-hidden transition-all ${!u.isActive ? "opacity-50" : ""}`}>
        {/* User Header */}
        <div className="px-4 py-3 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${rc.bg} ${rc.text}`}>
              {u.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-semibold truncate">{u.name}</p>
              <p className="text-zinc-500 text-[10px] font-mono truncate">{u.email}</p>
            </div>
            <span className={`badge text-[10px] shrink-0 ${rc.bg} ${rc.text}`}>
              {u.role === "3pl_ecl" ? "3PL ECL" : u.role === "3pl_ge" ? "3PL GE" : u.role.charAt(0).toUpperCase() + u.role.slice(1)}
            </span>
            {!u.isActive && <span className="badge badge-danger text-[10px]">Disabled</span>}
            {u.isDefault && <span className="text-zinc-600 text-[10px] italic">defaults</span>}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {!isAdminUser && (
              <>
                <button onClick={() => toggleAllPermissions(u.id, true, config.tabs)} className="btn-ghost px-2 py-1 rounded text-[10px] text-emerald-400 hover:text-emerald-300" title="Enable All">All ✓</button>
                <button onClick={() => toggleAllPermissions(u.id, false, config.tabs)} className="btn-ghost px-2 py-1 rounded text-[10px] text-red-400 hover:text-red-300" title="Disable All">All ✕</button>
                <button onClick={() => resetPermissions(u.id)} className="btn-ghost px-2 py-1 rounded text-[10px] text-amber-400 hover:text-amber-300" title="Reset to Default">↺ Reset</button>
              </>
            )}
            {permSaving === u.id && <Spinner size={14} />}
          </div>
        </div>

        {/* Permission Toggles — Tab Access + Action Permissions */}
        <div className="p-3 sm:p-4 space-y-3">
          {/* Tab Access */}
          <div>
            <p className="text-zinc-500 text-[10px] font-semibold uppercase tracking-wider mb-2">📑 Tab Access</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {config.tabs.filter(t => !t.startsWith("action_")).map(tabKey => {
              const enabled = u.permissions[tabKey] === true;
              return (
                <button
                  key={tabKey}
                  onClick={() => { if (!isAdminUser) updatePermission(u.id, tabKey, !enabled); }}
                  disabled={isAdminUser}
                  className={`relative flex items-center gap-2 px-3 py-2.5 rounded-lg text-[11px] font-medium transition-all border ${
                    isAdminUser
                      ? "bg-amber-500/5 border-amber-500/20 text-amber-400 cursor-not-allowed"
                      : enabled
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                      : "bg-white/[0.02] border-white/5 text-zinc-500 hover:border-white/10 hover:text-zinc-300"
                  }`}
                >
                  <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                    isAdminUser ? "border-amber-400 bg-amber-400" : enabled ? "border-emerald-400 bg-emerald-400" : "border-zinc-600 bg-transparent"
                  }`}>
                    {(enabled || isAdminUser) && (
                      <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    )}
                  </span>
                  <span className="truncate">{config.tabLabels[tabKey as keyof typeof config.tabLabels] || tabKey}</span>
                </button>
              );
            })}
            </div>
          </div>
          {/* Action Permissions */}
          {config.tabs.some(t => t.startsWith("action_")) && (
          <div>
            <p className="text-zinc-500 text-[10px] font-semibold uppercase tracking-wider mb-2">⚡ Action Permissions</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {config.tabs.filter(t => t.startsWith("action_")).map(tabKey => {
              const enabled = u.permissions[tabKey] === true;
              return (
                <button
                  key={tabKey}
                  onClick={() => { if (!isAdminUser) updatePermission(u.id, tabKey, !enabled); }}
                  disabled={isAdminUser}
                  className={`relative flex items-center gap-2 px-3 py-2.5 rounded-lg text-[11px] font-medium transition-all border ${
                    isAdminUser
                      ? "bg-amber-500/5 border-amber-500/20 text-amber-400 cursor-not-allowed"
                      : enabled
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                      : "bg-white/[0.02] border-white/5 text-zinc-500 hover:border-white/10 hover:text-zinc-300"
                  }`}
                >
                  <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                    isAdminUser
                      ? "border-amber-400 bg-amber-400"
                      : enabled
                      ? "border-emerald-400 bg-emerald-400"
                      : "border-zinc-600 bg-transparent"
                  }`}>
                    {(enabled || isAdminUser) && (
                      <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    )}
                  </span>
                  <span className="truncate">{config.tabLabels[tabKey as keyof typeof config.tabLabels] || tabKey}</span>
                </button>
              );
            })}
            </div>
          </div>
          )}
          {u.permUpdatedBy && (
            <p className="text-zinc-600 text-[10px] mt-2 text-right">
              Last updated by {u.permUpdatedBy} · {u.permUpdatedAt ? new Date(u.permUpdatedAt).toLocaleDateString() : ""}
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Header Card */}
      <div className="gradient-border p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-white font-bold text-base sm:text-lg flex items-center gap-2">🔑 Granted Permissions</h2>
            <p className="text-zinc-400 text-xs mt-1">Control which tabs each user can access — organized by tool type.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadPermUsers} disabled={permLoading} className="btn-ghost px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5">
              {permLoading ? <Spinner size={14} /> : <span>🔄</span>} Refresh
            </button>
            <div className="bg-indigo-500/10 border border-indigo-500/20 px-3 py-2 rounded-lg">
              <span className="text-indigo-400 text-xs font-semibold">{permUsers.length} Users</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card-static p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <div className="flex-1">
            <input
              type="text"
              value={permSearch}
              onChange={e => setPermSearch(e.target.value)}
              className="input-field w-full px-3 py-2 rounded-lg text-sm"
              placeholder="🔍 Search user name or email..."
            />
          </div>
          <ThemedSelect value={permToolFilter} onChange={setPermToolFilter} className="w-44" options={[{ value: "all", label: "📦 All Tools" }, { value: "fleek", label: "🏢 Fleek Tool" }, { value: "3pl", label: "🏭 3PL Tool" }, { value: "seller", label: "🛍️ Seller Tool" }]} />
        </div>
      </div>

      {/* Users grouped by Tool */}
      {permLoading ? (
        <div className="card-static p-10 text-center"><Spinner size={24} /><p className="text-zinc-500 text-sm mt-3">Loading permissions...</p></div>
      ) : filteredPermUsers.length === 0 ? (
        <div className="card-static p-10 text-center"><p className="text-zinc-500 text-sm">No users found</p></div>
      ) : (
        <div className="space-y-6">
          {toolKeys.map(tool => {
            const config = TOOL_CONFIG[tool];
            const usersForTool = groupedByTool[tool];
            if (usersForTool.length === 0) return null;
            const colorMap: Record<string, string> = {
              indigo: "border-indigo-500/30 bg-indigo-500/5",
              emerald: "border-emerald-500/30 bg-emerald-500/5",
              pink: "border-pink-500/30 bg-pink-500/5",
            };
            const textColorMap: Record<string, string> = {
              indigo: "text-indigo-400",
              emerald: "text-emerald-400",
              pink: "text-pink-400",
            };
            return (
              <div key={tool} className="space-y-3">
                {/* Tool Section Header */}
                <div className={`rounded-xl border p-3 sm:p-4 ${colorMap[config.color]}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className={`font-bold text-sm ${textColorMap[config.color]}`}>{config.name}</h3>
                      <p className="text-zinc-500 text-[11px] mt-0.5">{config.desc}</p>
                    </div>
                    <span className={`text-xs font-semibold ${textColorMap[config.color]}`}>{usersForTool.length} users</span>
                  </div>
                </div>
                {/* User Cards */}
                <div className="space-y-3 pl-0 sm:pl-2">
                  {usersForTool.map(u => renderUserCard(u, tool))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="card-static p-3 sm:p-4">
        <p className="text-zinc-500 text-[11px] font-medium mb-2">Legend:</p>
        <div className="flex flex-wrap gap-3 text-[10px]">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span> <span className="text-zinc-400">Enabled</span></span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full border-2 border-zinc-600"></span> <span className="text-zinc-400">Disabled</span></span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span> <span className="text-zinc-400">Admin (Always On)</span></span>
          <span className="flex items-center gap-1.5"><span className="text-zinc-600 italic">defaults</span> <span className="text-zinc-400">Role defaults</span></span>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Login state
  const [isFlipped, setIsFlipped] = useState(false);
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [loginSub, setLoginSub] = useState(false);
  
  // Request access state
  const [reqEmail, setReqEmail] = useState("");
  const [reqName, setReqName] = useState("");
  const [reqMsg, setReqMsg] = useState("");
  const [reqSent, setReqSent] = useState(false);
  
  // Theme state
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  
  // Tool switcher for admin/manager — "fleek" | "3pl" | "seller"
  const [viewAs, setViewAs] = useState<"fleek" | "3pl" | "seller">("fleek");
  
  const [tab, setTab] = useState("upload");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [upResult, setUpResult] = useState<{ added: number; skipped: number; totalRows: number } | null>(null);
  const [upErr, setUpErr] = useState("");
  const [fname, setFname] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [sErr, setSErr] = useState("");
  const [sel, setSel] = useState<Set<number>>(new Set());

  // Advanced search filters
  const [searchDateFrom, setSearchDateFrom] = useState("");
  const [searchDateTo, setSearchDateTo] = useState("");
  const [searchVendor, setSearchVendor] = useState("all");
  const [searchStatus, setSearchStatus] = useState("all");
  const [vendorList, setVendorList] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Notifications state
  interface Notification { id: number; type: string; title: string; message: string; icon: string; link: string | null; isRead: boolean; createdAt: string; }
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);

  // Bulk QR print
  const [qrSelections, setQrSelections] = useState<Set<number>>(new Set());
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  const [gening, setGening] = useState(false);
  const [qrRes, setQrRes] = useState<QrResult[]>([]);
  const [savedQr, setSavedQr] = useState<SavedQrCode[]>([]);
  const [loadQr, setLoadQr] = useState(false);

  const [totRec, setTotRec] = useState(0);
  const [totQr, setTotQr] = useState(0);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loadUsers, setLoadUsers] = useState(false);
  const [nu, setNu] = useState({ email: "", name: "", password: "", role: "employee" });
  const [adding, setAdding] = useState(false);
  const [chgPassId, setChgPassId] = useState<number | null>(null);
  const [chgPassVal, setChgPassVal] = useState("");
  const [chgOwnPass, setChgOwnPass] = useState(false);
  const [currPass, setCurrPass] = useState("");
  const [newPass, setNewPass] = useState("");

  const [scanId, setScanId] = useState("");
  const [scanBox, setScanBox] = useState("");
  const [scanNotes, setScanNotes] = useState("");
  const [scanPhoto, setScanPhoto] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  
  // 3PL tab
  const [plTab, setPlTab] = useState<"scan" | "history" | "extras" | "gd">("scan");
  
  // Extra items
  const [showExtraForm, setShowExtraForm] = useState(false);
  const [extraFleekId, setExtraFleekId] = useState("");
  const [extraDesc, setExtraDesc] = useState("");
  const [extraPhoto, setExtraPhoto] = useState<string | null>(null);
  const [extraSubmitting, setExtraSubmitting] = useState(false);
  const extraPhotoRef = useRef<HTMLInputElement>(null);
  const [extraItems2, setExtraItems2] = useState<{ id: number; fleekId: string | null; description: string; photoUrl: string | null; reportedByName: string; reportedByRole: string; status: string; adminNotes: string | null; reviewedBy: string | null; createdAt: string }[]>([]);
  const [activityData, setActivityData] = useState<{ id: number; userName: string; userRole: string; action: string; target: string; details: string | null; createdAt: string }[]>([]);
  const [activitySearch, setActivitySearch] = useState("");
  const [boxDetails, setBoxDetails] = useState<BoxDetail[]>([]);

  // Seller state
  const [sellerTab, setSellerTab] = useState<"upload" | "entry" | "details" | "qrcodes" | "history">("entry");
  const [sellerVendor, setSellerVendor] = useState("");
  const [sellerUploading, setSellerUploading] = useState(false);
  const [sellerResult, setSellerResult] = useState<{ totalOrders: number; totalBoxes: number; date: string; vendor: string } | null>(null);
  const [sellerQrCodes, setSellerQrCodes] = useState<{ fleekId: string; qrImageData: string }[]>([]);
  const [sellerQrSel, setSellerQrSel] = useState<Set<number>>(new Set());
  const [sellerHistory, setSellerHistory] = useState<{ id: number; vendor: string; uploadDate: string; totalOrders: number; totalBoxes: number; createdAt?: string }[]>([]);
  const [sellerDetails, setSellerDetails] = useState<{ id: number; fleekId: string; boxNo: string; pieces: string | null; weight: string | null; height?: string | null; length?: string | null; width?: string | null; dimensionalWeight?: string | null; createdAt?: string; uploadDate?: string; vendor?: string; sellerName?: string }[]>([]);
  const sellerFileRef = useRef<HTMLInputElement>(null);
  const [sellerSearch, setSellerSearch] = useState("");
  // Date filters for seller history, details & 3PL history
  const [sellerHistFrom, setSellerHistFrom] = useState("");
  const [sellerHistTo, setSellerHistTo] = useState("");
  const [sellerDetFrom, setSellerDetFrom] = useState("");
  const [sellerDetTo, setSellerDetTo] = useState("");
  const [plHistFrom, setPlHistFrom] = useState("");
  const [plHistTo, setPlHistTo] = useState("");
  // Admin seller view filters (when admin views seller tool)
  // Date range defaults - empty means "all time"
  const [adminSellerDateFrom, setAdminSellerDateFrom] = useState("");
  const [adminSellerDateTo, setAdminSellerDateTo] = useState("");
  const [adminSellerVendorFilter, setAdminSellerVendorFilter] = useState("all");
  const [adminSellerVendors, setAdminSellerVendors] = useState<string[]>([]);
  const [adminSellerDates, setAdminSellerDates] = useState<string[]>([]);
  // 3PL view filters (used by both admin and 3PL users)  
  const [admin3plDateFrom, setAdmin3plDateFrom] = useState("");
  const [admin3plDateTo, setAdmin3plDateTo] = useState("");
  const [admin3plFilter, setAdmin3plFilter] = useState("all");
  const [admin3plVendorFilter, setAdmin3plVendorFilter] = useState("all");
  const [admin3plVendors, setAdmin3plVendors] = useState<string[]>([]);
  const [admin3plList, setAdmin3plList] = useState<string[]>([]);
  // Order Entry state - multi-order per box support
  interface BoxOrder { oid: number; orderId: string; pieces: string; status: string | null; vendor: string | null; searching: boolean; }
  interface BoxEntry { id: number; isMulti: boolean; orders: BoxOrder[]; boxNo: string; weight: string; height: string; length: string; width: string; dimWeight: string; }
  const makeOrder = (oid: number): BoxOrder => ({ oid, orderId: "", pieces: "", status: null, vendor: null, searching: false });
  const makeBox = (id: number): BoxEntry => ({ id, isMulti: false, orders: [makeOrder(1)], boxNo: "", weight: "", height: "", length: "", width: "", dimWeight: "" });
  const [boxEntries, setBoxEntries] = useState<BoxEntry[]>([makeBox(1)]);
  const [entrySaving, setEntrySaving] = useState(false);
  const boxIdRef = useRef(1);
  const orderIdRef = useRef(1);


  // GD Details state (Fleek side)
  const [gdDate, setGdDate] = useState(new Date().toISOString().slice(0, 10));
  const [gdDateTo, setGdDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [gdVendor, setGdVendor] = useState("");
  const [gdVendors, setGdVendors] = useState<string[]>([]);
  const [gdFilterVendor, setGdFilterVendor] = useState("");
  const [gdFilter3pl, setGdFilter3pl] = useState("");
  const [gdDates, setGdDates] = useState<string[]>([]);
  const [gdSummaries, setGdSummaries] = useState<{ id: number; vendor: string; sellerName: string; uploadDate: string; totalOrders: number; totalBoxes: number; receivedBoxes: number; pendingBoxes: number; totalWeight: string; assigned3pl: string | null }[]>([]);
  const [gdDetails, setGdDetails] = useState<{ fleekId: string; boxNo: string; pieces: string | null; weight: string | null; height: string | null; length: string | null; width: string | null; dimensionalWeight: string | null; receivedStatus: string | null; createdAt?: string; uploadDate?: string }[]>([]);
  const [gdSummary, setGdSummary] = useState<{ totalOrders: number; totalBoxes: number; receivedBoxes: number; pendingBoxes: number } | null>(null);
  const [gdLoading, setGdLoading] = useState(false);

  // 3PL GD Orders state
  const [plOrders, setPlOrders] = useState<{ vendor: string; sellerName: string; totalBoxes: number; receivedBoxes: number; pendingBoxes: number; totalWeight: string; uniqueOrders: number; pendingOrders: number; assigned3pl?: string; uploadDate?: string }[]>([]);
  const [plTotals, setPlTotals] = useState<{ pendingBoxes: number; pendingOrders: number; receivedBoxes: number; totalVendors: number; totalWeight: string }>({ pendingBoxes: 0, pendingOrders: 0, receivedBoxes: 0, totalVendors: 0, totalWeight: "0.00" });
  const [plFilterDate, setPlFilterDate] = useState(new Date().toISOString().slice(0, 10));
  const [plFilter3pl, setPlFilter3pl] = useState("all");
  const [plFilterVendor, setPlFilterVendor] = useState("all");
  const [plFilterVendors, setPlFilterVendors] = useState<string[]>([]);
  const [plFilterDates, setPlFilterDates] = useState<string[]>([]);

  const [marking, setMarking] = useState(false);
  const [scannerOn, setScannerOn] = useState(false);
  const [scanDet, setScanDet] = useState<{ vendor: string | null; quantitySold: string | null; fleekId: string; customerName: string | null; customerCountry: string | null; category: string | null; totalOrderLineAmount: string | null; latestStatus: string | null } | null>(null);
  const [camError, setCamError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const scanLockRef = useRef(false);

  const [sLogs, setSLogs] = useState<ScanLog[]>([]);
  const [loadLogs, setLoadLogs] = useState(false);
  const [logSearch, setLogSearch] = useState("");

  const [bkData, setBkData] = useState<{ stats: { totalRecords: number; totalQrCodes: number; totalScans: number; totalUsers: number; totalReceived: number }; records: SearchResult[]; recentScans: ScanLog[] } | null>(null);
  const [loadBk, setLoadBk] = useState(false);

  const [toasts, setToasts] = useState<Toast[]>([]);

  // ─── Permissions state ───
  const [myPermissions, setMyPermissions] = useState<Record<string, boolean>>({});
  const [permUsers, setPermUsers] = useState<PermUser[]>([]);
  const [permLoading, setPermLoading] = useState(false);
  const [permSaving, setPermSaving] = useState<number | null>(null);
  const [permSearch, setPermSearch] = useState("");
  const [permToolFilter, setPermToolFilter] = useState("all");
  const tid = useRef(0);

  const groupedSellerDetails = useMemo(() => {
    const map = new Map<string, {
      id: number;
      fleekId: string;
      boxNo: string;
      pieces: string | null;
      weight: string | null;
      height?: string | null;
      length?: string | null;
      width?: string | null;
      dimensionalWeight?: string | null;
      createdAt?: string;
      uploadDate?: string;
      vendor?: string;
      sellerName?: string;
    }>();

    for (const row of sellerDetails) {
      // Only rows saved together in the exact same box batch should merge.
      // Single orders keep unique createdAt, multi-order box shares createdAt.
      const key = `${row.createdAt || row.id}__${row.boxNo}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          ...row,
          fleekId: row.fleekId,
          pieces: row.pieces || "",
        });
        continue;
      }

      const ids = existing.fleekId ? existing.fleekId.split(",").map((x) => x.trim()).filter(Boolean) : [];
      if (!ids.includes(row.fleekId)) ids.push(row.fleekId);

      const pcs = existing.pieces ? String(existing.pieces).split(",").map((x) => x.trim()) : [];
      pcs.push(row.pieces || "");

      map.set(key, {
        ...existing,
        fleekId: ids.join(", "),
        pieces: pcs.join(", "),
      });
    }

    return Array.from(map.values());
  }, [sellerDetails]);

  // ─── LOGIC FUNCTIONS ───
  const toast = useCallback((m: string, tp: Toast["type"] = "info") => {
    const id = ++tid.current;
    setToasts((p) => [...p, { id, message: m, type: tp }]);
    setTimeout(() => setToasts((p) => p.filter((x) => x.id !== id)), 4000);
  }, []);

  const stats = useCallback(async () => {
    try {
      const r = await authFetch("/api/stats");
      const d = await r.json();
      setTotRec(d.totalRecords);
      setTotQr(d.totalQrCodes);
    } catch {}
  }, []);

  // ─── Notifications Functions ───
  const loadNotifications = useCallback(async () => {
    try {
      const r = await authFetch("/api/notifications");
      if (r.ok) {
        const d = await r.json();
        setNotifs(d.notifications || []);
        setUnreadCount(d.unreadCount || 0);
      }
    } catch {}
  }, []);

  const markNotificationsRead = useCallback(async (ids?: number[]) => {
    try {
      await authFetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ids ? { notificationIds: ids } : { markAllRead: true }),
      });
      loadNotifications();
    } catch {}
  }, [loadNotifications]);

  // ─── Load vendor list for filters ───
  const loadVendorList = useCallback(async () => {
    try {
      const r = await authFetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "getVendors" }),
      });
      if (r.ok) {
        const d = await r.json();
        setVendorList(d.vendors || []);
      }
    } catch {}
  }, []);

  // ─── Bulk QR Print ───
  // Generic QR print — 2 columns × 5 rows = 10 per A4 page
  const printQRCodes = useCallback((qrList: { fleekId: string; qrImageData: string }[], title?: string) => {
    if (qrList.length === 0) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const totalPages = Math.ceil(qrList.length / 10);
    const html = `<!DOCTYPE html><html><head><title>${title || "QR Codes"} - Print</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; }
  .page { width: 210mm; min-height: 297mm; padding: 10mm 15mm; page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  .header { text-align: center; padding-bottom: 8px; margin-bottom: 10px; border-bottom: 2px solid #333; }
  .header h1 { font-size: 16px; margin-bottom: 2px; }
  .header p { font-size: 11px; color: #666; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; }
  .qr-item { border: 1.5px solid #ccc; border-radius: 8px; padding: 8px; text-align: center; display: flex; flex-direction: column; align-items: center; }
  .qr-item img { width: 42mm; height: 42mm; object-fit: contain; }
  .qr-item .label { font-size: 11px; font-family: 'Courier New', monospace; font-weight: bold; margin-top: 4px; word-break: break-all; line-height: 1.3; }
  .qr-item .time { font-size: 8px; color: #999; margin-top: 2px; }
  .page-info { text-align: center; font-size: 9px; color: #aaa; margin-top: 5mm; }
  .no-print { text-align: center; padding: 15px; background: #f5f5f5; margin-bottom: 10px; position: sticky; top: 0; z-index: 10; border-bottom: 1px solid #ddd; }
  .no-print button { padding: 10px 30px; font-size: 14px; cursor: pointer; border: none; border-radius: 8px; margin: 0 5px; }
  .no-print .btn-print { background: #4f46e5; color: white; }
  .no-print .btn-print:hover { background: #4338ca; }
  .no-print .btn-back { background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; }
  .no-print .btn-back:hover { background: #e5e7eb; }
  .no-print p { margin-top: 8px; color: #666; font-size: 12px; }
  @media print { .no-print { display: none !important; } body { padding: 0; } }
</style></head><body>
<div class="no-print">
  <button class="btn-back" onclick="window.close()">← Back to Tool</button>
  <button class="btn-print" onclick="window.print()">🖨️ Print Now</button>
  <p>${qrList.length} QR codes · ${totalPages} page(s) · 10 per page</p>
</div>
${Array.from({ length: totalPages }, (_, pageIdx) => {
  const start = pageIdx * 10;
  const pageQrs = qrList.slice(start, start + 10);
  return `<div class="page">
    <div class="header">
      <h1>${title || "FleekTrack"} — QR Codes</h1>
      <p>Printed: ${new Date().toLocaleString()} · Page ${pageIdx + 1} of ${totalPages} · Total: ${qrList.length}</p>
    </div>
    <div class="grid">
      ${pageQrs.map(q => `<div class="qr-item">
        <img src="${q.qrImageData}" alt="QR" />
        <div class="label">${q.fleekId}</div>
        <div class="time">${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</div>
      </div>`).join("")}
    </div>
    <div class="page-info">FleekTrack · Page ${pageIdx + 1}/${totalPages}</div>
  </div>`;
}).join("")}
</body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
  }, []);

  const printSelectedQRs = useCallback(() => {
    const selectedQrs = savedQr.filter((_, i) => qrSelections.has(i));
    printQRCodes(selectedQrs, "FleekTrack");
  }, [savedQr, qrSelections, printQRCodes]);

  const printSellerQRs = useCallback(() => {
    const selected = sellerQrSel.size > 0
      ? sellerQrCodes.filter((_, i) => sellerQrSel.has(i))
      : sellerQrCodes;
    printQRCodes(selected, "Seller QR");
  }, [sellerQrCodes, sellerQrSel, printQRCodes]);

  // ─── Permissions Functions ───
  const loadMyPermissions = useCallback(async () => {
    try {
      const r = await authFetch("/api/permissions?mode=own");
      if (r.ok) {
        const d = await r.json();
        if (d.permissions) setMyPermissions(d.permissions);
      }
    } catch (err) {
      console.error("loadMyPermissions error:", err);
    }
  }, []);

  const loadPermUsers = useCallback(async () => {
    setPermLoading(true);
    try {
      const r = await authFetch("/api/permissions");
      if (r.ok) {
        const d = await r.json();
        if (d.users && Array.isArray(d.users)) setPermUsers(d.users);
      } else {
        console.error("Permissions API error:", r.status);
      }
    } catch (err) {
      console.error("loadPermUsers error:", err);
    }
    setPermLoading(false);
  }, []);

  const updatePermission = useCallback(async (userId: number, tabKey: string, enabled: boolean) => {
    const u = permUsers.find(x => x.id === userId);
    if (!u) return;
    const newPerms = { ...u.permissions, [tabKey]: enabled };
    // Optimistic update
    setPermUsers(prev => prev.map(x => x.id === userId ? { ...x, permissions: newPerms, isDefault: false } : x));
    setPermSaving(userId);
    try {
      const r = await authFetch("/api/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, permissions: newPerms }),
      });
      if (!r.ok) {
        // Revert on error
        setPermUsers(prev => prev.map(x => x.id === userId ? u : x));
        toast("Failed to update permission", "error");
      }
    } catch {
      setPermUsers(prev => prev.map(x => x.id === userId ? u : x));
      toast("Connection error", "error");
    }
    setPermSaving(null);
  }, [permUsers, toast]);

  const resetPermissions = useCallback(async (userId: number) => {
    setPermSaving(userId);
    try {
      const r = await authFetch("/api/permissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const d = await r.json();
      if (r.ok && d.permissions) {
        setPermUsers(prev => prev.map(x => x.id === userId ? { ...x, permissions: d.permissions, isDefault: true, permUpdatedBy: null, permUpdatedAt: null } : x));
        toast("Permissions reset to defaults", "success");
      }
    } catch { toast("Connection error", "error"); }
    setPermSaving(null);
  }, [toast]);

  const toggleAllPermissions = useCallback(async (userId: number, enable: boolean, tabs?: string[]) => {
    const u = permUsers.find(x => x.id === userId);
    if (!u) return;
    const newPerms: Record<string, boolean> = { ...u.permissions };
    // If specific tabs provided, only toggle those; otherwise toggle all
    const keysToToggle = tabs || Object.keys(u.permissions);
    keysToToggle.forEach(k => { newPerms[k] = enable; });
    setPermUsers(prev => prev.map(x => x.id === userId ? { ...x, permissions: newPerms, isDefault: false } : x));
    setPermSaving(userId);
    try {
      const r = await authFetch("/api/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, permissions: newPerms }),
      });
      if (!r.ok) {
        setPermUsers(prev => prev.map(x => x.id === userId ? u : x));
        toast("Failed to update", "error");
      } else {
        toast(enable ? "All tabs enabled" : "All tabs disabled", "success");
      }
    } catch {
      setPermUsers(prev => prev.map(x => x.id === userId ? u : x));
    }
    setPermSaving(null);
  }, [permUsers, toast]);

  // Load theme from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("fleektrack-theme") as "dark" | "light" | null;
    if (saved) setTheme(saved);
  }, []);

  // Save theme to localStorage
  useEffect(() => {
    localStorage.setItem("fleektrack-theme", theme);
    document.documentElement.classList.toggle("light-mode", theme === "light");
  }, [theme]);

  useEffect(() => {
    (async () => {
      try {
        const r = await authFetch("/api/auth/me");
        const d = await r.json();
        if (d.user) {
          setUser(d.user);
          if (d.user.role === "seller") {
            setTab("entry");
          } else if (d.user.role.startsWith("3pl")) {
            setTab("gd");
          } else if (["admin", "manager"].includes(d.user.role)) {
            setTab("upload");
          } else {
            setTab("search");
          }
          stats();
          // Load permissions on session restore
          loadMyPermissions();
          // Load notifications
          loadNotifications();
          // Load vendor list for search filters
          loadVendorList();
        }
      } catch {}
      finally { setLoading(false); }
    })();
  }, []);

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !pass.trim()) { setLoginErr("Enter email and password"); return; }
    setLoginSub(true); setLoginErr("");
    try {
      const r = await authFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password: pass })
      });
      const d = await r.json();
      if (!r.ok) setLoginErr(d.error || "Login failed");
      else {
        if (typeof window !== "undefined" && d.token) {
          window.sessionStorage.setItem("auth_token", d.token);
        }
        setUser(d.user);
        if (d.user.role === "seller") {
          setTab("entry");
        } else if (d.user.role.startsWith("3pl")) {
          setTab("gd");
        } else if (["admin", "manager"].includes(d.user.role)) {
          setTab("upload");
        } else {
          setTab("search");
        }
        stats();
        // Load permissions on login
        loadMyPermissions();
        // Load notifications
        loadNotifications();
        // Load vendor list
        loadVendorList();
        toast(`Welcome back, ${d.user.name}!`, "success");
      }
    } catch { setLoginErr("Connection error"); }
    setLoginSub(false);
  };

  const logout = async () => {
    await authFetch("/api/auth/logout", { method: "POST" });
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem("auth_token");
    }
    setUser(null);
    setEmail("");
    setPass("");
  };

  const [accessReqs, setAccessReqs] = useState<{ id: number; name: string; email: string; message: string | null; status: string; assignedRole: string | null; reviewedBy: string | null; createdAt: string; }[]>([]);
  const [showAccessReqs, setShowAccessReqs] = useState(false);
  const [approveId, setApproveId] = useState<number | null>(null);
  const [approveRole, setApproveRole] = useState("employee");
  const [approvePass, setApprovePass] = useState("fleek123");
  const pendingCount = accessReqs.filter(r => r.status === "pending").length;

  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqName.trim() || !reqEmail.trim()) { toast("Name and email required", "error"); return; }
    try {
      const r = await authFetch("/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: reqName.trim(), email: reqEmail.trim(), message: reqMsg.trim() }),
      });
      const d = await r.json();
      if (!r.ok) toast(d.error || "Failed", "error");
      else { setReqSent(true); toast("Request submitted!", "success"); }
    } catch { toast("Network error", "error"); }
  };

  const loadAccessReqs = async () => {
    try { const r = await authFetch("/api/access-requests"); const d = await r.json(); if (r.ok) setAccessReqs(d.requests); } catch {}
  };

  const handleApprove = async (reqId: number) => {
    try {
      const r = await authFetch("/api/access-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: reqId, action: "approve", role: approveRole, password: approvePass }),
      });
      const d = await r.json();
      if (r.ok) { toast(d.message, "success"); setApproveId(null); setApproveRole("employee"); setApprovePass("fleek123"); loadAccessReqs(); }
      else toast(d.error || "Failed", "error");
    } catch { toast("Network error", "error"); }
  };

  const handleReject = async (reqId: number) => {
    try {
      const r = await authFetch("/api/access-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: reqId, action: "reject" }),
      });
      const d = await r.json();
      if (r.ok) { toast("Request rejected", "info"); loadAccessReqs(); }
      else toast(d.error || "Failed", "error");
    } catch { toast("Network error", "error"); }
  };

  // Load access requests for admin/manager on login
  useEffect(() => {
    if (user && ["admin", "manager"].includes(user.role)) { loadAccessReqs(); loadExtras(); }
    if (user && user.role.startsWith("3pl")) loadExtras();
  }, [user]);

  const upFile = async (f: File) => {
    if (!f.name.endsWith(".csv")) { setUpErr("Only CSV files allowed"); return; }
    if (f.size > 150 * 1024 * 1024) { setUpErr("Max file size is 150MB"); return; }

    setUploading(true); setUpErr(""); setUpResult(null);
    const sizeMB = (f.size / 1024 / 1024).toFixed(1);
    setFname(`Reading ${f.name} (${sizeMB}MB)...`);
    setProgress(3);

    try {
      // Step 1: Read file
      const text = await f.text();
      setProgress(8);

      // Step 2: Parse CSV in browser
      const lines = text.split(/\r?\n/);
      if (lines.length < 2) { setUpErr("CSV is empty or has no data rows"); setUploading(false); return; }

      const headerLine = lines[0];
      const dataLines = lines.slice(1).filter((l) => l.trim().length > 0);
      if (dataLines.length === 0) { setUpErr("No data rows found in CSV"); setUploading(false); return; }

      const headers = headerLine.split(",").map((h) => h.trim().replace(/^["']|["']$/g, ""));
      const allRows: Record<string, string>[] = [];
      for (const line of dataLines) {
        const values: string[] = [];
        let current = "";
        let inQuotes = false;
        for (let ci = 0; ci < line.length; ci++) {
          const ch = line[ci];
          if (ch === '"') { inQuotes = !inQuotes; }
          else if (ch === "," && !inQuotes) { values.push(current.trim().replace(/^["']|["']$/g, "")); current = ""; }
          else { current += ch; }
        }
        values.push(current.trim().replace(/^["']|["']$/g, ""));
        const row: Record<string, string> = {};
        headers.forEach((h, hi) => { row[h] = values[hi] || ""; });
        allRows.push(row);
      }

      setProgress(15);
      setFname(`Uploading ${allRows.length.toLocaleString()} rows...`);

      // Step 3: 500 rows per chunk (stays under 4.5MB API limit) + 4 parallel
      const CHUNK_SIZE = 500;
      const chunks: Record<string, string>[][] = [];
      for (let i = 0; i < allRows.length; i += CHUNK_SIZE) {
        chunks.push(allRows.slice(i, i + CHUNK_SIZE));
      }

      let totalAdded = 0;
      let totalSkipped = 0;
      let completed = 0;
      let failed = false;
      const PARALLEL = 4;

      const sendChunk = async (idx: number, retries = 2): Promise<{ added: number; skipped: number }> => {
        try {
          const resp = await authFetch("/api/upload-csv", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rows: chunks[idx], chunkIndex: idx, totalChunks: chunks.length }),
          });
          if (resp.status === 413) {
            // Body too large — should not happen with 500 row chunks
            throw new Error("Chunk too large");
          }
          const txt = await resp.text();
          if (!txt.startsWith("{")) throw new Error("Server error, retrying...");
          const d = JSON.parse(txt);
          if (!resp.ok) throw new Error(d.error || "Upload failed");
          return d;
        } catch (err) {
          if (retries > 0) {
            await new Promise(r => setTimeout(r, 500));
            return sendChunk(idx, retries - 1);
          }
          throw err;
        }
      };

      // Send chunks in parallel batches
      for (let batch = 0; batch < chunks.length && !failed; batch += PARALLEL) {
        const batchIdxs = [];
        for (let j = batch; j < Math.min(batch + PARALLEL, chunks.length); j++) batchIdxs.push(j);
        
        try {
          const results = await Promise.all(batchIdxs.map(idx => sendChunk(idx)));
          for (const d of results) {
            totalAdded += d.added || 0;
            totalSkipped += d.skipped || 0;
            completed++;
          }
          const pct = 15 + Math.round((completed / chunks.length) * 83);
          setProgress(pct);
          const rowsDone = Math.min(completed * CHUNK_SIZE, allRows.length);
          setFname(`${rowsDone.toLocaleString()} / ${allRows.length.toLocaleString()} rows · ${pct}%`);
        } catch (err) {
          failed = true;
          setUpErr(err instanceof Error ? err.message : "Upload failed. Try again.");
          return;
        }
      }

      setProgress(100);
      setFname("Upload complete!");
      setUpResult({ added: totalAdded, skipped: totalSkipped, totalRows: allRows.length });
      stats();
      if (totalAdded > 0) toast(`${totalAdded.toLocaleString()} new records saved!`, "success");
      else toast("All records already exist", "info");

    } catch (err) {
      setUpErr(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setTimeout(() => { setUploading(false); setProgress(0); setFname(""); }, 1200);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const search = async () => {
    // Allow search with just filters (no query needed if filters applied)
    const hasFilters = searchDateFrom || searchDateTo || (searchVendor && searchVendor !== "all") || (searchStatus && searchStatus !== "all");
    if (!query.trim() && !hasFilters) return;
    
    setSearching(true); setSErr(""); setQrRes([]); setSel(new Set());
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (searchDateFrom) params.set("dateFrom", searchDateFrom);
      if (searchDateTo) params.set("dateTo", searchDateTo);
      if (searchVendor && searchVendor !== "all") params.set("vendor", searchVendor);
      if (searchStatus && searchStatus !== "all") params.set("status", searchStatus);
      
      const r = await authFetch(`/api/search?${params.toString()}`);
      const d = await r.json();
      if (!r.ok) setSErr(d.error || "Search failed");
      else { setResults(d.results); if (d.results.length === 0) toast("No results found", "info"); }
    } catch { setSErr("Network error"); }
    setSearching(false);
  };

  const clearFilters = () => {
    setQuery("");
    setSearchDateFrom("");
    setSearchDateTo("");
    setSearchVendor("all");
    setSearchStatus("all");
    setResults([]);
  };

  const exportToExcel = () => {
    if (results.length === 0) return;
    const headers = ["Fleek ID", "Vendor", "Customer", "Country", "Quantity", "Amount", "Category", "Status", "Received", "Received By", "Received Date"];
    const rows = results.map(r => [
      r.fleekId, r.vendor || "", r.customerName || "", r.customerCountry || "", 
      r.quantitySold || "", r.totalOrderLineAmount || "", r.category || "", 
      r.latestStatus || "", r.receivedStatus || "", r.receivedBy || "", r.receivedDate || ""
    ]);
    const csv = [headers, ...rows].map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `FleekTrack_Export_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Exported to CSV!", "success");
  };

  const genQr = async (ids: string[]) => {
    setGening(true);
    try {
      const r = await authFetch("/api/generate-qr", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fleekIds: ids }) });
      const d = await r.json();
      if (r.ok) { setQrRes(d.results); const c = d.results.filter((q: QrResult) => q.success).length; stats(); if (c > 0) toast(`${c} QR codes generated!`, "success"); }
    } catch {}
    setGening(false);
  };

  const dlQr = (img: string, fid: string) => {
    const i = new Image();
    i.onload = () => {
      const p = 20, h = 40, c = document.createElement("canvas");
      c.width = i.width + p*2; c.height = i.height + h + p*2;
      const x = c.getContext("2d"); if (!x) return;
      x.fillStyle = "#FFF"; x.fillRect(0, 0, c.width, c.height);
      x.drawImage(i, p, p);
      x.fillStyle = "#000"; x.font = "bold 22px monospace"; x.textAlign = "center"; x.textBaseline = "middle";
      x.fillText(fid, c.width/2, i.height + p + h/2);
      const a = document.createElement("a"); a.download = `QR_${fid.replace(/[/\\]/g, "_")}.png`; a.href = c.toDataURL("image/png"); a.click();
    };
    i.src = img;
  };

  const dlAllQr = async (items: { qrImageData: string; fleekId: string }[], label: string) => {
    if (!items.length) return;
    toast("Generating download...", "info");
    const cols = Math.min(4, items.length), rows = Math.ceil(items.length/cols), cw = 260, ch = 310, pd = 30;
    const cv = document.createElement("canvas"); cv.width = cols*cw + (cols+1)*pd; cv.height = rows*ch + (rows+1)*pd;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    ctx.fillStyle = "#FFF"; ctx.fillRect(0, 0, cv.width, cv.height);
    const ld = (s: string) => new Promise<HTMLImageElement>((ok, no) => { const img = new Image(); img.onload = () => ok(img); img.onerror = no; img.src = s; });
    for (let i = 0; i < items.length; i++) {
      const c = i % cols, r = Math.floor(i/cols), x = pd + c*(cw+pd), y = pd + r*(ch+pd);
      try { const img = await ld(items[i].qrImageData); ctx.drawImage(img, x+(cw-200)/2, y+10, 200, 200); ctx.fillStyle = "#000"; ctx.font = "bold 16px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(items[i].fleekId, x+cw/2, y+218); } catch {}
    }
    const a = document.createElement("a"); a.download = `${label}_${items.length}.png`; a.href = cv.toDataURL("image/png"); a.click();
    toast(`${items.length} QR codes downloaded!`, "success");
  };

  const exportCSV = () => {
    if (!results.length) return;
    const h = ["Fleek ID","Status","Status Date","Amount","Country","Vendor","Customer","Quantity","Category","Received","Received Date","Box Count","Received By"];
    const rows = results.map((r) => [r.fleekId, r.latestStatus||"", r.latestStatusDate||"", r.totalOrderLineAmount||"", r.customerCountry||"", r.vendor||"", r.customerName||"", r.quantitySold||"", r.category||"", r.receivedStatus||"", r.receivedDate||"", r.receivedBoxCount||"", r.receivedBy||""]);
    const csv = [h, ...rows].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.download = `FleekTrack_${new Date().toISOString().slice(0,10)}.csv`; a.href = URL.createObjectURL(blob); a.click();
    toast(`${results.length} records exported!`, "success");
  };

  const getU = async () => { setLoadUsers(true); try { const r = await authFetch("/api/users"); const d = await r.json(); if (r.ok) setUsers(d.users); } catch {} setLoadUsers(false); };
  const addU = async (e: React.FormEvent) => { e.preventDefault(); setAdding(true); try { const r = await authFetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nu) }); const d = await r.json(); if (!r.ok) toast(d.error || "Failed", "error"); else { toast(`${nu.name} added!`, "success"); setNu({ email: "", name: "", password: "", role: "employee" }); getU(); } } catch { toast("Network error", "error"); } setAdding(false); };
  const toggleU = async (id: number, a: boolean) => { try { const r = await authFetch("/api/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: id, isActive: !a }) }); if (r.ok) { toast(a ? "User disabled" : "User enabled", "info"); getU(); } } catch {} };
  const deleteUser = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to permanently delete "${name}"? This cannot be undone.`)) return;
    try { const r = await authFetch("/api/users", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: id }) }); const d = await r.json(); if (r.ok) { toast(`${name} deleted`, "success"); getU(); } else toast(d.error || "Failed", "error"); } catch { toast("Network error", "error"); }
  };
  const deleteQr = async (id: number, fleekId: string) => {
    if (!confirm(`Delete QR code for "${fleekId}"?`)) return;
    try { const r = await authFetch("/api/qr-codes", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ qrId: id }) }); if (r.ok) { toast("QR deleted", "success"); getSaved(); } else toast("Failed", "error"); } catch { toast("Network error", "error"); }
  };
  const changePass = async (userId: number, newP: string, currP?: string) => { try { const r = await authFetch("/api/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, newPassword: newP, currentPassword: currP }) }); const d = await r.json(); if (r.ok) { toast("Password changed!", "success"); setChgPassId(null); setChgPassVal(""); setChgOwnPass(false); setCurrPass(""); setNewPass(""); getU(); } else toast(d.error || "Failed", "error"); } catch { toast("Network error", "error"); } };

  // Scan log edit/delete (admin only)
  const [editLog, setEditLog] = useState<ScanLog | null>(null);
  const [editBoxCount, setEditBoxCount] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const saveEditLog = async () => {
    if (!editLog) return;
    try {
      const r = await authFetch("/api/scan", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ logId: editLog.id, boxCount: editBoxCount, notes: editNotes }) });
      if (r.ok) { toast("Log updated!", "success"); setEditLog(null); getLogs(); } else toast("Failed", "error");
    } catch { toast("Network error", "error"); }
  };

  const deleteLog = async (id: number, fleekId: string) => {
    if (!confirm(`Delete received log for "${fleekId}"? This cannot be undone.`)) return;
    try {
      const r = await authFetch("/api/scan", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ logId: id }) });
      if (r.ok) { toast("Log deleted", "success"); getLogs(); } else toast("Failed", "error");
    } catch { toast("Network error", "error"); }
  };

  const markRec = async () => {
    if (!scanId.trim()) { toast("Enter a Fleek ID", "error"); return; }
    if (!scanBox.trim()) { toast("Box count is required", "error"); return; }
    setMarking(true);
    try {
      // Build box details string for storage
      const filledBoxes = boxDetails.filter(b => b.weight || b.height || b.width || b.length);
      const boxDetailsStr = filledBoxes.length > 0
        ? JSON.stringify(filledBoxes.map((b, i) => ({
            box: i + 1,
            weight: b.weight || null,
            dimensions: (b.height || b.width || b.length) ? `${b.height || "0"} x ${b.width || "0"} x ${b.length || "0"}` : null,
          })))
        : null;

      const r = await authFetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fleekId: scanId.trim(),
          boxCount: scanBox.trim(),
          notes: scanNotes.trim() || null,
          boxDetails: boxDetailsStr,
          photoUrl: scanPhoto || null,
        })
      });
      const d = await r.json();
      if (!r.ok) {
        if (d.duplicate) {
          // Show prominent duplicate warning
          toast(d.error, "error");
        } else {
          toast(d.error || "Failed", "error");
        }
      } else {
        toast(d.message, d.reReceive ? "info" : "success");
        setScanId(""); setScanBox(""); setScanNotes(""); setScanPhoto(null); setBoxDetails([]); setScanDet(null); getLogs();
      }
    } catch { toast("Network error", "error"); }
    setMarking(false);
  };

  // ─── SELLER FUNCTIONS ───
  const downloadSellerTemplate = () => {
    const headers = ["Vendor", "Fleek ID", "Pieces", "Box no", "Weight", "Height", "Length", "Width", "Dimensional Weight"];
    const csv = headers.join(",") + "\n";
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.download = "GD_Details_Template.csv"; a.href = URL.createObjectURL(blob); a.click();
    toast("Template downloaded!", "success");
  };

  const uploadSellerCSV = async (f: File) => {
    if (!f.name.endsWith(".csv")) { toast("Only CSV files", "error"); return; }
    setSellerUploading(true);
    try {
      const text = await f.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) { toast("CSV empty", "error"); return; }
      const headers = lines[0].split(",").map(h => h.trim().replace(/^["']|["']$/g, "").toLowerCase());
      const rows: Record<string, string>[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values: string[] = []; let current = ""; let inQ = false;
        for (const ch of lines[i]) { if (ch === '"') inQ = !inQ; else if (ch === "," && !inQ) { values.push(current.trim()); current = ""; } else current += ch; }
        values.push(current.trim());
        const row: Record<string, string> = {}; headers.forEach((h, idx) => { row[h] = values[idx] || ""; }); rows.push(row);
      }
      const r = await authFetch("/api/seller", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }) });
      const d = await r.json();
      if (!r.ok) { toast(d.error || "Upload failed", "error"); return; }
      setSellerResult(d.summary); setSellerQrCodes(d.qrCodes || []); toast(d.message, "success"); loadSellerData();
    } catch (e) { toast("Upload failed: " + (e instanceof Error ? e.message : ""), "error"); }
    finally { setSellerUploading(false); if (sellerFileRef.current) sellerFileRef.current.value = ""; }
  };

  // Auto-search order status
  const searchTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});
  
  const searchOrderStatus = async (boxId: number, oid: number, orderId: string) => {
    if (!orderId.trim()) {
      setBoxEntries(prev => prev.map(b => b.id === boxId ? { ...b, orders: b.orders.map(o => o.oid === oid ? { ...o, status: null, vendor: null, searching: false } : o) } : b));
      return;
    }
    setBoxEntries(prev => prev.map(b => b.id === boxId ? { ...b, orders: b.orders.map(o => o.oid === oid ? { ...o, searching: true } : o) } : b));
    try {
      const normalized = orderId.trim().replace(/\//g, "_");
      const r = await authFetch("/api/seller?search=" + encodeURIComponent(normalized));
      const d = await r.json();
      const result = d.searchResults?.[0];
      setBoxEntries(prev => prev.map(b => b.id === boxId ? { ...b, orders: b.orders.map(o => o.oid === oid ? { ...o, status: result ? (result.latestStatus || "No status") : "Not found", vendor: result?.vendor || null, searching: false } : o) } : b));
    } catch {
      setBoxEntries(prev => prev.map(b => b.id === boxId ? { ...b, orders: b.orders.map(o => o.oid === oid ? { ...o, status: "Error", vendor: null, searching: false } : o) } : b));
    }
  };

  const handleOrderIdChange = (boxId: number, oid: number, value: string) => {
    const key = boxId + "_" + oid;
    if (searchTimeoutRef.current[key]) clearTimeout(searchTimeoutRef.current[key]);
    setBoxEntries(prev => prev.map(b => b.id === boxId ? { ...b, orders: b.orders.map(o => o.oid === oid ? { ...o, orderId: value, status: null, vendor: null } : o) } : b));
    if (value.trim().length >= 3) {
      searchTimeoutRef.current[key] = setTimeout(() => searchOrderStatus(boxId, oid, value), 500);
    }
  };

  const updateBoxField = (boxId: number, field: string, value: string) => {
    setBoxEntries(prev => prev.map(b => {
      if (b.id !== boxId) return b;
      const updated = { ...b, [field]: value };
      if (["height", "length", "width"].includes(field)) {
        const h = parseFloat(field === "height" ? value : b.height) || 0;
        const l = parseFloat(field === "length" ? value : b.length) || 0;
        const w = parseFloat(field === "width" ? value : b.width) || 0;
        if (h > 0 && l > 0 && w > 0) updated.dimWeight = (h * l * w / 5000).toFixed(2);
      }
      return updated;
    }));
  };

  const toggleMulti = (boxId: number) => {
    setBoxEntries(prev => prev.map(b => {
      if (b.id !== boxId) return b;
      if (!b.isMulti) {
        // Add second order slot
        orderIdRef.current++;
        return { ...b, isMulti: true, orders: [...b.orders, makeOrder(orderIdRef.current)] };
      }
      // Turn off multi - keep only first order
      return { ...b, isMulti: false, orders: [b.orders[0]] };
    }));
  };

  const addOrderToBox = (boxId: number) => {
    orderIdRef.current++;
    setBoxEntries(prev => prev.map(b => b.id === boxId ? { ...b, orders: [...b.orders, makeOrder(orderIdRef.current)] } : b));
  };

  const removeOrderFromBox = (boxId: number, oid: number) => {
    setBoxEntries(prev => prev.map(b => {
      if (b.id !== boxId || b.orders.length <= 1) return b;
      const filtered = b.orders.filter(o => o.oid !== oid);
      return { ...b, orders: filtered, isMulti: filtered.length > 1 };
    }));
  };

  const addBoxRow = () => {
    boxIdRef.current++;
    setBoxEntries(prev => [...prev, makeBox(boxIdRef.current)]);
  };

  const removeBoxRow = (id: number) => {
    if (boxEntries.length <= 1) return;
    setBoxEntries(prev => prev.filter(b => b.id !== id));
  };

  const saveAllEntries = async () => {
    // Collect boxes - each box sent as one call with all its orders
    const validBoxes = boxEntries.filter(b => b.orders.some(o => o.orderId.trim()) && b.boxNo.trim());
    if (validBoxes.length === 0) { toast("Add at least one order", "error"); return; }

    setEntrySaving(true);
    let savedCount = 0;
    const newQrCodes: { fleekId: string; qrImageData: string }[] = [];

    for (const box of validBoxes) {
      const orders = box.orders.filter(o => o.orderId.trim()).map(o => ({
        orderId: o.orderId.trim().replace(/\//g, "_"),
        pieces: o.pieces.trim(),
      }));
      if (orders.length === 0) continue;

      try {
        const r = await authFetch("/api/seller", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "box_entry", boxData: {
            orders,
            boxNo: box.boxNo.trim(),
            weight: box.weight.trim(),
            height: box.height.trim(),
            length: box.length.trim(),
            width: box.width.trim(),
            dimensionalWeight: box.dimWeight.trim(),
          }})
        });
        const d = await r.json();
        if (r.ok) {
          savedCount++;
          if (d.qrCode && !newQrCodes.some(q => q.fleekId === d.qrCode.fleekId)) newQrCodes.push(d.qrCode);
        }
      } catch {}
    }

    if (savedCount > 0) {
      toast(savedCount + " box(es) saved!", "success");
      setSellerQrCodes(prev => { const u = [...prev]; newQrCodes.forEach(qr => { if (!u.some(q => q.fleekId === qr.fleekId)) u.unshift(qr); }); return u; });
      boxIdRef.current = 1; orderIdRef.current = 1;
      setBoxEntries([makeBox(1)]);
      loadSellerData();
    } else { toast("Save failed", "error"); }
    setEntrySaving(false);
  };

  // Delete seller entry (admin)
  const deleteSellerEntry = async (id: number) => {
    if (!confirm("Delete this entry?")) return;
    try {
      const r = await authFetch("/api/seller", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entryId: id }) });
      const d = await r.json();
      if (r.ok) { toast("Entry deleted", "success"); loadSellerData(); } 
      else toast(d.error || "Failed", "error");
    } catch { toast("Network error", "error"); }
  };

  const loadSellerData = useCallback(async (dateFrom?: string, dateTo?: string, vendor?: string) => {
    try { 
      const isAdminView = user && ["admin", "manager"].includes(user.role);
      const params = new URLSearchParams();
      
      // Date filters for both admin and seller
      const df = dateFrom !== undefined ? dateFrom : adminSellerDateFrom;
      const dt = dateTo !== undefined ? dateTo : adminSellerDateTo;
      if (df) params.set("dateFrom", df);
      if (dt) params.set("dateTo", dt);
      
      // Vendor filter only for admin
      if (isAdminView) {
        const v = vendor !== undefined ? vendor : adminSellerVendorFilter;
        if (v && v !== "all") params.set("vendor", v);
      }
      
      const url = "/api/seller" + (params.toString() ? "?" + params.toString() : "");
      const r = await authFetch(url); 
      const d = await r.json(); 
      if (r.ok) { 
        setSellerHistory(d.history || []); 
        // Deduplicate QR codes by fleekId
        const qrs = d.qrCodes || [];
        const seenQr = new Set<string>();
        const uniqueQrs = qrs.filter((q: { fleekId: string }) => {
          if (seenQr.has(q.fleekId)) return false;
          seenQr.add(q.fleekId);
          return true;
        });
        setSellerQrCodes(uniqueQrs); 
        // Deduplicate details by id
        const dets = d.details || [];
        const seenId = new Set<number>();
        const uniqueDets = dets.filter((det: { id: number }) => {
          if (seenId.has(det.id)) return false;
          seenId.add(det.id);
          return true;
        });
        setSellerDetails(uniqueDets); 
        // Set filter data for dropdowns
        if (d.allVendors) setAdminSellerVendors(d.allVendors);
        if (d.allDates) setAdminSellerDates(d.allDates);
      } 
    } catch(e) { console.error("loadSellerData:", e); }
  }, [user, adminSellerDateFrom, adminSellerDateTo, adminSellerVendorFilter]);

  const dlSellerQr = (img: string, fid: string) => {
    const i = new Image();
    i.onload = () => { const p = 20, h = 40, c = document.createElement("canvas"); c.width = i.width + p*2; c.height = i.height + h + p*2; const x = c.getContext("2d"); if (!x) return; x.fillStyle = "#FFF"; x.fillRect(0, 0, c.width, c.height); x.drawImage(i, p, p); x.fillStyle = "#000"; x.font = "bold 22px monospace"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(fid, c.width/2, i.height + p + h/2); const a = document.createElement("a"); a.download = "QR_" + fid.replace(/[\/\\]/g, "_") + ".png"; a.href = c.toDataURL("image/png"); a.click(); };
    i.src = img;
  };

  const dlAllSellerQr = async () => {
    if (!sellerQrCodes.length) return; toast("Generating...", "info");
    const cols = Math.min(4, sellerQrCodes.length), rws = Math.ceil(sellerQrCodes.length/cols), cw = 260, ch = 310, pd = 30;
    const cv = document.createElement("canvas"); cv.width = cols*cw + (cols+1)*pd; cv.height = rws*ch + (rws+1)*pd;
    const ctx = cv.getContext("2d"); if (!ctx) return; ctx.fillStyle = "#FFF"; ctx.fillRect(0, 0, cv.width, cv.height);
    const ld = (s: string) => new Promise<HTMLImageElement>((ok, no) => { const img = new Image(); img.onload = () => ok(img); img.onerror = no; img.src = s; });
    for (let i = 0; i < sellerQrCodes.length; i++) { const c = i % cols, r = Math.floor(i/cols), xx = pd + c*(cw+pd), yy = pd + r*(ch+pd); try { const img = await ld(sellerQrCodes[i].qrImageData); ctx.drawImage(img, xx+(cw-200)/2, yy+10, 200, 200); ctx.fillStyle = "#000"; ctx.font = "bold 16px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(sellerQrCodes[i].fleekId, xx+cw/2, yy+218); } catch {} }
    const a = document.createElement("a"); a.download = "Seller_QR_" + new Date().toISOString().slice(0,10) + ".png"; a.href = cv.toDataURL("image/png"); a.click(); toast("Downloaded!", "success");
  };

  // ─── GD DETAILS FUNCTIONS (Fleek Side) ───
  const loadGdDates = async () => {
    try { const r = await authFetch("/api/gd-details"); const d = await r.json(); if (r.ok) { setGdDates(d.dates || []); } } catch {}
  };

  const loadGdSummaries = async (date: string, dateTo?: string) => {
    if (!date) return;
    setGdLoading(true);
    try {
      const params = "date=" + date + (dateTo && dateTo !== date ? "&dateTo=" + dateTo : "") + "&summary=true";
      const r = await authFetch("/api/gd-details?" + params);
      const d = await r.json();
      if (r.ok) { 
        setGdSummaries(d.summaries || []); 
        // Extract unique vendors
        const vendors = [...new Set((d.summaries || []).map((s: { vendor: string }) => s.vendor))] as string[];
        setGdVendors(vendors);
      }
    } catch {}
    setGdLoading(false);
  };

  const loadGdDetails = async (vendorOverride?: string, dateOverride?: string) => {
    const v = vendorOverride || gdVendor;
    const d1 = dateOverride || gdDate;
    if (!d1 || !v) { toast("Select date and vendor", "error"); return; }
    if (vendorOverride) setGdVendor(vendorOverride);
    setGdLoading(true);
    try {
      const r = await authFetch("/api/gd-details?date=" + d1 + "&vendor=" + encodeURIComponent(v));
      const d = await r.json();
      if (r.ok) { setGdDetails(d.details || []); setGdSummary(d.summary); setGdVendors(d.vendors || []); }
    } catch {}
    setGdLoading(false);
  };

  const assign3pl = async (vendor: string, uploadDate: string, assigned3pl: string) => {
    try {
      const r = await authFetch("/api/gd-details", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vendor, uploadDate, assigned3pl }) });
      const d = await r.json();
      if (r.ok) { toast(d.message, "success"); loadGdSummaries(gdDate); } else { toast(d.error || "Failed", "error"); }
    } catch { toast("Network error", "error"); }
  };

  const exportGdCSV = () => {
    if (!gdDetails.length) return;
    const h = ["Fleek ID", "Box No", "Pieces", "Weight", "Height", "Length", "Width", "Dimensional Weight", "Received"];
    const rows = gdDetails.map(r => [r.fleekId, r.boxNo, r.pieces || "", r.weight || "", r.height || "", r.length || "", r.width || "", r.dimensionalWeight || "", r.receivedStatus || ""]);
    const csv = [h, ...rows].map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.download = "GD_" + gdVendor + "_" + gdDate + ".csv"; a.href = URL.createObjectURL(blob); a.click();
    toast("Exported!", "success");
  };

  // ─── 3PL GD ORDERS ───
  const load3plOrders = async (date?: string, tpl?: string, vendor?: string, dateTo?: string) => {
    try {
      const isAdminView = user && ["admin", "manager"].includes(user.role);
      
      // Date range - use shared state for both admin and 3PL
      const d1 = date !== undefined ? date : admin3plDateFrom;
      const d2 = dateTo !== undefined ? dateTo : admin3plDateTo;
      
      // 3PL filter - only admin can filter by specific 3PL
      const t1 = tpl !== undefined ? tpl : (isAdminView ? admin3plFilter : "");
      
      // Vendor filter
      const v1 = vendor !== undefined ? vendor : admin3plVendorFilter;
      
      const params = new URLSearchParams();
      if (d1) params.set("date", d1);
      if (d2 && d2 !== d1) params.set("dateTo", d2);
      if (isAdminView && t1 && t1 !== "all") params.set("tpl", t1);  // Only admin filters by 3PL
      if (v1 && v1 !== "all") params.set("vendor", v1);
      const r = await authFetch("/api/3pl-orders?" + params.toString());
      if (!r.ok) return;
      const d = await r.json();
      // Deduplicate summaries by vendor
      const sums = d.summaries || [];
      const seenVendor = new Set<string>();
      const uniqueSums = sums.filter((s: { vendor: string }) => {
        if (seenVendor.has(s.vendor)) return false;
        seenVendor.add(s.vendor);
        return true;
      });
      setPlOrders(uniqueSums);
      // Recalculate totals from unique data
      const totals = {
        pendingBoxes: uniqueSums.reduce((a: number, s: { pendingBoxes: number }) => a + s.pendingBoxes, 0),
        pendingOrders: uniqueSums.reduce((a: number, s: { pendingOrders: number }) => a + s.pendingOrders, 0),
        receivedBoxes: uniqueSums.reduce((a: number, s: { receivedBoxes: number }) => a + s.receivedBoxes, 0),
        totalVendors: uniqueSums.length,
        totalWeight: uniqueSums.reduce((a: number, s: { totalWeight: string }) => a + (parseFloat(s.totalWeight || "0") || 0), 0).toFixed(2),
      };
      setPlTotals(totals);
      if (d.filters) {
        setPlFilterVendors(d.filters.vendors || []);
        setPlFilterDates(d.filters.dates || []);
        // Update filter dropdowns for both admin and 3PL users
        setAdmin3plVendors(d.filters.vendors || []);
        if (isAdminView) {
          setAdmin3plList(d.filters.tpls || []);
        }
      }
    } catch {}
  };


  const capturePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Compress and convert to base64
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxW = 800; // Max width for compression
        const scale = Math.min(1, maxW / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressed = canvas.toDataURL("image/jpeg", 0.6); // 60% quality
        setScanPhoto(compressed);
        toast("Photo attached!", "success");
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    if (photoInputRef.current) photoInputRef.current.value = "";
  };

  const captureExtraPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { const img = new Image(); img.onload = () => { const c = document.createElement("canvas"); const s = Math.min(1, 800/img.width); c.width = img.width*s; c.height = img.height*s; const ctx = c.getContext("2d"); if(!ctx) return; ctx.drawImage(img, 0, 0, c.width, c.height); setExtraPhoto(c.toDataURL("image/jpeg", 0.6)); }; img.src = reader.result as string; };
    reader.readAsDataURL(file); if (extraPhotoRef.current) extraPhotoRef.current.value = "";
  };

  const submitExtra = async () => {
    if (!extraFleekId.trim()) { toast("Order / Fleek ID is required", "error"); return; }
    if (!extraDesc.trim()) { toast("Description required", "error"); return; }
    if (!extraPhoto) { toast("Photo is required — please attach a picture", "error"); return; }
    setExtraSubmitting(true);
    try {
      const r = await authFetch("/api/extras", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fleekId: extraFleekId.trim(), description: extraDesc.trim(), photoUrl: extraPhoto }) });
      const d = await r.json();
      if (r.ok) { toast("Extra item reported!", "success"); setExtraFleekId(""); setExtraDesc(""); setExtraPhoto(null); setShowExtraForm(false); loadExtras(); } else toast(d.error || "Failed", "error");
    } catch { toast("Network error", "error"); }
    setExtraSubmitting(false);
  };

  const loadExtras = async () => { try { const r = await authFetch("/api/extras"); const d = await r.json(); if (r.ok) setExtraItems2(d.items); } catch {} };
  const loadActivity = async (q?: string) => { try { const r = await authFetch(`/api/activity${q ? `?q=${encodeURIComponent(q)}` : ""}`); const d = await r.json(); if (r.ok) setActivityData(d.logs); } catch {} };

  const reviewExtra = async (id: number, status: string, adminNotes?: string) => {
    try { const r = await authFetch("/api/extras", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId: id, status, adminNotes }) }); if (r.ok) { toast("Updated!", "success"); loadExtras(); } } catch {}
  };

  const addBoxDetail = () => setBoxDetails([...boxDetails, { weight: "", height: "", width: "", length: "" }]);
  const removeBoxDetail = (idx: number) => setBoxDetails(boxDetails.filter((_, i) => i !== idx));
  const updateBoxDetail = (idx: number, field: keyof BoxDetail, val: string) => {
    setBoxDetails(boxDetails.map((b, i) => i === idx ? { ...b, [field]: val } : b));
  };

  const startScan = async () => {
    if (scannerOn) { stopScan(); return; }
    setCamError("");
    if (typeof window !== "undefined" && window.location.protocol !== "https:" && !["localhost","127.0.0.1"].includes(window.location.hostname)) { setCamError("HTTPS required for camera"); toast("Camera requires HTTPS", "error"); return; }
    if (!navigator.mediaDevices?.getUserMedia) { setCamError("Camera not supported"); toast("Camera unavailable", "error"); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.setAttribute("playsinline", "true"); videoRef.current.muted = true; await videoRef.current.play(); setScannerOn(true); scanLockRef.current = false; toast("Camera ready", "info"); scanQRFrames(); }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("NotAllowed")) setCamError("Camera permission denied");
      else if (msg.includes("NotFound")) setCamError("No camera found");
      else if (msg.includes("NotReadable")) setCamError("Camera in use");
      else if (msg.includes("Overconstrained")) { try { const s2 = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }); streamRef.current = s2; if (videoRef.current) { videoRef.current.srcObject = s2; videoRef.current.setAttribute("playsinline", "true"); videoRef.current.muted = true; await videoRef.current.play(); setScannerOn(true); scanLockRef.current = false; scanQRFrames(); return; } } catch { setCamError("Camera failed"); } }
      else setCamError("Camera error");
      toast("Camera failed", "error");
    }
  };

  const scanQRFrames = () => {
    const video = videoRef.current, canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    const tick = async () => {
      if (!streamRef.current || !video.videoWidth) { animFrameRef.current = requestAnimationFrame(tick); return; }
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      if (!scanLockRef.current) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        try {
          if ("BarcodeDetector" in window) {
            // @ts-expect-error BarcodeDetector API
            const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
            const barcodes = await detector.detect(canvas);
            if (barcodes.length > 0 && barcodes[0].rawValue) { scanLockRef.current = true; setScanId(barcodes[0].rawValue); toast(`Scanned: ${barcodes[0].rawValue}`, "success"); stopScan(); return; }
          } else {
            const jsQR = (await import("jsqr")).default;
            const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
            if (code?.data) { scanLockRef.current = true; setScanId(code.data); toast(`Scanned: ${code.data}`, "success"); stopScan(); return; }
          }
        } catch {
          try { const jsQR = (await import("jsqr")).default; const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" }); if (code?.data) { scanLockRef.current = true; setScanId(code.data); toast(`Scanned: ${code.data}`, "success"); stopScan(); return; } } catch {}
        }
      }
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
  };

  const stopScan = () => {
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = 0; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    if (videoRef.current) videoRef.current.srcObject = null;
    setScannerOn(false);
  };

  const getLogs = async () => { setLoadLogs(true); try { const q = logSearch.trim(); const r = await authFetch(`/api/scan${q ? `?q=${encodeURIComponent(q)}` : ""}`); const d = await r.json(); if (r.ok) setSLogs(d.logs); } catch {} setLoadLogs(false); };
  const getSaved = async () => { setLoadQr(true); try { const r = await authFetch("/api/qr-codes"); const d = await r.json(); if (r.ok) setSavedQr(d.qrCodes); } catch {} setLoadQr(false); };
  const getBk = async () => { setLoadBk(true); try { const r = await authFetch("/api/backend"); const d = await r.json(); if (r.ok) setBkData(d); } catch {} setLoadBk(false); };

  
  // Live polling - seller data refreshes for seller role OR admin viewing seller tool
  useEffect(() => { 
    const isSeller = user?.role === "seller";
    const isAdminSellerView = ["admin", "manager"].includes(user?.role || "") && viewAs === "seller";
    
    if (!isSeller && !isAdminSellerView) return;
    
    // Load immediately
    loadSellerData();
    
    // Poll every 15 seconds
    const interval = setInterval(() => loadSellerData(), 15000);
    return () => clearInterval(interval);
  }, [user?.role, sellerTab, viewAs, loadSellerData]);
  useEffect(() => { if (tab === "gddetails") { loadGdDates(); if (gdDate) loadGdSummaries(gdDate, gdDateTo); } }, [tab]);
  useEffect(() => { 
    if (gdDate) { 
      loadGdSummaries(gdDate, gdDateTo);
      const interval = setInterval(() => loadGdSummaries(gdDate, gdDateTo), 15000);
      return () => clearInterval(interval);
    }
  }, [gdDate, gdDateTo, gdFilterVendor, gdFilter3pl]);
  useEffect(() => { 
    const is3plOwnView = user?.role?.startsWith("3pl") && plTab === "gd";
    const isAdmin3plView = ["admin", "manager"].includes(user?.role || "") && viewAs === "3pl" && plTab === "gd";

    if (!is3plOwnView && !isAdmin3plView) return;

    // Load immediately
    load3plOrders();
    
    // Poll every 15 seconds
    const interval = setInterval(() => load3plOrders(), 15000);
    return () => clearInterval(interval);
  }, [user?.role, plTab, viewAs, admin3plDateFrom, admin3plDateTo, admin3plFilter, admin3plVendorFilter]);

  useEffect(() => { 
    if (tab === "qrcodes") getSaved(); 
    if (tab === "users") getU(); 
    if (tab === "received") getLogs(); 
    if (tab === "backend") getBk(); 
    if (tab === "extras") loadExtras(); 
    if (tab === "activity") loadActivity(); 
    if (tab === "upload" || tab === "search") stats(); 
    if (tab === "gddetails") loadGdDates();
    if (tab === "granted") loadPermUsers();
    // Live polling for active tab with CURRENT state values
    const interval = setInterval(() => {
      if (tab === "received") getLogs();
      if (tab === "upload" || tab === "search") stats();
      if (tab === "backend") getBk();
      if (tab === "extras") loadExtras();
      if (tab === "activity") loadActivity();
      if (tab === "qrcodes") getSaved();
      
    }, 20000);
    return () => clearInterval(interval);
  }, [tab, stats, logSearch, plFilterDate, plFilter3pl, plFilterVendor, sellerTab]);
  useEffect(() => { return () => { stopScan(); }; }, [tab]);
  useEffect(() => {
    if (!user?.role?.startsWith("3pl") || !scanId.trim()) {
      setScanDet(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const r = await authFetch(`/api/search?q=${encodeURIComponent(scanId.trim().replace(/\//g, "_"))}`);
        const d = await r.json();
        if (d.results?.length > 0) {
          const o = d.results[0];
          setScanDet({
            vendor: o.vendor,
            quantitySold: o.quantitySold,
            fleekId: o.fleekId,
            customerName: o.customerName,
            customerCountry: o.customerCountry,
            category: o.category,
            totalOrderLineAmount: o.totalOrderLineAmount,
            latestStatus: o.latestStatus,
          });
        } else {
          setScanDet(null);
        }
      } catch {}
    }, 600);
    return () => clearTimeout(t);
  }, [scanId, user?.role]);

  // ─── COMMON UI ───
  const Spinner = ({ size = 20 }: { size?: number }) => (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M12 2C6.47715 2 2 6.47715 2 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );

  const Icon = ({ name, size = 20 }: { name: string; size?: number }) => {
    const icons: Record<string, React.ReactNode> = {
      upload: <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />,
      search: <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />,
      qr: <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />,
      check: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />,
      database: <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />,
      users: <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />,
      camera: <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />,
      box: <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />,
      logo: <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />,
      key: <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />,
      logout: <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />,
      refresh: <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />,
      download: <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />,
      shield: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />,
      mail: <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />,
      user: <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />,
      lock: <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />,
      stop: <><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></>,
      checkmark: <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />,
      x: <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />,
      info: <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
      sun: <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />,
      moon: <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />,
      bell: <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />,
    };
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>{icons[name]}</svg>;
  };

  // ═══════════════════════════════════════════════════════════════
  // LOADING SCREEN
  // ═══════════════════════════════════════════════════════════════
  if (loading) return (
    <div className={`min-h-screen ${theme === "dark" ? "bg-[#05050a]" : "bg-gray-50"} flex items-center justify-center overflow-hidden`}>
      {/* Visible floating orb particles */}
      <div className="scene-orb scene-orb-1" style={{ top: "20%", left: "25%" }} />
      <div className="scene-orb scene-orb-2" style={{ top: "35%", right: "20%" }} />
      <div className="scene-orb scene-orb-3" style={{ bottom: "30%", left: "15%" }} />
      <div className="scene-orb scene-orb-4" style={{ top: "60%", right: "30%" }} />
      
      {/* Big ambient glow orbs */}
      <div className="absolute top-1/3 left-1/4 w-72 h-72 bg-indigo-500/20 rounded-full blur-[80px]" style={{ animation: "float-slow 8s ease-in-out infinite" }} />
      <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-purple-500/15 rounded-full blur-[100px]" style={{ animation: "float-reverse 10s ease-in-out infinite" }} />
      
      <div className="flex flex-col items-center animate-fade-in-up relative z-10">
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center animate-pulse-glow"
          style={{ boxShadow: "0 0 60px rgba(99,102,241,0.5), 0 0 120px rgba(139,92,246,0.25), 0 30px 80px -20px rgba(0,0,0,0.6)" }}>
          <Icon name="logo" size={44} />
        </div>
        <h2 className="mt-6 text-2xl font-extrabold bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300 bg-clip-text text-transparent tracking-tight" style={{ textShadow: "0 0 40px rgba(99,102,241,0.3)" }}>FleekTrack</h2>
        <p className="text-zinc-500 text-xs mt-1 tracking-widest uppercase">Loading System</p>
        <div className="mt-5 w-32 h-1 rounded-full overflow-hidden bg-white/5">
          <div className="h-full progress-bar" style={{ animation: "shimmer 1.5s linear infinite", width: "100%" }} />
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════
  // 3D FLIP LOGIN CARD
  // ═══════════════════════════════════════════════════════════════
  if (!user) return (
    <div className={`min-h-screen ${theme === "dark" ? "bg-[#05050a]" : "bg-gray-50"} flex items-center justify-center p-4 overflow-hidden`}>
      <Toasts toasts={toasts} />
      
      {/* VISIBLE Floating Orb Particles */}
      <div className="scene-orb scene-orb-1" style={{ top: "15%", left: "18%" }} />
      <div className="scene-orb scene-orb-2" style={{ top: "25%", right: "22%" }} />
      <div className="scene-orb scene-orb-3" style={{ bottom: "25%", left: "12%" }} />
      <div className="scene-orb scene-orb-4" style={{ top: "55%", right: "15%" }} />
      <div className="scene-orb scene-orb-1" style={{ bottom: "15%", right: "25%" }} />
      <div className="scene-orb scene-orb-2" style={{ top: "45%", left: "8%" }} />
      
      {/* Big ambient glow orbs — VERY visible */}
      <div className="absolute top-1/4 -left-20 w-[400px] h-[400px] bg-indigo-500/20 rounded-full blur-[80px]" style={{ animation: "float-slow 8s ease-in-out infinite" }} />
      <div className="absolute bottom-1/4 -right-20 w-[450px] h-[450px] bg-purple-500/15 rounded-full blur-[90px]" style={{ animation: "float-reverse 10s ease-in-out infinite" }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-br from-indigo-600/10 via-purple-600/8 to-pink-500/5 rounded-full blur-[100px]" />

      {/* 3D Flip Card Container */}
      <div className="perspective-1000 w-full max-w-sm sm:max-w-md animate-fade-in-up relative z-10">
        <div className={`flip-card preserve-3d relative w-full ${isFlipped ? "flipped" : ""}`} style={{ minHeight: "530px" }}>
          
          {/* ═══ FRONT: SIGN IN ═══ */}
          <div className="backface-hidden absolute inset-0 w-full">
            <div className="glass-strong rounded-2xl sm:rounded-3xl p-5 sm:p-7 h-full flex flex-col" style={{ boxShadow: "0 40px 100px -25px rgba(0,0,0,0.7), 0 0 60px rgba(99,102,241,0.1), 0 0 0 1px rgba(99,102,241,0.08)" }}>
              {/* Top shine */}
              <div className="absolute top-0 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-indigo-400/30 to-transparent" />
              <div className="text-center mb-5">
                <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center mx-auto animate-pulse-glow">
                  <Icon name="logo" size={34} />
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold mt-4 tracking-tight bg-gradient-to-r from-white via-indigo-200 to-purple-300 bg-clip-text text-transparent" style={{ textShadow: "0 0 40px rgba(99,102,241,0.3)" }}>FleekTrack</h1>
                <p className="text-zinc-500 text-xs mt-1 tracking-wide">Warehouse Management System</p>
              </div>

              <form onSubmit={login} className="space-y-3">
                <div>
                  <label className="text-zinc-400 text-[11px] font-medium flex items-center gap-1.5 mb-1"><Icon name="mail" size={12} /> Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field w-full px-4 py-2.5 rounded-xl text-sm" placeholder="you@company.com" autoFocus />
                </div>
                <div>
                  <label className="text-zinc-400 text-[11px] font-medium flex items-center gap-1.5 mb-1"><Icon name="lock" size={12} /> Password</label>
                  <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} className="input-field w-full px-4 py-2.5 rounded-xl text-sm" placeholder="••••••••" />
                </div>
                {loginErr && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-red-400 text-xs flex items-center gap-2 animate-fade-in"><Icon name="x" size={14} /> {loginErr}</div>
                )}
                <button type="submit" disabled={loginSub} className="btn-primary w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                  {loginSub ? <><Spinner size={16} /> <span>Signing in...</span></> : <span>Sign In</span>}
                </button>
              </form>

              {/* Flip trigger — OUTSIDE form */}
              <div className="mt-auto pt-5 border-t border-white/5 text-center">
                <p className="text-zinc-500 text-xs">Don&apos;t have an account?</p>
                <button type="button" onClick={() => setIsFlipped(true)} className="text-indigo-400 hover:text-indigo-300 text-sm font-medium mt-1 transition-colors">
                  Request Access →
                </button>
              </div>
            </div>
          </div>

          {/* ═══ BACK: REQUEST ACCESS ═══ */}
          <div className="backface-hidden absolute inset-0 w-full rotate-y-180">
            <div className="glass-strong rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-2xl h-full flex flex-col">
              {reqSent ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center animate-scale-in">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mb-4 shadow-2xl shadow-emerald-500/30">
                    <Icon name="checkmark" size={32} />
                  </div>
                  <h2 className="text-lg font-bold text-white">Request Submitted!</h2>
                  <p className="text-zinc-400 text-xs mt-2 max-w-xs">We&apos;ll review your request and get back to you within 24 hours.</p>
                  <button type="button" onClick={() => { setIsFlipped(false); setReqSent(false); setReqEmail(""); setReqName(""); setReqMsg(""); }} className="btn-ghost mt-6 px-5 py-2 rounded-xl text-sm font-medium">
                    ← Back to Sign In
                  </button>
                </div>
              ) : (
                <>
                  <div className="text-center mb-4">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mx-auto shadow-2xl shadow-purple-500/30">
                      <Icon name="user" size={28} />
                    </div>
                    <h2 className="text-lg sm:text-xl font-bold text-white mt-3">Request Access</h2>
                    <p className="text-zinc-500 text-xs mt-0.5">Get your account credentials</p>
                  </div>

                  <form onSubmit={handleRequestAccess} className="space-y-3">
                    <div>
                      <label className="text-zinc-400 text-[11px] font-medium mb-1 block">Full Name</label>
                      <input type="text" value={reqName} onChange={(e) => setReqName(e.target.value)} className="input-field w-full px-4 py-2.5 rounded-xl text-sm" placeholder="John Doe" required />
                    </div>
                    <div>
                      <label className="text-zinc-400 text-[11px] font-medium mb-1 block">Work Email</label>
                      <input type="email" value={reqEmail} onChange={(e) => setReqEmail(e.target.value)} className="input-field w-full px-4 py-2.5 rounded-xl text-sm" placeholder="john@company.com" required />
                    </div>
                    <div>
                      <label className="text-zinc-400 text-[11px] font-medium mb-1 block">Message <span className="text-zinc-600">(optional)</span></label>
                      <textarea value={reqMsg} onChange={(e) => setReqMsg(e.target.value)} className="input-field w-full px-4 py-2.5 rounded-xl text-sm resize-none h-16" placeholder="Why do you need access?" />
                    </div>
                    <button type="submit" className="btn-primary w-full py-3 rounded-xl text-sm font-semibold">
                      <span>Submit Request</span>
                    </button>
                  </form>

                  {/* Back button — OUTSIDE form */}
                  <div className="mt-auto pt-5 border-t border-white/5 text-center">
                    <button type="button" onClick={() => setIsFlipped(false)} className="text-zinc-400 hover:text-white text-sm font-medium transition-colors">
                      ← Back to Sign In
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className="absolute top-4 right-4 p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
        title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
      >
        <Icon name={theme === "dark" ? "sun" : "moon"} size={18} />
      </button>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════
  // 3PL SCANNER VIEW — 3 TABS: Scanner, History, Extras
  // ═══════════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════
  // SELLER VIEW
  // ═══════════════════════════════════════════════════════════════
   if (user.role === "seller" || (["admin", "manager"].includes(user.role) && viewAs === "seller")) return (
    <div className={`min-h-screen ${theme === "dark" ? "bg-[#05050a]" : "bg-gray-50"} flex flex-col`}>
      <Toasts toasts={toasts} />
      {/* Floating orbs */}
      {theme === "dark" && <>
        <div className="scene-orb scene-orb-1" style={{ top: "15%", left: "8%" }} />
        <div className="scene-orb scene-orb-3" style={{ bottom: "20%", right: "10%" }} />
      </>}
      <header className="glass border-b border-white/5 px-3 sm:px-4 py-3 sm:py-4 relative">
        <div className="header-glow-line" />
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20"><Icon name="logo" size={20} /></div>
            <div><h1 className="text-white font-bold text-sm sm:text-base">FleekTrack</h1><p className="text-zinc-400 text-xs sm:text-sm">Seller Portal · <span className="text-white font-semibold">{user.name}</span></p></div>
          </div>
          <div className="flex items-center gap-2">
            {["admin", "manager"].includes(user.role) && (
              <button onClick={() => setViewAs("fleek")} className="bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all">
                ← Fleek Tool
              </button>
            )}
            <div className="live-badge hidden sm:flex"><span className="live-dot"></span><span>Live</span></div>
            <button onClick={toggleTheme} className="btn-ghost p-2 rounded-lg"><Icon name={theme === "dark" ? "sun" : "moon"} size={16} /></button>
            <button onClick={logout} className="btn-ghost px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5"><Icon name="logout" size={14} /> Logout</button>
          </div>
        </div>
      </header>
      <div className="max-w-6xl mx-auto w-full px-3 sm:px-4 lg:px-6 mt-3">
        <nav className="flex gap-0.5 sm:gap-1 bg-white/[0.03] p-1 sm:p-1.5 rounded-xl border border-white/5 overflow-x-auto w-full sm:w-fit">
          {[{ k: "entry", label: "Order Entry", icon: "box" }, { k: "details", label: "Details", icon: "search" }, { k: "upload", label: "CSV Upload", icon: "upload" }, { k: "qrcodes", label: "QR Codes", icon: "qr" }, { k: "history", label: "History", icon: "check" }].map((t) => (
            <button key={t.k} onClick={() => setSellerTab(t.k as "upload" | "entry" | "details" | "qrcodes" | "history")} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${sellerTab === t.k ? "bg-purple-500/20 text-purple-400" : "text-zinc-400 hover:text-white"}`}><Icon name={t.icon} size={14} /> {t.label}</button>
          ))}
        </nav>
        
        {/* Compact filter row */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {["admin", "manager"].includes(user.role) && <span className="text-purple-400 text-[10px] font-bold bg-purple-500/10 px-2 py-0.5 rounded shrink-0">👑 ALL SELLERS</span>}
          <div className="flex items-center gap-1.5 flex-1 min-w-0 flex-wrap">
            <input type="date" value={adminSellerDateFrom} onChange={e => { setAdminSellerDateFrom(e.target.value); if (e.target.value > adminSellerDateTo) setAdminSellerDateTo(e.target.value); }} className="input-field px-2 py-1.5 rounded-lg text-[11px] w-[120px]" />
            <span className="text-zinc-600 text-[10px]">→</span>
            <input type="date" value={adminSellerDateTo} onChange={e => setAdminSellerDateTo(e.target.value)} className="input-field px-2 py-1.5 rounded-lg text-[11px] w-[120px]" />
            {["admin", "manager"].includes(user.role) && (
              <select value={adminSellerVendorFilter} onChange={e => setAdminSellerVendorFilter(e.target.value)} className="input-field px-2 py-1.5 rounded-lg text-[11px] w-[130px]">
                <option value="all">All Sellers</option>
                {adminSellerVendors.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            )}
            <button onClick={() => loadSellerData()} className="bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all shrink-0">Load</button>
          </div>
        </div>
      </div>
      <div className="flex-1 flex flex-col p-3 sm:p-4 lg:p-6 max-w-6xl mx-auto w-full gap-3 sm:gap-4">
                {sellerTab === "entry" && (
          <div className="space-y-3 animate-fade-in-up">
            <div className="card-static overflow-hidden">
              <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h3 className="seller-heading font-semibold text-sm">Order Entry</h3>
                  <p className="text-zinc-500 text-[10px]">1 box = 1 or multiple orders</p>
                </div>
                <button onClick={addBoxRow} className="btn-ghost px-3 py-1.5 rounded-lg text-xs flex items-center gap-1">
                  <span className="text-lg leading-none">+</span> Add Box
                </button>
              </div>
              
              <div className="divide-y divide-white/5 max-h-[55vh] overflow-y-auto">
                {boxEntries.map((box, bIdx) => (
                  <div key={box.id} className="px-3 py-3">
                    {/* Box header */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-indigo-400 text-[10px] font-bold bg-indigo-500/10 px-2 py-0.5 rounded">BOX {bIdx + 1}</span>
                      <button 
                        onClick={() => toggleMulti(box.id)} 
                        className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${box.isMulti ? "bg-purple-500/25 text-purple-300 border border-purple-500/40 shadow-sm shadow-purple-500/20" : "bg-white/8 text-zinc-400 hover:text-purple-300 hover:bg-purple-500/10 border border-white/12"}`}
                      >
                        {box.isMulti ? "✓ Multi Order" : "Multi Order"}
                      </button>
                      {boxEntries.length > 1 && (
                        <button onClick={() => removeBoxRow(box.id)} className="text-red-400 hover:text-red-300 text-[10px] ml-auto">Remove</button>
                      )}
                    </div>

                    {/* Orders in this box */}
                    {box.orders.map((order, oIdx) => (
                      <div key={order.oid} className="flex gap-2 items-center mb-1.5">
                        <div className="flex-1 min-w-0">
                          <input
                            type="text"
                            value={order.orderId}
                            onChange={(e) => handleOrderIdChange(box.id, order.oid, e.target.value)}
                            className="input-field w-full px-2 py-1.5 rounded-lg text-xs font-mono"
                            placeholder={oIdx === 0 ? "Order ID (159357/22)" : "Another order..."}
                          />
                        </div>
                        <div className="w-16 shrink-0">
                          <input
                            type="text"
                            value={order.pieces}
                            onChange={(e) => setBoxEntries(prev => prev.map(b => b.id === box.id ? { ...b, orders: b.orders.map(o => o.oid === order.oid ? { ...o, pieces: e.target.value } : o) } : b))}
                            className="input-field w-full px-2 py-1.5 rounded-lg text-xs text-center"
                            placeholder="Pcs"
                          />
                        </div>
                        <div className="w-36 shrink-0">
                          {order.searching ? (
                            <div className="seller-status-checking flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 shadow-sm"><Spinner size={10} /><span className="text-[10px] font-semibold">Checking...</span></div>
                          ) : order.status ? (
                            <div className={`seller-status-box rounded-lg px-2.5 py-1.5 border text-[10px] leading-tight shadow-sm ${order.status === "Not found" || order.status === "Error" ? "seller-status-error" : "seller-status-success"}`}>
                              <div className="font-bold text-[10px] truncate tracking-[0.2px]">{order.status}</div>
                              {order.vendor ? <div className="seller-status-vendor text-[9px] font-medium truncate mt-0.5">{order.vendor}</div> : null}
                            </div>
                          ) : <div className="seller-status-empty rounded-lg px-2.5 py-1.5 text-[10px] font-medium text-center">Pending</div>}
                        </div>
                        {box.isMulti && box.orders.length > 1 && (
                          <button onClick={() => removeOrderFromBox(box.id, order.oid)} className="text-red-400 text-xs shrink-0">×</button>
                        )}
                      </div>
                    ))}

                    {/* Add another order to this box */}
                    {box.isMulti && (
                      <button onClick={() => addOrderToBox(box.id)} className="text-purple-400 text-[10px] hover:text-purple-300 flex items-center gap-1 mt-1 mb-2">
                        <span className="text-sm leading-none">+</span> Add order to this box
                      </button>
                    )}

                    {/* Box details: boxNo, weight, dimensions */}
                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 mt-2">
                      <input type="text" value={box.boxNo} onChange={(e) => updateBoxField(box.id, "boxNo", e.target.value)} className="input-field px-2 py-1.5 rounded-lg text-xs text-center" placeholder="Box#" />
                      <input type="number" step="0.01" value={box.weight} onChange={(e) => updateBoxField(box.id, "weight", e.target.value)} className="input-field px-2 py-1.5 rounded-lg text-xs text-center" placeholder="Wt" />
                      <input type="number" step="0.1" value={box.height} onChange={(e) => updateBoxField(box.id, "height", e.target.value)} className="input-field px-2 py-1.5 rounded-lg text-xs text-center" placeholder="H" />
                      <input type="number" step="0.1" value={box.length} onChange={(e) => updateBoxField(box.id, "length", e.target.value)} className="input-field px-2 py-1.5 rounded-lg text-xs text-center" placeholder="L" />
                      <input type="number" step="0.1" value={box.width} onChange={(e) => updateBoxField(box.id, "width", e.target.value)} className="input-field px-2 py-1.5 rounded-lg text-xs text-center" placeholder="W" />
                      <div className="text-purple-400 text-[10px] font-bold text-center bg-purple-500/10 rounded-lg py-1.5">
                        {box.dimWeight || "0"}
                      </div>
                      <div className="text-zinc-600 text-[9px] flex items-center justify-center">DimWt</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between">
                <p className="text-zinc-600 text-[10px]">Dim = (H×L×W) / 5000</p>
                <div className="flex gap-2">
                  <button onClick={addBoxRow} className="btn-ghost px-3 py-2 rounded-lg text-xs">+ Add Box</button>
                  <button onClick={saveAllEntries} disabled={entrySaving || !boxEntries.some(b => b.orders.some(o => o.orderId.trim()) && b.boxNo.trim())} className="btn-primary px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 disabled:opacity-40">
                    {entrySaving ? <><Spinner size={14} /> Saving...</> : <>Save All</>}
                  </button>
                </div>
              </div>
            </div>

            {/* Today's entries */}
            {groupedSellerDetails.length > 0 && (
              <div className="card-static overflow-hidden">
                <div className="px-4 py-2.5 border-b border-white/5 flex items-center justify-between">
                  <h3 className="seller-heading font-semibold text-xs">Today ({groupedSellerDetails.length} boxes)</h3>
                  <button onClick={() => setSellerTab("details")} className="text-purple-400 text-[10px]">View All →</button>
                </div>
                <div className="overflow-x-auto max-h-[150px]">
                  <table className="w-full text-[10px]">
                    <thead className="sticky top-0 bg-[#13131a]"><tr className="border-b border-white/5"><th className="px-2 py-1.5 text-left text-zinc-400 font-medium">Order</th><th className="px-2 py-1.5 text-left text-zinc-400 font-medium">Box</th><th className="px-2 py-1.5 text-left text-zinc-400 font-medium">Pcs</th><th className="px-2 py-1.5 text-left text-zinc-400 font-medium">Wt</th><th className="px-2 py-1.5 text-left text-zinc-400 font-medium">Date &amp; Time</th></tr></thead>
                    <tbody className="divide-y divide-white/5">
                      {groupedSellerDetails.slice(0, 10).map((d, i) => (
                        <tr key={i}><td className="px-2 py-1 text-purple-400 font-mono font-semibold">{d.fleekId}</td><td className="px-2 py-1 text-white">{d.boxNo}</td><td className="px-2 py-1 text-zinc-400">{d.pieces || "—"}</td><td className="px-2 py-1 text-zinc-400">{d.weight || "—"}</td><td className="px-2 py-1 text-zinc-500">{fmtDt(d.createdAt || d.uploadDate)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {sellerTab === "details" && (
          <div className="space-y-3 animate-fade-in-up">
            {/* Search bar only — date filter is in the top bar */}
            <div className="flex gap-2">
              <input 
                type="text" 
                value={sellerSearch} 
                onChange={(e) => setSellerSearch(e.target.value)} 
                placeholder="Search by Order ID..." 
                className="input-field flex-1 px-3 py-2 rounded-xl text-sm font-mono" 
              />
              {sellerSearch && (
                <button onClick={() => setSellerSearch("")} className="btn-ghost px-3 py-2 rounded-xl text-xs">Clear</button>
              )}
            </div>

            {/* Summary */}
            {groupedSellerDetails.length > 0 && (() => {
              const filtered = sellerSearch.trim() 
                ? groupedSellerDetails.filter(d => d.fleekId.toLowerCase().includes(sellerSearch.trim().toLowerCase().replace(/\//g, "_")))
                : groupedSellerDetails;
              const uniqueOrders = new Set(
                filtered.flatMap((d) => d.fleekId.split(",").map((x) => x.trim()).filter(Boolean))
              ).size;
              return (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="card-static p-3 text-center">
                      <p className="text-xl font-bold text-purple-400">{uniqueOrders}</p>
                      <p className="text-zinc-500 text-[10px]">Orders</p>
                    </div>
                    <div className="card-static p-3 text-center">
                      <p className="text-xl font-bold text-indigo-400">{filtered.length}</p>
                      <p className="text-zinc-500 text-[10px]">Boxes</p>
                    </div>
                    <div className="card-static p-3 text-center">
                      <p className="text-xl font-bold text-emerald-400">{filtered.reduce((s, d) => s + (parseFloat(d.weight || "0") || 0), 0).toFixed(2)}</p>
                      <p className="text-zinc-500 text-[10px]">Total Wt (kg)</p>
                    </div>
                  </div>

                  <div className="card-static overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-white/5 flex items-center justify-between">
                      <h3 className="seller-heading font-semibold text-xs">
                        Entries {sellerSearch && <span className="text-zinc-500">— filtered</span>}
                      </h3>
                      <span className="text-zinc-500 text-[10px]">{filtered.length} boxes</span>
                    </div>
                    <div className="overflow-x-auto max-h-[60vh]">
                      <table className="w-full text-[11px]">
                        <thead className="sticky top-0 bg-[#13131a]">
                          <tr className="border-b border-white/5">
                            {["admin", "manager"].includes(user.role) && <th className="px-3 py-2 text-left text-zinc-400 font-medium">Seller</th>}
                            <th className="px-3 py-2 text-left text-zinc-400 font-medium">Order ID</th>
                            <th className="px-3 py-2 text-left text-zinc-400 font-medium">Box</th>
                            <th className="px-3 py-2 text-left text-zinc-400 font-medium">Pcs</th>
                            <th className="px-3 py-2 text-left text-zinc-400 font-medium">Weight</th>
                            <th className="px-3 py-2 text-left text-zinc-400 font-medium hidden sm:table-cell">H</th>
                            <th className="px-3 py-2 text-left text-zinc-400 font-medium hidden sm:table-cell">L</th>
                            <th className="px-3 py-2 text-left text-zinc-400 font-medium hidden sm:table-cell">W</th>
                            <th className="px-3 py-2 text-left text-zinc-400 font-medium">Dim Wt</th>
                            <th className="px-3 py-2 text-left text-zinc-400 font-medium">Date &amp; Time</th>
                            {["admin", "manager"].includes(user.role) && <th className="px-3 py-2 w-8"></th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {filtered.map((d, i) => (
                            <tr key={i} className="hover:bg-white/[0.02]">
                              {["admin", "manager"].includes(user.role) && <td className="px-3 py-2 text-indigo-400 text-[10px] font-semibold">{d.vendor || d.sellerName || "—"}</td>}
                              <td className="px-3 py-2 text-purple-400 font-mono font-semibold">{d.fleekId}</td>
                              <td className="px-3 py-2 text-white">{d.boxNo}</td>
                              <td className="px-3 py-2 text-zinc-400">{d.pieces || "—"}</td>
                              <td className="px-3 py-2 text-zinc-300 font-medium">{d.weight || "—"}</td>
                              <td className="px-3 py-2 text-zinc-500 hidden sm:table-cell">{d.height || "—"}</td>
                              <td className="px-3 py-2 text-zinc-500 hidden sm:table-cell">{d.length || "—"}</td>
                              <td className="px-3 py-2 text-zinc-500 hidden sm:table-cell">{d.width || "—"}</td>
                              <td className="px-3 py-2 text-zinc-400">{d.dimensionalWeight || "—"}</td>
                              <td className="px-3 py-2 text-zinc-500 text-[10px]">{fmtDt(d.createdAt || d.uploadDate)}</td>
                              {["admin", "manager"].includes(user.role) && <td className="px-3 py-2"><button onClick={() => deleteSellerEntry(d.id)} className="text-red-400 hover:text-red-300 text-xs transition-colors" title="Delete entry">✕</button></td>}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              );
            })()}
            
            {groupedSellerDetails.length === 0 && (
              <div className="card-static p-10 text-center">
                <p className="text-zinc-600 text-sm">No entries found</p>
                <p className="text-zinc-700 text-xs mt-1">
                  {["admin", "manager"].includes(user.role) 
                    ? "No seller entries for selected filters. Try changing the date range." 
                    : "Add orders via Order Entry or CSV Upload"}
                </p>
              </div>
            )}
          </div>
        )}

        {sellerTab === "upload" && (
          <div className="space-y-4 animate-fade-in-up">
            <div className="card-static p-4"><div className="flex items-center justify-between"><div><h3 className="seller-heading font-semibold text-sm">Download Template</h3><p className="text-zinc-500 text-xs mt-0.5">Get the CSV format for GD details</p></div><button onClick={downloadSellerTemplate} className="btn-primary px-4 py-2 rounded-xl text-xs"><span>Download CSV Template</span></button></div></div>
            <div className="card-static overflow-hidden">
              <div className="px-4 py-3 border-b border-white/5"><h3 className="seller-heading font-semibold text-sm">Upload GD Details CSV</h3><p className="text-zinc-500 text-[10px] mt-0.5">Vendor: {user.name}</p></div>
              <div className="p-4">
                <input ref={sellerFileRef} type="file" accept=".csv" onChange={(e) => e.target.files?.[0] && uploadSellerCSV(e.target.files[0])} className="hidden" disabled={sellerUploading} />
                <button onClick={() => sellerFileRef.current?.click()} disabled={sellerUploading} className={`w-full py-6 rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-2 ${sellerUploading ? "border-purple-500/40 bg-purple-500/5" : "border-white/10 hover:border-purple-500/30 text-zinc-400 hover:text-purple-400"}`}>
                  {sellerUploading ? <><Spinner size={24} /><span className="text-purple-400 text-sm">Uploading...</span></> : <><Icon name="upload" size={28} /><span className="text-sm font-medium">Click to select CSV file</span><span className="text-zinc-600 text-[10px]">Columns: Fleek ID, Box no, Pieces, Weight, Height, Length, Width</span></>}
                </button>
              </div>
            </div>
            {sellerResult && (<div className="card-static p-4 bg-purple-500/5 border border-purple-500/20"><h3 className="text-purple-400 font-semibold text-sm mb-3">Upload Successful!</h3><div className="grid grid-cols-2 gap-3"><div className="bg-white/5 rounded-xl p-3 text-center"><p className="text-2xl font-bold text-white">{sellerResult.totalOrders}</p><p className="text-zinc-500 text-[10px] mt-0.5">Unique Orders</p></div><div className="bg-white/5 rounded-xl p-3 text-center"><p className="text-2xl font-bold text-white">{sellerResult.totalBoxes}</p><p className="text-zinc-500 text-[10px] mt-0.5">Total Boxes</p></div></div><p className="text-zinc-500 text-xs mt-3 text-center">Vendor: {sellerResult.vendor} · Date: {sellerResult.date}</p>{sellerQrCodes.length > 0 && <button onClick={() => setSellerTab("qrcodes")} className="w-full mt-3 bg-purple-500/20 text-purple-400 py-2 rounded-xl text-xs font-medium">View & Download QR Codes →</button>}</div>)}
            {groupedSellerDetails.length > 0 && (<div className="card-static overflow-hidden"><div className="px-4 py-3 border-b border-white/5"><h3 className="seller-heading font-semibold text-sm">Today's Submissions ({groupedSellerDetails.length} boxes)</h3></div><div className="overflow-x-auto max-h-[300px]"><table className="w-full text-xs"><thead className="sticky top-0 bg-[#13131a]"><tr className="border-b border-white/5"><th className="px-3 py-2 text-left text-zinc-400 font-medium">Fleek ID</th><th className="px-3 py-2 text-left text-zinc-400 font-medium">Box No</th><th className="px-3 py-2 text-left text-zinc-400 font-medium">Pieces</th><th className="px-3 py-2 text-left text-zinc-400 font-medium">Weight</th><th className="px-3 py-2 text-left text-zinc-400 font-medium">Date &amp; Time</th></tr></thead><tbody className="divide-y divide-white/5">{groupedSellerDetails.slice(0, 50).map((d, i) => (<tr key={i} className="hover:bg-white/[0.02]"><td className="px-3 py-2 text-purple-400 font-mono font-semibold">{d.fleekId}</td><td className="px-3 py-2 text-white">{d.boxNo}</td><td className="px-3 py-2 text-zinc-400">{d.pieces || "—"}</td><td className="px-3 py-2 text-zinc-400">{d.weight || "—"}</td><td className="px-3 py-2 text-zinc-500 text-[10px]">{fmtDt(d.createdAt || d.uploadDate)}</td></tr>))}</tbody></table></div></div>)}
          </div>
        )}
        {sellerTab === "qrcodes" && (
          <div className="space-y-4 animate-fade-in-up">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="seller-heading font-semibold text-sm">QR Codes ({sellerQrCodes.length})</h2>
                {sellerQrSel.size > 0 && <p className="text-emerald-400 text-xs font-semibold">✓ {sellerQrSel.size} selected</p>}
              </div>
              <div className="flex gap-2 flex-wrap">
                {sellerQrSel.size > 0 && <button onClick={printSellerQRs} className="btn-primary px-4 py-2 rounded-xl text-xs flex items-center gap-1.5"><span>🖨️ Print ({sellerQrSel.size})</span></button>}
                {sellerQrSel.size > 0 && ["admin", "manager"].includes(user.role) && <button onClick={() => { if (confirm(`Delete ${sellerQrSel.size} selected QR code(s)?`)) { setSellerQrCodes(prev => prev.filter((_, i) => !sellerQrSel.has(i))); setSellerQrSel(new Set()); toast("QR codes removed", "success"); }}} className="bg-red-500/20 text-red-400 hover:bg-red-500/30 px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all"><span>🗑️ Delete ({sellerQrSel.size})</span></button>}
                {sellerQrCodes.length > 0 && <button onClick={() => setSellerQrSel(sellerQrSel.size === sellerQrCodes.length ? new Set() : new Set(sellerQrCodes.map((_, i) => i)))} className="btn-ghost px-3 py-2 rounded-xl text-xs">{sellerQrSel.size === sellerQrCodes.length ? "Deselect All" : "Select All"}</button>}
                {sellerQrCodes.length > 0 && <button onClick={dlAllSellerQr} className="btn-ghost px-3 py-2 rounded-xl text-xs"><span>⬇ Download All</span></button>}
              </div>
            </div>
            <p className="text-zinc-500 text-xs">Tap QR cards to select → Print or Download</p>
            {sellerQrCodes.length === 0 ? (
              <div className="card-static p-10 text-center"><p className="text-zinc-600 text-sm">No QR codes available</p></div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {sellerQrCodes.map((q, i) => {
                  const isSelected = sellerQrSel.has(i);
                  return (
                    <div
                      key={i}
                      onClick={() => { const n = new Set(sellerQrSel); n.has(i) ? n.delete(i) : n.add(i); setSellerQrSel(n); }}
                      className={`relative qr-card p-3 flex flex-col items-center cursor-pointer transition-all duration-200 rounded-xl border-2 ${
                        isSelected
                          ? "border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20 scale-[1.02]"
                          : "border-transparent hover:border-purple-500/30 hover:shadow-md"
                      }`}
                    >
                      {/* Selection checkmark */}
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center shadow-lg z-10">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </div>
                      )}
                      {/* Unselected circle */}
                      {!isSelected && (
                        <div className="absolute top-1.5 right-1.5 w-6 h-6 border-2 border-gray-300 rounded-full opacity-40" />
                      )}
                      <img src={q.qrImageData} alt="" className="w-24 h-24 object-contain" />
                      <p className="mt-2 text-gray-900 font-mono text-[10px] font-semibold text-center break-all">{q.fleekId}</p>
                      <button
                        onClick={(e) => { e.stopPropagation(); dlSellerQr(q.qrImageData, q.fleekId); }}
                        className="mt-2 bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-medium px-3 py-1 rounded transition-colors"
                      >
                        ⬇ Download
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {sellerTab === "history" && (() => {
          const filtered = sellerHistory.filter(h => {
            const d = (h.createdAt || h.uploadDate || "").slice(0, 10);
            if (sellerHistFrom && d < sellerHistFrom) return false;
            if (sellerHistTo && d > sellerHistTo) return false;
            return true;
          });
          return (
          <div className="space-y-4 animate-fade-in-up">
            <div className="flex items-center justify-between">
              <h2 className="seller-heading font-semibold text-sm">Upload History</h2>
              <p className="text-zinc-500 text-[10px]">Use top date filter to change range</p>
            </div>
            {filtered.length === 0 ? (<div className="card-static p-10 text-center"><p className="text-zinc-600 text-sm">{sellerHistory.length > 0 ? "No results for selected dates" : "No upload history"}</p></div>) : (<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{filtered.map((h) => (<div key={h.id} className="card-static p-4"><div className="flex items-center justify-between"><div><p className="text-purple-400 font-semibold text-sm">{h.vendor}</p><p className="text-zinc-500 text-xs mt-0.5">{fmtDt(h.createdAt || h.uploadDate)}</p></div><div className="text-right"><p className="text-white font-bold">{h.totalOrders} orders</p><p className="text-zinc-500 text-xs">{h.totalBoxes} boxes</p></div></div></div>))}</div>)}
          </div>
          );
        })()}
      </div>
      <footer className="max-w-6xl mx-auto px-3 py-4 border-t border-white/5 w-full"><p className="text-center text-zinc-600 text-[10px] flex items-center justify-center gap-1.5"><Icon name="shield" size={12} /> FleekTrack — Seller Portal</p></footer>
    </div>
  );


  if (user.role.startsWith("3pl") || (["admin", "manager"].includes(user.role) && viewAs === "3pl")) return (
    <div className={`min-h-screen ${theme === "dark" ? "bg-[#05050a]" : "bg-gray-50"} flex flex-col`}>
      <Toasts toasts={toasts} />
      {/* Floating orbs */}
      {theme === "dark" && <>
        <div className="scene-orb scene-orb-2" style={{ top: "20%", right: "12%" }} />
        <div className="scene-orb scene-orb-4" style={{ bottom: "25%", left: "8%" }} />
      </>}

      {/* Header */}
      <header className="glass border-b border-white/5 px-3 sm:px-4 py-3 animate-fade-in-down relative">
        <div className="header-glow-line" />
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shrink-0" style={{ boxShadow: "0 0 20px rgba(99,102,241,0.35), 0 0 40px rgba(139,92,246,0.15)" }}><Icon name="logo" size={18} /></div>
            <div><h1 className="text-white font-bold text-sm sm:text-base">FleekTrack</h1><p className="text-zinc-400 text-xs sm:text-sm">{user.role === "3pl_ecl" ? "ECL Receiving" : user.role === "3pl_ge" ? "GE Receiving" : "3PL Receiving"} · <span className="text-white font-semibold">{user.name}</span></p></div>
          </div>
          <div className="flex items-center gap-2">
            {["admin", "manager"].includes(user.role) && (
              <button onClick={() => setViewAs("fleek")} className="bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all">
                ← Fleek Tool
              </button>
            )}
            <div className="live-badge hidden sm:flex"><span className="live-dot"></span><span>Live</span></div>
            <button onClick={toggleTheme} className="btn-ghost p-2 rounded-lg"><Icon name={theme === "dark" ? "sun" : "moon"} size={16} /></button>
            <button onClick={logout} className="btn-ghost px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5"><Icon name="logout" size={14} /> Logout</button>
          </div>
        </div>
      </header>

      {/* 3PL Tabs */}
      <div className="max-w-6xl mx-auto w-full px-3 sm:px-4 lg:px-6 pt-3">
        <nav className="flex gap-1 bg-white/[0.02] p-1 rounded-xl border border-white/5 w-full sm:w-fit">
          {([{ k: "gd" as const, label: "Pending", icon: "box" }, { k: "scan" as const, label: "Scanner", icon: "qr" }, { k: "history" as const, label: "History", icon: "check" }, { k: "extras" as const, label: "Extras", icon: "box" }]).map((t) => (
            <button key={t.k} onClick={() => { setPlTab(t.k); if (t.k === "history") getLogs(); if (t.k === "extras") loadExtras(); if (t.k === "gd") load3plOrders(); }} className={`tab-item flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-lg text-xs font-medium ${plTab === t.k ? "active" : ""}`}>
              <Icon name={t.icon} size={14} /> {t.label}
            </button>
          ))}
        </nav>
        
        {/* Compact filter row */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {["admin", "manager"].includes(user.role) 
            ? <span className="text-emerald-400 text-[10px] font-bold bg-emerald-500/10 px-2 py-0.5 rounded shrink-0">👑 ECL + GE</span>
            : <span className="text-emerald-400 text-[10px] font-bold bg-emerald-500/10 px-2 py-0.5 rounded shrink-0">📊 ALL DATA</span>
          }
          <div className="flex items-center gap-1.5 flex-1 min-w-0 flex-wrap">
            <input type="date" value={admin3plDateFrom} onChange={e => { setAdmin3plDateFrom(e.target.value); if (e.target.value > admin3plDateTo) setAdmin3plDateTo(e.target.value); }} className="input-field px-2 py-1.5 rounded-lg text-[11px] w-[120px]" />
            <span className="text-zinc-600 text-[10px]">→</span>
            <input type="date" value={admin3plDateTo} onChange={e => setAdmin3plDateTo(e.target.value)} className="input-field px-2 py-1.5 rounded-lg text-[11px] w-[120px]" />
            {["admin", "manager"].includes(user.role) && (
              <select value={admin3plFilter} onChange={e => setAdmin3plFilter(e.target.value)} className="input-field px-2 py-1.5 rounded-lg text-[11px] w-[100px]">
                <option value="all">All 3PLs</option>
                <option value="3pl_ecl">ECL</option>
                <option value="3pl_ge">GE</option>
                <option value="unassigned">Unassigned</option>
              </select>
            )}
            <select value={admin3plVendorFilter} onChange={e => setAdmin3plVendorFilter(e.target.value)} className="input-field px-2 py-1.5 rounded-lg text-[11px] w-[120px]">
              <option value="all">All Vendors</option>
              {admin3plVendors.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <button onClick={() => load3plOrders()} className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all shrink-0">Load</button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col p-3 sm:p-4 lg:p-6 max-w-6xl mx-auto w-full gap-3 sm:gap-4">


        {/* ═══ GD PENDING TAB ═══ */}
        {plTab === "gd" && (<>
          {/* Orders Summary */}
           <div className="card-static p-4 sm:p-5 lg:p-6 mb-3">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold text-sm sm:text-base">
                {["admin", "manager"].includes(user.role) ? "All 3PL Orders" : "Your Assigned Orders"}
              </h3>
              <button onClick={() => load3plOrders()} className="btn-ghost px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5"><Icon name="refresh" size={14} /> <span className="hidden sm:inline">Refresh</span></button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="bg-amber-500/10 rounded-xl p-3 text-center border border-amber-500/20">
                <p className="text-2xl font-bold text-amber-400">{plTotals.pendingOrders}</p>
                <p className="text-amber-400/70 text-[10px]">Pending Orders</p>
              </div>
              <div className="bg-amber-500/10 rounded-xl p-3 text-center border border-amber-500/20">
                <p className="text-2xl font-bold text-amber-400">{plTotals.pendingBoxes}</p>
                <p className="text-amber-400/70 text-[10px]">Pending Boxes</p>
              </div>
              <div className="bg-emerald-500/10 rounded-xl p-3 text-center border border-emerald-500/20">
                <p className="text-2xl font-bold text-emerald-400">{plTotals.receivedBoxes}</p>
                <p className="text-emerald-400/70 text-[10px]">Received</p>
              </div>
              <div className="bg-cyan-500/10 rounded-xl p-3 text-center border border-cyan-500/20">
                <p className="text-lg font-bold text-cyan-400 truncate">{plTotals.totalWeight}<span className="text-xs ml-0.5">kg</span></p>
                <p className="text-cyan-400/70 text-[10px]">Weight</p>
              </div>
              <div className="bg-indigo-500/10 rounded-xl p-3 text-center border border-indigo-500/20">
                <p className="text-2xl font-bold text-indigo-400">{plTotals.totalVendors}</p>
                <p className="text-indigo-400/70 text-[10px]">Vendors</p>
              </div>
            </div>
          </div>

          {/* Vendor-wise breakdown */}
          {plOrders.length === 0 ? (
            <div className="card-static p-8 text-center">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                <Icon name="check" size={24} />
              </div>
              <p className="text-emerald-400 font-semibold text-sm">No Data</p>
              <p className="text-zinc-500 text-xs mt-1">
                {["admin", "manager"].includes(user.role) 
                  ? "No orders found for selected filters" 
                  : "No orders assigned to you for selected date range"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {plOrders.map((v, i) => (
                <div key={i} className="card-static p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-indigo-400 font-semibold text-sm">{v.vendor}</p>
                        {v.assigned3pl === "3pl_ecl" && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">ECL</span>}
                        {v.assigned3pl === "3pl_ge" && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">GE</span>}
                        {(!v.assigned3pl || v.assigned3pl === "") && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-zinc-500/20 text-zinc-400 border border-zinc-500/30">Unassigned</span>}
                      </div>
                      <p className="text-zinc-500 text-[10px]">Seller: {v.sellerName}</p>
                    </div>
                    {v.pendingBoxes === 0 ? (
                      <span className="badge badge-success">✓ Done</span>
                    ) : (
                      <span className="badge bg-amber-500/15 text-amber-400">{v.pendingBoxes} Pending</span>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="bg-white/[0.03] rounded-lg py-2">
                      <p className="text-white font-bold text-sm">{v.uniqueOrders}</p>
                      <p className="text-zinc-500 text-[9px]">Orders</p>
                    </div>
                    <div className="bg-white/[0.03] rounded-lg py-2">
                      <p className="text-white font-bold text-sm">{v.totalBoxes}</p>
                      <p className="text-zinc-500 text-[9px]">Boxes</p>
                    </div>
                    <div className="bg-white/[0.03] rounded-lg py-2">
                      <p className="text-emerald-400 font-bold text-sm">{v.receivedBoxes}</p>
                      <p className="text-zinc-500 text-[9px]">Received</p>
                    </div>
                    <div className="bg-white/[0.03] rounded-lg py-2">
                      <p className="text-zinc-400 font-bold text-sm">{v.totalWeight} kg</p>
                      <p className="text-zinc-500 text-[9px]">Weight</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>)}


        {/* ═══ SCAN TAB ═══ */}
        {plTab === "scan" && (<>
        {/* Scanner Card */}
        <div className="card-static p-4 sm:p-5 lg:p-6 animate-fade-in-up delay-100 max-w-2xl mx-auto w-full">
          <h2 className="text-white font-semibold text-xs sm:text-sm lg:text-base mb-3 sm:mb-4 flex items-center gap-2">
            <Icon name="qr" size={16} /> Scan QR Code
          </h2>

          {/* Camera Area */}
          <div className={`rounded-xl overflow-hidden bg-black/50 ${scannerOn ? "block" : "hidden"}`} style={{ minHeight: "260px" }}>
            <div className="relative">
              <video ref={videoRef} className="w-full h-auto" playsInline autoPlay muted style={{ maxHeight: "320px", objectFit: "cover" }} />
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 border-2 border-emerald-400/60 rounded-xl scan-overlay relative">
                  <div className="scan-line absolute w-full" />
                </div>
              </div>
            </div>
          </div>

          {camError && <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-xs mt-3 animate-fade-in">{camError}</div>}

          <button
            onClick={startScan}
            className={`w-full py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 mt-4 transition-all ${
              scannerOn
                ? "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
                : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
            }`}
          >
            <Icon name={scannerOn ? "stop" : "camera"} size={18} />
            {scannerOn ? "Stop Scanner" : "Start Camera"}
          </button>

          <div className="flex items-center gap-3 my-5">
            <div className="h-px bg-white/5 flex-1" />
            <span className="text-zinc-600 text-xs">or enter manually</span>
            <div className="h-px bg-white/5 flex-1" />
          </div>

          {/* Manual Entry */}
          <div className="space-y-3">
            <div>
              <label className="text-zinc-400 text-xs font-medium mb-1.5 block">Fleek ID</label>
              <input
                type="text"
                value={scanId}
                onChange={(e) => setScanId(e.target.value)}
                className="input-field w-full px-4 py-3 rounded-xl text-center font-mono text-lg"
                placeholder="158985_30"
              />
            </div>

            {scanDet && (
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl overflow-hidden animate-fade-in">
                {/* Header */}
                <div className="bg-emerald-500/10 px-3 py-2 border-b border-emerald-500/15 flex items-center justify-between">
                  <p className="text-emerald-400 text-xs font-bold flex items-center gap-1.5">
                    <Icon name="check" size={14} /> Order Found
                  </p>
                  {scanDet.latestStatus && <span className="badge badge-info">{scanDet.latestStatus}</span>}
                </div>
                {/* Details Grid */}
                <div className="p-3 grid grid-cols-2 gap-2">
                  <div className="bg-white/[0.04] rounded-lg px-2.5 py-2 border border-white/[0.06]">
                    <p className="text-emerald-400/70 text-[9px] font-semibold uppercase tracking-wider">Vendor</p>
                    <p className="text-white text-xs font-bold mt-0.5 truncate">{scanDet.vendor || "N/A"}</p>
                  </div>
                  <div className="bg-white/[0.04] rounded-lg px-2.5 py-2 border border-white/[0.06]">
                    <p className="text-emerald-400/70 text-[9px] font-semibold uppercase tracking-wider">Customer</p>
                    <p className="text-white text-xs font-bold mt-0.5 truncate">{scanDet.customerName || "N/A"}</p>
                  </div>
                  <div className="bg-white/[0.04] rounded-lg px-2.5 py-2 border border-white/[0.06]">
                    <p className="text-emerald-400/70 text-[9px] font-semibold uppercase tracking-wider">Quantity</p>
                    <p className="text-white text-xs font-bold mt-0.5">{scanDet.quantitySold || "N/A"}</p>
                  </div>
                  <div className="bg-white/[0.04] rounded-lg px-2.5 py-2 border border-white/[0.06]">
                    <p className="text-emerald-400/70 text-[9px] font-semibold uppercase tracking-wider">Country</p>
                    <p className="text-white text-xs font-bold mt-0.5">{scanDet.customerCountry || "N/A"}</p>
                  </div>
                  <div className="bg-white/[0.04] rounded-lg px-2.5 py-2 border border-white/[0.06]">
                    <p className="text-emerald-400/70 text-[9px] font-semibold uppercase tracking-wider">Category</p>
                    <p className="text-white text-xs font-bold mt-0.5 truncate">{scanDet.category || "N/A"}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Box Count - REQUIRED */}
            <div>
              <label className="text-zinc-400 text-xs font-medium mb-1.5 block">
                Box Count <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                value={scanBox}
                onChange={(e) => setScanBox(e.target.value)}
                className="input-field w-full px-4 py-3 rounded-xl text-center text-lg font-semibold"
                placeholder="0"
                min="1"
                required
              />
            </div>

            {/* Box Details - OPTIONAL */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-zinc-400 text-xs font-medium">
                  Box Details <span className="text-zinc-600 font-normal">(optional)</span>
                </label>
                <button
                  type="button"
                  onClick={addBoxDetail}
                  className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 text-xs font-medium transition-colors bg-indigo-500/10 hover:bg-indigo-500/20 px-2.5 py-1 rounded-lg border border-indigo-500/20"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                  Add Box
                </button>
              </div>

              {boxDetails.length > 0 && (
                <div className="space-y-3">
                  {boxDetails.map((box, idx) => (
                    <div key={idx} className="bg-white/[0.03] border border-white/5 rounded-xl p-3 animate-fade-in">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-indigo-400 text-[11px] font-semibold">Box {idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeBoxDetail(idx)}
                          className="text-zinc-500 hover:text-red-400 transition-colors p-0.5"
                        >
                          <Icon name="x" size={14} />
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <label className="text-zinc-500 text-[9px] mb-0.5 block">Weight (kg)</label>
                          <input
                            type="number"
                            value={box.weight}
                            onChange={(e) => updateBoxDetail(idx, "weight", e.target.value)}
                            className="input-field w-full px-2 py-1.5 rounded-lg text-xs text-center"
                            placeholder="0"
                            step="0.1"
                          />
                        </div>
                        <div>
                          <label className="text-zinc-500 text-[9px] mb-0.5 block">H (cm)</label>
                          <input
                            type="number"
                            value={box.height}
                            onChange={(e) => updateBoxDetail(idx, "height", e.target.value)}
                            className="input-field w-full px-2 py-1.5 rounded-lg text-xs text-center"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="text-zinc-500 text-[9px] mb-0.5 block">W (cm)</label>
                          <input
                            type="number"
                            value={box.width}
                            onChange={(e) => updateBoxDetail(idx, "width", e.target.value)}
                            className="input-field w-full px-2 py-1.5 rounded-lg text-xs text-center"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="text-zinc-500 text-[9px] mb-0.5 block">L (cm)</label>
                          <input
                            type="number"
                            value={box.length}
                            onChange={(e) => updateBoxDetail(idx, "length", e.target.value)}
                            className="input-field w-full px-2 py-1.5 rounded-lg text-xs text-center"
                            placeholder="0"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notes - OPTIONAL */}
            <div>
              <label className="text-zinc-400 text-xs font-medium mb-1.5 block">
                Notes <span className="text-zinc-600 font-normal">(optional)</span>
              </label>
              <textarea
                value={scanNotes}
                onChange={(e) => setScanNotes(e.target.value)}
                className="input-field w-full px-3 py-2.5 rounded-xl text-sm resize-none h-20"
                placeholder="Any issues or comments about this order..."
              />
            </div>

            {/* Photo - OPTIONAL */}
            <div>
              <label className="text-zinc-400 text-xs font-medium mb-1.5 block">
                Photo <span className="text-zinc-600 font-normal">(optional)</span>
              </label>
              <input ref={photoInputRef} type="file" accept="image/*" capture="environment" onChange={capturePhoto} className="hidden" />
              
              {scanPhoto ? (
                <div className="relative">
                  <img src={scanPhoto} alt="Shipment" className="w-full h-40 object-cover rounded-xl border border-white/10" />
                  <button type="button" onClick={() => setScanPhoto(null)} className="absolute top-2 right-2 bg-black/70 text-white w-7 h-7 rounded-full flex items-center justify-center text-xs hover:bg-red-500 transition-all">✕</button>
                  <p className="text-emerald-400 text-[10px] mt-1.5 text-center font-medium">Photo attached</p>
                </div>
              ) : (
                <button type="button" onClick={() => photoInputRef.current?.click()} className="w-full py-3 rounded-xl border border-dashed border-white/10 hover:border-indigo-500/30 hover:bg-indigo-500/5 text-zinc-500 hover:text-indigo-400 text-xs font-medium flex items-center justify-center gap-2 transition-all">
                  <Icon name="camera" size={16} /> Take Photo or Choose
                </button>
              )}
            </div>

            <button
              onClick={markRec}
              disabled={marking || !scanId.trim() || !scanBox.trim()}
              className="btn-primary w-full py-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {marking ? <><Spinner size={20} /> <span>Processing...</span></> : <><Icon name="checkmark" size={20} /> <span>Mark Received</span></>}
            </button>
           </div>
        </div>
        </>)}

        {/* ═══ HISTORY TAB ═══ */}
        {plTab === "history" && (() => {
          const filteredLogs = sLogs.filter(l => {
            const d = (l.scannedAt || "").slice(0, 10);
            if (plHistFrom && d < plHistFrom) return false;
            if (plHistTo && d > plHistTo) return false;
            return true;
          });
          return (<>
          {/* Search + Date Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex gap-2 flex-1">
              <input type="text" value={logSearch} onChange={(e) => setLogSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") getLogs(); }} placeholder="Search order ID..." className="input-field flex-1 px-3 py-2.5 rounded-xl text-xs" />
              <button onClick={getLogs} disabled={loadLogs} className="btn-ghost px-3 py-2.5 rounded-xl text-xs shrink-0">{loadLogs ? <Spinner size={14} /> : <Icon name="search" size={14} />}</button>
            </div>
            <div className="w-full sm:w-64">
              <DateRangePicker from={plHistFrom} to={plHistTo} onFromChange={setPlHistFrom} onToChange={setPlHistTo} />
            </div>
          </div>

          {filteredLogs.length === 0 ? (
            <div className="card-static p-10 text-center"><p className="text-zinc-600 text-sm">{logSearch || plHistFrom ? "No results for selected filters" : "No orders received yet"}</p></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[75vh] overflow-y-auto pr-0.5">
              {filteredLogs.slice(0, 50).map((l, i) => (
                <div key={l.id} className="card-static overflow-hidden animate-fade-in" style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
                  {/* Header row */}
                  <div className="px-4 py-3 flex items-center justify-between border-b border-white/5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <Icon name="check" size={16} />
                      </div>
                      <div>
                        <p className="text-white font-mono text-sm font-bold">{l.fleekId}</p>
                        <p className="text-zinc-500 text-[10px]">{new Date(l.scannedAt).toLocaleDateString()} · {new Date(l.scannedAt).toLocaleTimeString()}</p>
                      </div>
                    </div>
                    <span className="badge badge-success">Received</span>
                  </div>

                  {/* Detail grid */}
                  <div className="px-4 py-3 grid grid-cols-3 gap-2">
                    <div className="bg-white/[0.03] rounded-lg px-2.5 py-2 border border-white/[0.05]">
                      <p className="text-zinc-500 text-[9px] font-semibold uppercase">Boxes</p>
                      <p className="text-white text-sm font-bold mt-0.5">{l.boxCount || "—"}</p>
                    </div>
                    <div className="bg-white/[0.03] rounded-lg px-2.5 py-2 border border-white/[0.05]">
                      <p className="text-zinc-500 text-[9px] font-semibold uppercase">Scanned By</p>
                      <p className="text-white text-xs font-semibold mt-0.5 truncate">{l.userName}</p>
                    </div>
                    <div className="bg-white/[0.03] rounded-lg px-2.5 py-2 border border-white/[0.05]">
                      <p className="text-zinc-500 text-[9px] font-semibold uppercase">Status</p>
                      <p className="text-emerald-400 text-xs font-bold mt-0.5">{l.status}</p>
                    </div>
                  </div>

                  {/* Notes + Photo */}
                  {(l.notes || l.photoUrl) && (
                    <div className="px-4 pb-3 space-y-2">
                      {l.notes && (
                        <div className="bg-amber-500/5 rounded-lg px-3 py-2 border border-amber-500/10">
                          <p className="text-amber-400/70 text-[9px] font-semibold uppercase">Notes</p>
                          <p className="text-zinc-300 text-xs mt-0.5">{l.notes}</p>
                        </div>
                      )}
                      {l.photoUrl && (
                        <img src={l.photoUrl} alt="Shipment" className="w-full h-32 object-cover rounded-lg border border-white/10 cursor-pointer hover:opacity-80" onClick={() => window.open(l.photoUrl!, "_blank")} />
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>);
        })()}

        {/* ═══ EXTRAS TAB ═══ */}
        {plTab === "extras" && (<>
        <div className="card-static overflow-hidden animate-fade-in-up max-w-2xl mx-auto w-full">
          <div className="p-3 sm:p-4 border-b border-white/5">
            <h3 className="text-white font-semibold text-sm">Report Extra / Unknown Item</h3>
            <p className="text-zinc-500 text-[10px] mt-0.5">Box not in order list? Report it here.</p>
          </div>
          <div className="p-4 space-y-3">
            <div><label className="text-zinc-400 text-[11px] font-medium mb-1 block">Order / Fleek ID <span className="text-red-400">*</span></label><input type="text" value={extraFleekId} onChange={(e) => setExtraFleekId(e.target.value)} className="input-field w-full px-3 py-2.5 rounded-xl text-sm font-mono" placeholder="158985_30" required /></div>
            <div><label className="text-zinc-400 text-[11px] font-medium mb-1 block">Description <span className="text-red-400">*</span></label><textarea value={extraDesc} onChange={(e) => setExtraDesc(e.target.value)} className="input-field w-full px-3 py-2.5 rounded-xl text-sm resize-none h-16" placeholder="What extra item? How many boxes?" required /></div>
            <div>
              <label className="text-zinc-400 text-[11px] font-medium mb-1.5 block">Photo <span className="text-red-400">*</span> <span className="text-zinc-600 text-[9px]">(required)</span></label>
              <input ref={extraPhotoRef} type="file" accept="image/*" capture="environment" onChange={captureExtraPhoto} className="hidden" />
              {extraPhoto ? (
                <div className="relative"><img src={extraPhoto} alt="" className="w-full h-32 object-cover rounded-xl border border-white/10" /><button type="button" onClick={() => setExtraPhoto(null)} className="absolute top-2 right-2 bg-black/70 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs hover:bg-red-500">✕</button></div>
              ) : (
                <button type="button" onClick={() => extraPhotoRef.current?.click()} className="w-full py-2.5 rounded-xl border border-dashed border-white/10 hover:border-amber-500/30 text-zinc-500 text-xs flex items-center justify-center gap-2"><Icon name="camera" size={14} /> Take Photo</button>
              )}
            </div>
            <button onClick={submitExtra} disabled={extraSubmitting || !extraFleekId.trim() || !extraDesc.trim() || !extraPhoto} className="w-full bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 transition-all">
              {extraSubmitting ? <><Spinner size={16} /> <span>Reporting...</span></> : !extraPhoto ? <span>📷 Photo Required to Submit</span> : <span>Report Extra Item</span>}
            </button>
          </div>
        </div>

        {/* My Reported Extras */}
        {extraItems2.length > 0 && (
          <div className="card-static overflow-hidden animate-fade-in-up delay-100">
            <div className="p-3 sm:p-4 border-b border-white/5"><h3 className="text-white font-semibold text-sm">My Reports ({extraItems2.length})</h3></div>
            <div className="divide-y divide-white/5 max-h-[50vh] overflow-y-auto">
              {extraItems2.map((item, i) => (
                <div key={item.id} className="px-4 py-3 animate-fade-in" style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
                  <div className="flex items-center justify-between">
                    <p className="text-amber-400 font-mono text-xs font-bold">{item.fleekId || "No Order ID"}</p>
                    <span className={`badge ${item.status === "pending" ? "badge-warning" : item.status === "resolved" ? "badge-success" : "badge-info"}`}>{item.status}</span>
                  </div>
                  <p className="text-zinc-300 text-xs mt-1">{item.description}</p>
                  {item.photoUrl && <img src={item.photoUrl} alt="" className="mt-2 w-full h-24 object-cover rounded-lg border border-white/10 cursor-pointer hover:opacity-80" onClick={() => window.open(item.photoUrl!, "_blank")} />}
                  <p className="text-zinc-600 text-[10px] mt-1.5">{new Date(item.createdAt).toLocaleString()}</p>
                  {item.adminNotes && <p className="text-indigo-400/70 text-[10px] mt-1 bg-indigo-500/5 rounded px-2 py-1 border border-indigo-500/10">Admin: {item.adminNotes}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
        </>)}

      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════
  // MAIN DASHBOARD
  // ═══════════════════════════════════════════════════════════════
  const isAdmin = user.role === "admin";
  const isAdminOrManager = ["admin", "manager"].includes(user.role);

  // ALL possible tabs for Fleek tool users (admin/manager/employee)
  // Permissions will filter which ones user actually sees
  const allFleekTabs = [
    { k: "upload", label: "Upload", icon: "upload" },
    { k: "search", label: "Search", icon: "search" },
    { k: "qrcodes", label: "QR Codes", icon: "qr" },
    { k: "received", label: "Received", icon: "check" },
    { k: "gddetails", label: "GD Details", icon: "box" },
    { k: "extras", label: "Extras", icon: "box" },
    { k: "activity", label: "Activity", icon: "check" },
    { k: "backend", label: "Database", icon: "database" }, 
    { k: "users", label: "Users", icon: "users" },
    { k: "granted", label: "Granted", icon: "key" },
  ];

  // Check if user has permission for a specific tab
  const hasPermission = (tabKey: string): boolean => {
    // Admin always has access to everything
    if (user.role === "admin") return true;
    
    // If custom permissions are loaded, use them strictly
    if (Object.keys(myPermissions).length > 0) {
      return myPermissions[tabKey] === true;
    }
    
    // Fallback to role-based defaults (when permissions not loaded yet)
    const roleDefaults: Record<string, string[]> = {
      manager: ["upload", "search", "qrcodes", "received", "gddetails", "activity"],
      employee: ["search", "qrcodes", "received", "gddetails"],
    };
    const allowed = roleDefaults[user.role] || ["search"];
    return allowed.includes(tabKey);
  };

  // Filter tabs based on permissions
  const tabItems = allFleekTabs.filter(t => hasPermission(t.k));

  // Theme classes
  const dk = theme === "dark";
  const bg = dk ? "bg-[#05050a]" : "bg-gray-50";
  const cardBg = dk ? "bg-[#13131a]" : "bg-white";
  const borderColor = dk ? "border-white/5" : "border-gray-200";
  const textPrimary = dk ? "text-white" : "text-gray-900";
  const textSecondary = dk ? "text-zinc-400" : "text-gray-600";
  const textMuted = dk ? "text-zinc-600" : "text-gray-400";
  const cardClass = dk ? "card-static" : "bg-white border border-gray-200 rounded-2xl shadow-sm";
  const inputClass = dk ? "input-field" : "bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all";
  const btnGhost = dk ? "btn-ghost" : "bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200 hover:text-gray-900 transition-all";
  const glassHeader = dk ? "glass" : "bg-white/95 backdrop-blur-sm shadow-sm";
  const subtleBg = dk ? "bg-white/[0.02]" : "bg-gray-100";
  const subtleBorder = dk ? "border-white/5" : "border-gray-200";
  const tableBg = dk ? "bg-white/[0.02]" : "bg-gray-50";
  const hoverRow = dk ? "hover:bg-white/[0.03]" : "hover:bg-indigo-50/30";
  const divider = dk ? "divide-white/5" : "divide-gray-100";

  return (
    <div className={`min-h-screen ${bg}`}>
      <Toasts toasts={toasts} />
      
      {/* Floating Orb Particles — visible across entire dashboard */}
      {dk && <>
        <div className="scene-orb scene-orb-1" style={{ top: "12%", left: "5%" }} />
        <div className="scene-orb scene-orb-2" style={{ top: "30%", right: "8%" }} />
        <div className="scene-orb scene-orb-3" style={{ bottom: "20%", left: "10%" }} />
        <div className="scene-orb scene-orb-4" style={{ top: "65%", right: "5%" }} />
      </>}

      {/* Header */}
      <header className={`${glassHeader} border-b ${borderColor} sticky top-0 z-40 animate-fade-in-down relative`}>
        {/* Neon glow line at bottom of header */}
        <div className="header-glow-line" />
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shrink-0" style={{ boxShadow: dk ? "0 0 20px rgba(99,102,241,0.35), 0 0 40px rgba(139,92,246,0.15)" : "0 4px 12px rgba(99,102,241,0.2)" }}>
              <Icon name="logo" size={18} />
            </div>
            <div className="min-w-0">
              <h1 className={`${textPrimary} font-bold text-sm sm:text-base`}>FleekTrack</h1>
              <p className={`${textSecondary} text-xs sm:text-sm flex items-center gap-1.5`}><span className={`${textPrimary} font-semibold`}>{user.name}</span><span className={`role-badge-${user.role} px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider`}>{user.role === "admin" ? "Admin" : user.role === "manager" ? "Manager" : "Employee"}</span></p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <div className="live-badge hidden sm:flex"><span className="live-dot"></span><span>Live</span></div>
            {/* Stats */}
            <div className={`hidden md:flex items-center gap-3 ${subtleBg} rounded-xl px-3 lg:px-4 py-1.5 sm:py-2 mr-1 border ${subtleBorder}`}>
              <div className="text-center">
                <p className="text-indigo-500 text-xs sm:text-sm font-bold">{totRec}</p>
                <p className={`${textMuted} text-[9px] sm:text-[10px]`}>Records</p>
              </div>
              <div className={`w-px h-5 sm:h-6 ${dk ? "bg-white/10" : "bg-gray-300"}`} />
              <div className="text-center">
                <p className="text-purple-400 text-xs sm:text-sm font-bold">{totQr}</p>
                <p className={`${textMuted} text-[9px] sm:text-[10px]`}>QR</p>
              </div>
            </div>

            {/* 🔔 Unified Bell — Notifications + Access Requests */}
            <div className="relative">
              <button
                onClick={() => { setShowNotifs(!showNotifs); if (!showNotifs) { loadNotifications(); if (["admin","manager"].includes(user.role)) loadAccessReqs(); } }}
                className="btn-ghost p-2 rounded-lg relative"
                title="Notifications"
              >
                <Icon name="bell" size={18} />
                {(unreadCount + pendingCount) > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse">{(unreadCount + pendingCount) > 9 ? "9+" : unreadCount + pendingCount}</span>
                )}
              </button>
              
              {/* Combined Dropdown */}
              {showNotifs && (
                <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 card-static rounded-xl shadow-2xl border border-white/10 z-50 max-h-[80vh] overflow-hidden">
                  
                  {/* Access Requests Section — admin/manager only */}
                  {["admin","manager"].includes(user.role) && pendingCount > 0 && (
                    <>
                      <div className="px-4 py-2.5 bg-amber-500/5 border-b border-amber-500/20 flex items-center justify-between">
                        <span className="text-amber-400 text-xs font-semibold flex items-center gap-1.5">⚠️ Access Requests ({pendingCount})</span>
                        <button onClick={() => { setShowNotifs(false); setShowAccessReqs(true); }} className="text-amber-400 text-[11px] hover:text-amber-300 font-medium">View All →</button>
                      </div>
                      <div className="max-h-32 overflow-y-auto border-b border-white/5">
                        {accessReqs.filter(r => r.status === "pending").slice(0, 3).map(r => (
                          <div key={r.id} onClick={() => { setShowNotifs(false); setShowAccessReqs(true); }} className="px-4 py-2.5 hover:bg-white/[0.02] cursor-pointer flex items-center gap-3">
                            <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0"><Icon name="user" size={14} /></div>
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-xs font-medium truncate">{r.name}</p>
                              <p className="text-zinc-500 text-[10px] truncate">{r.email}</p>
                            </div>
                            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Notifications Section */}
                  <div className="px-4 py-2.5 border-b border-white/5 flex items-center justify-between">
                    <span className="text-white text-sm font-semibold">Notifications</span>
                    {unreadCount > 0 && (
                      <button onClick={() => markNotificationsRead()} className="text-indigo-400 text-xs hover:text-indigo-300">Mark all read</button>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {notifs.length === 0 ? (
                      <div className="p-6 text-center text-zinc-500 text-sm">No notifications yet</div>
                    ) : (
                      notifs.map(n => (
                        <div
                          key={n.id}
                          onClick={() => { if (!n.isRead) markNotificationsRead([n.id]); if (n.link) setTab(n.link); setShowNotifs(false); }}
                          className={`px-4 py-3 border-b border-white/5 cursor-pointer transition-all hover:bg-white/[0.02] ${!n.isRead ? "bg-indigo-500/5" : ""}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${!n.isRead ? "bg-indigo-500/20 text-indigo-400" : "bg-white/5 text-zinc-500"}`}>
                              <Icon name={n.icon || "bell"} size={14} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-medium ${!n.isRead ? "text-white" : "text-zinc-400"}`}>{n.title}</p>
                              <p className="text-[11px] text-zinc-500 mt-0.5 line-clamp-2">{n.message}</p>
                              <p className="text-[10px] text-zinc-600 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                            </div>
                            {!n.isRead && <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 mt-1.5" />}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button onClick={toggleTheme} className="btn-ghost p-2 rounded-lg" title={theme === "dark" ? "Light Mode" : "Dark Mode"}>
              <Icon name={theme === "dark" ? "sun" : "moon"} size={18} />
            </button>
            <button onClick={() => setChgOwnPass(true)} className="btn-ghost p-2 rounded-lg" title="Change Password">
              <Icon name="key" size={18} />
            </button>
            <button onClick={logout} className="btn-ghost px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5">
              <Icon name="logout" size={14} /> <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Tool Switcher for Admin/Manager */}
      {["admin", "manager"].includes(user.role) && (
        <div className="max-w-7xl mx-auto px-3 sm:px-4 mt-3 sm:mt-4 animate-fade-in-down delay-75">
          <div className={`flex items-center gap-2 ${subtleBg} p-1.5 rounded-xl border ${subtleBorder} w-fit`}>
            <span className={`${textMuted} text-[10px] font-medium px-2 hidden sm:inline`}>Switch Tool:</span>
            <button
              onClick={() => setViewAs("fleek")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${viewAs === "fleek" ? "bg-indigo-500/20 text-indigo-400 shadow-sm" : `${dk ? "text-zinc-400 hover:text-white hover:bg-white/5" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"}`}`}
            >
              🏢 <span className="hidden sm:inline">Fleek Tool</span><span className="sm:hidden">Fleek</span>
            </button>
            <button
              onClick={() => { setViewAs("3pl"); setPlTab("gd"); }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${viewAs === "3pl" ? "bg-emerald-500/20 text-emerald-400 shadow-sm" : `${dk ? "text-zinc-400 hover:text-white hover:bg-white/5" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"}`}`}
            >
              🏭 <span className="hidden sm:inline">3PL Tool</span><span className="sm:hidden">3PL</span>
            </button>
            <button
              onClick={() => { setViewAs("seller"); setSellerTab("entry"); }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${viewAs === "seller" ? "bg-pink-500/20 text-pink-400 shadow-sm" : `${dk ? "text-zinc-400 hover:text-white hover:bg-white/5" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"}`}`}
            >
              🛍️ <span className="hidden sm:inline">Seller Tool</span><span className="sm:hidden">Seller</span>
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 mt-3 sm:mt-4 animate-fade-in-down delay-100">
        <nav className={`flex gap-0.5 sm:gap-1 ${subtleBg} ${subtleBorder} p-1 sm:p-1.5 rounded-xl sm:rounded-2xl border overflow-x-auto w-full sm:w-fit`}>
          {tabItems.map((tb, i) => (
            <button
              key={tb.k}
              onClick={() => setTab(tb.k)}
              className={`tab-item flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-medium whitespace-nowrap transition-all flex-1 sm:flex-none ${tab === tb.k ? "active" : ""}`}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <Icon name={tb.icon} size={16} />
              <span className="hidden sm:inline">{tb.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        
        {/* UPLOAD TAB */}
        {tab === "upload" && (
          <div className="max-w-2xl mx-auto space-y-4 sm:space-y-5 animate-fade-in-up">
            
            {/* 3D Upload Card */}
            <div className="relative group" style={{ perspective: "1200px" }}>
              {/* Glow effects behind card */}
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 rounded-3xl blur-xl opacity-50 group-hover:opacity-80 transition-opacity duration-500" />
              
              <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden border border-white/10" style={{ transformStyle: "preserve-3d", background: dk ? "linear-gradient(145deg, #1a1a2e 0%, #16162a 50%, #1a1a2e 100%)" : "linear-gradient(145deg, #ffffff 0%, #f8fafc 50%, #ffffff 100%)" }}>
                
                {/* Top gradient line */}
                <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
                
                {/* Header */}
                <div className="px-5 sm:px-7 pt-5 sm:pt-7 pb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25" style={{ transform: "translateZ(20px)" }}>
                      <Icon name="upload" size={22} />
                    </div>
                    <div>
                      <h2 className={`${textPrimary} font-bold text-lg sm:text-xl`}>Upload CSV</h2>
                      <p className={`${textSecondary} text-xs sm:text-sm mt-0.5`}>Import orders — duplicates auto-skipped</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-4">
                    {["fleek_id", "vendor", "customer_name", "quantity_sold", "category"].map((c, i) => (
                      <span key={c} className="px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" style={{ animationDelay: `${i * 60}ms` }}>{c}</span>
                    ))}
                    <span className={`px-2 py-0.5 rounded-md text-[10px] ${textSecondary}`}>+4 more</span>
                  </div>
                </div>

                {/* Upload Zone */}
                <div className="px-5 sm:px-7 pb-6 sm:pb-8">
                  <div
                    onDrop={(e) => { e.preventDefault(); setDragging(false); e.dataTransfer.files[0] && upFile(e.dataTransfer.files[0]); }}
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onClick={() => !uploading && fileRef.current?.click()}
                    className={`relative rounded-2xl cursor-pointer transition-all duration-300 overflow-hidden ${
                      uploading 
                        ? "" 
                        : dragging 
                          ? "border-2 border-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.3)]" 
                          : dk 
                            ? "border-2 border-dashed border-white/10 hover:border-indigo-500/50 hover:shadow-[0_0_20px_rgba(99,102,241,0.15)]" 
                            : "border-2 border-dashed border-gray-300 hover:border-indigo-400 hover:shadow-lg"
                    }`}
                    style={{ minHeight: uploading ? "200px" : "180px" }}
                  >
                    {/* Animated background when uploading */}
                    {uploading && (
                      <div className="absolute inset-0" style={{ background: dk ? "linear-gradient(135deg, rgba(16,185,129,0.05) 0%, rgba(99,102,241,0.05) 100%)" : "linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(99,102,241,0.08) 100%)" }}>
                        <div className="absolute inset-0" style={{ background: `linear-gradient(90deg, transparent 0%, ${dk ? "rgba(16,185,129,0.1)" : "rgba(16,185,129,0.15)"} ${progress}%, transparent ${progress + 2}%)`, transition: "background 0.5s ease" }} />
                      </div>
                    )}

                    <div className="relative flex flex-col items-center justify-center py-10 sm:py-12">
                      {uploading ? (
                        <>
                          {/* 3D Progress Ring */}
                          <div className="relative w-24 h-24" style={{ transform: "translateZ(30px)" }}>
                            <svg className="w-24 h-24 -rotate-90 drop-shadow-lg" viewBox="0 0 96 96">
                              <circle cx="48" cy="48" r="40" fill="none" stroke={dk ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} strokeWidth="6" />
                              <circle cx="48" cy="48" r="40" fill="none" stroke="url(#progressGrad)" strokeWidth="6" strokeDasharray={`${Math.round(251.3 * progress / 100)} 251.3`} strokeLinecap="round" style={{ transition: "stroke-dasharray 0.4s ease", filter: "drop-shadow(0 0 8px rgba(16,185,129,0.5))" }} />
                              <defs><linearGradient id="progressGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="#10b981" /></linearGradient></defs>
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <span className="text-2xl font-black bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent">{progress}%</span>
                            </div>
                          </div>
                          <p className={`${textPrimary} text-sm font-semibold mt-4`}>{fname}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <p className={`${textSecondary} text-xs`}>Processing...</p>
                          </div>
                        </>
                      ) : dragging ? (
                        <div className="flex flex-col items-center animate-pulse">
                          <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 flex items-center justify-center mb-3">
                            <Icon name="download" size={28} />
                          </div>
                          <p className="text-indigo-400 font-bold text-sm">Drop your CSV here</p>
                        </div>
                      ) : (
                        <>
                          {/* 3D floating upload icon */}
                          <div className="relative mb-4">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-indigo-500/20 animate-float" style={{ transform: "translateZ(15px)" }}>
                              <Icon name="upload" size={28} />
                            </div>
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-12 h-2 bg-indigo-500/10 rounded-full blur-sm" />
                          </div>
                          <p className={`${textPrimary} text-sm font-semibold`}><span className="text-indigo-400">Click to upload</span> or drag & drop</p>
                          <p className={`${textSecondary} text-xs mt-1`}>CSV files up to 100MB · Parallel processing</p>
                          <div className="flex items-center gap-3 mt-3">
                            <span className={`flex items-center gap-1 text-[10px] ${textSecondary}`}><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Auto-skip duplicates</span>
                            <span className={`flex items-center gap-1 text-[10px] ${textSecondary}`}><span className="w-1.5 h-1.5 rounded-full bg-indigo-400" /> 4x parallel upload</span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Bottom progress bar */}
                    {uploading && (
                      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/5">
                        <div className="h-full rounded-r-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-500 ease-out" style={{ width: `${progress}%`, boxShadow: "0 0 12px rgba(99,102,241,0.5)" }} />
                      </div>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept=".csv" onChange={(e) => e.target.files?.[0] && upFile(e.target.files[0])} className="hidden" disabled={uploading} />

                  {upErr && <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm animate-fade-in">{upErr}</div>}

                  {/* 3D Result Cards */}
                  {upResult && (
                    <div className="mt-5 animate-scale-in">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center"><svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg></div>
                        <p className={`${textPrimary} font-bold text-sm`}>Upload Complete!</p>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className={`rounded-xl p-4 text-center border ${dk ? "bg-white/[0.03] border-white/5" : "bg-gray-50 border-gray-200"}`} style={{ transform: "translateZ(5px)" }}>
                          <p className={`text-2xl font-black ${textPrimary}`}>{upResult.totalRows.toLocaleString()}</p>
                          <p className={`${textSecondary} text-[10px] mt-1 font-medium`}>Total Rows</p>
                        </div>
                        <div className="rounded-xl p-4 text-center bg-emerald-500/10 border border-emerald-500/20" style={{ transform: "translateZ(10px)" }}>
                          <p className="text-2xl font-black text-emerald-400">{upResult.added.toLocaleString()}</p>
                          <p className="text-emerald-400/70 text-[10px] mt-1 font-medium">Added ✓</p>
                        </div>
                        <div className={`rounded-xl p-4 text-center border ${dk ? "bg-white/[0.03] border-white/5" : "bg-gray-50 border-gray-200"}`} style={{ transform: "translateZ(5px)" }}>
                          <p className={`text-2xl font-black ${textSecondary}`}>{upResult.skipped.toLocaleString()}</p>
                          <p className={`${textSecondary} text-[10px] mt-1 font-medium`}>Skipped</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Info footer */}
                <div className={`px-5 sm:px-7 py-3 flex items-center gap-3 border-t ${dk ? "border-white/5 bg-white/[0.01]" : "border-gray-100 bg-gray-50/50"}`}>
                  <Icon name="shield" size={14} />
                  <p className={`${textSecondary} text-[10px]`}>Data permanently saved · New records only · Existing data never modified</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SEARCH TAB */}
        {tab === "search" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 animate-fade-in-up">
            <div className="space-y-3 sm:space-y-4">
              <div className="card-static p-4 sm:p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-white font-semibold text-sm sm:text-base">Search Orders</h2>
                    <p className="text-zinc-500 text-xs">Enter Fleek IDs or use filters</p>
                  </div>
                  <button 
                    onClick={() => setShowFilters(!showFilters)} 
                    className={`btn-ghost px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 ${showFilters ? "bg-indigo-500/10 text-indigo-400" : ""}`}
                  >
                    <Icon name="search" size={14} /> Filters {(searchDateFrom || searchDateTo || searchVendor !== "all" || searchStatus !== "all") && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                  </button>
                </div>

                {/* Advanced Filters */}
                {showFilters && (
                  <div className="bg-white/[0.02] rounded-xl p-3 mb-3 border border-white/5 space-y-3 animate-fade-in">
                    <DateRangePicker label="📅 Date Range" from={searchDateFrom} to={searchDateTo} onFromChange={v => { setSearchDateFrom(v); if (!searchDateTo || v > searchDateTo) setSearchDateTo(v); }} onToChange={v => setSearchDateTo(v)} />
                    <div className="grid grid-cols-2 gap-3">
                      <ThemedSelect value={searchVendor} onChange={setSearchVendor} label="Vendor" options={[{ value: "all", label: "All Vendors" }, ...vendorList.map(v => ({ value: v, label: v }))]} />
                      <ThemedSelect value={searchStatus} onChange={setSearchStatus} label="Status" options={[{ value: "all", label: "All Status" }, { value: "received", label: "✓ Received" }, { value: "pending", label: "⏳ Pending" }]} />
                    </div>
                    <button onClick={clearFilters} className="text-zinc-500 text-xs hover:text-zinc-300">Clear all filters</button>
                  </div>
                )}

                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); search(); } }}
                  placeholder={"158985_30\n158984_14, 158983_70\n\nOr leave empty and use filters →"}
                  className="input-field w-full px-4 py-3 rounded-xl resize-none h-24 text-sm font-mono"
                />
                <button onClick={search} disabled={searching} className="btn-primary w-full py-3 rounded-xl text-sm font-semibold mt-3 flex items-center justify-center gap-2 disabled:opacity-40">
                  {searching ? <><Spinner size={18} /> <span>Searching...</span></> : <><Icon name="search" size={18} /> <span>Search</span></>}
                </button>
                {sErr && <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-xs">{sErr}</div>}
              </div>

              {results.length > 0 && (
                <div className="card-static overflow-hidden animate-fade-in">
                  {/* Header with actions */}
                  <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between flex-wrap gap-2">
                    <h3 className="text-white font-semibold text-sm">Results <span className="text-indigo-400">({results.length})</span></h3>
                    <div className="flex gap-1.5 flex-wrap">
                      <button onClick={exportToExcel} className="btn-ghost px-2.5 py-1.5 rounded-lg text-[11px] flex items-center gap-1"><Icon name="download" size={12} /> Excel</button>
                      <button onClick={() => setSel(sel.size === results.length ? new Set() : new Set(results.map((_, i) => i)))} className="btn-ghost px-2.5 py-1.5 rounded-lg text-[11px]">{sel.size === results.length ? "Deselect" : "Select All"}</button>
                      <button onClick={() => { const ids = Array.from(sel).map((i) => results[i]?.fleekId).filter(Boolean) as string[]; ids.length && genQr(ids); }} disabled={gening || sel.size === 0} className="btn-primary px-2.5 py-1.5 rounded-lg text-[11px] disabled:opacity-40"><span>QR ({sel.size})</span></button>
                    </div>
                  </div>

                  {/* Results list */}
                  <div className="max-h-[60vh] overflow-y-auto">
                    {results.map((r, i) => (
                      <div key={r.id} className={`border-b border-white/5 last:border-0 transition-all ${sel.has(i) ? "bg-indigo-500/5" : "hover:bg-white/[0.02]"}`}>
                        {/* Top row: checkbox + ID + badges */}
                        <div className="px-4 pt-3 pb-2 flex items-center gap-3">
                          <input type="checkbox" checked={sel.has(i)} onChange={() => { const n = new Set(sel); n.has(i) ? n.delete(i) : n.add(i); setSel(n); }} className="w-4 h-4 accent-indigo-500 cursor-pointer rounded shrink-0" />
                          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                            <span className="text-indigo-400 font-mono font-bold text-sm">{r.fleekId}</span>
                            {r.receivedStatus === "received" && <span className="badge badge-success">✓ Received</span>}
                            {r.latestStatus && <span className="badge badge-info">{r.latestStatus}</span>}
                          </div>
                          <button onClick={() => genQr([r.fleekId])} disabled={gening} className="shrink-0 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all">QR Code</button>
                        </div>

                        {/* Detail grid */}
                        <div className="px-4 pb-4 pl-11">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <DetailCell label="Vendor" value={r.vendor} />
                            <DetailCell label="Customer" value={r.customerName} />
                            <DetailCell label="Country" value={r.customerCountry} />
                            <DetailCell label="Quantity" value={r.quantitySold} />
                            <DetailCell label="Amount" value={r.totalOrderLineAmount} />
                            <DetailCell label="Category" value={r.category} />
                            <DetailCell label="Status Date" value={r.latestStatusDate} />
                            {r.receivedStatus === "received" && (
                              <DetailCell label="Received By" value={r.receivedBy} />
                            )}
                          </div>
                          {r.receivedDate && (
                            <div className="mt-2 text-[10px] text-zinc-500">
                              Received: {new Date(r.receivedDate).toLocaleString()}
                              {r.receivedBoxCount && <span> · {r.receivedBoxCount} boxes</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* QR Results */}
            <div>
              {qrRes.length > 0 ? (
                <div className="card-static overflow-hidden animate-scale-in">
                  <div className="p-4 border-b border-white/5 flex items-center justify-between">
                    <h3 className="text-white font-semibold text-sm">Generated QR Codes</h3>
                    <button onClick={() => dlAllQr(qrRes.filter((q) => q.success && q.qrImageData).map((q) => ({ qrImageData: q.qrImageData!, fleekId: q.fleekId })), "QR_Results")} className="btn-primary px-3 py-1.5 rounded-lg text-[11px]"><span>Download All</span></button>
                  </div>
                  <div className="p-4 grid grid-cols-2 gap-3 max-h-[65vh] overflow-y-auto">
                    {qrRes.map((q, i) => (
                      <div key={i} className="qr-card p-4 flex flex-col items-center">
                        {q.success && q.qrImageData ? (
                          <>
                            <img src={q.qrImageData} alt="" className="w-28 h-28 sm:w-32 sm:h-32 object-contain" />
                            <p className="mt-2 text-gray-900 font-mono text-[10px] font-semibold text-center break-all">{q.fleekId}</p>
                            <button onClick={() => dlQr(q.qrImageData!, q.fleekId)} className="mt-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-medium px-4 py-1.5 rounded-lg transition-all flex items-center gap-1">
                              <Icon name="download" size={12} /> Download
                            </button>
                          </>
                        ) : (
                          <p className="text-red-500 text-xs text-center py-4">{q.error}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="card-static p-12 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                    <Icon name="qr" size={32} />
                  </div>
                  <h3 className="text-zinc-500 font-medium text-sm">QR Codes Will Appear Here</h3>
                  <p className="text-zinc-600 text-xs mt-1">Search and select orders to generate</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* QR LIBRARY TAB */}
        {tab === "qrcodes" && (
          <div className="animate-fade-in-up">
            <div className="flex items-center justify-between mb-3 sm:mb-4 flex-wrap gap-2">
              <div>
                <h2 className="text-white font-semibold text-base sm:text-lg">QR Library <span className="text-indigo-400 text-xs sm:text-sm">({savedQr.length})</span></h2>
                {qrSelections.size > 0 && <p className="text-emerald-400 text-xs font-semibold">✓ {qrSelections.size} selected</p>}
              </div>
              <div className="flex gap-2 flex-wrap">
                {qrSelections.size > 0 && (
                  <button onClick={printSelectedQRs} className="btn-primary px-4 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5"><span>🖨️ Print ({qrSelections.size})</span></button>
                )}
                {qrSelections.size > 0 && isAdmin && (
                  <button onClick={async () => { if (!confirm(`Delete ${qrSelections.size} selected QR code(s)?`)) return; const ids = Array.from(qrSelections).map(i => savedQr[i]?.id).filter(Boolean); for (const id of ids) { await authFetch("/api/qr-codes", { method: "DELETE", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ id }) }); } setQrSelections(new Set()); toast(`${ids.length} QR codes deleted`, "success"); getSaved(); }} className="bg-red-500/20 text-red-400 hover:bg-red-500/30 px-4 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all"><span>🗑️ Delete ({qrSelections.size})</span></button>
                )}
                <button onClick={() => setQrSelections(qrSelections.size === savedQr.length ? new Set() : new Set(savedQr.map((_, i) => i)))} className="btn-ghost px-3 py-2 rounded-xl text-xs">
                  {qrSelections.size === savedQr.length ? "Deselect All" : "Select All"}
                </button>
                {savedQr.length > 0 && <button onClick={() => dlAllQr(savedQr, "All_QR")} className="btn-ghost px-3 py-2 rounded-xl text-xs font-medium"><span>⬇ Download All</span></button>}
                <button onClick={getSaved} disabled={loadQr} className="btn-ghost px-3 py-2 rounded-xl text-xs flex items-center gap-1.5">{loadQr ? <Spinner size={14} /> : <Icon name="refresh" size={14} />} Refresh</button>
              </div>
            </div>
            <p className="text-zinc-600 text-xs mb-2">Tap QR cards to select → Print, Download or Delete</p>
            {savedQr.length === 0 ? (
              <div className="card-static p-12 text-center"><p className="text-zinc-600 text-sm">No QR codes yet</p></div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {savedQr.map((q, i) => {
                  const isSel = qrSelections.has(i);
                  return (
                  <div 
                    key={q.id} 
                    onClick={() => { const n = new Set(qrSelections); n.has(i) ? n.delete(i) : n.add(i); setQrSelections(n); }}
                    className={`relative qr-card p-3 flex flex-col items-center animate-fade-in cursor-pointer transition-all duration-200 rounded-xl border-2 ${isSel ? "border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/20 scale-[1.02]" : "border-transparent hover:border-indigo-500/30 hover:shadow-md"}`} 
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    {/* Selection checkmark */}
                    {isSel ? (
                      <div className="absolute top-1.5 right-1.5 w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center shadow-lg z-10">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                    ) : (
                      <div className="absolute top-1.5 right-1.5 w-6 h-6 border-2 border-gray-300 rounded-full opacity-40" />
                    )}
                    <img src={q.qrImageData} alt="" className="w-24 h-24 sm:w-28 sm:h-28 object-contain" />
                    <p className="mt-2 text-gray-900 font-mono text-[10px] font-semibold text-center break-all">{q.fleekId}</p>
                    <p className="text-gray-400 text-[9px]">{new Date(q.createdAt).toLocaleDateString()}</p>
                    <div className="flex gap-1.5 mt-2">
                      <button onClick={(e) => { e.stopPropagation(); dlQr(q.qrImageData, q.fleekId); }} className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-medium px-3 py-1 rounded transition-all">⬇ Download</button>
                      {isAdmin && <button onClick={(e) => { e.stopPropagation(); deleteQr(q.id, q.fleekId); }} className="bg-red-500/20 hover:bg-red-500/30 text-red-400 text-[10px] font-medium px-2 py-1 rounded transition-all">🗑️</button>}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* RECEIVED TAB */}
        {tab === "received" && (
          <div className="animate-fade-in-up">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between mb-3 gap-3">
              <h2 className="text-white font-semibold text-base sm:text-lg">Received Logs</h2>
              <div className="flex gap-2">
                <input type="text" value={logSearch} onChange={(e) => setLogSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") getLogs(); }} placeholder="Search..." className="input-field flex-1 sm:w-48 px-3 py-2 rounded-xl text-xs" />
                <button onClick={getLogs} disabled={loadLogs} className="btn-ghost px-3 py-2 rounded-xl text-xs">{loadLogs ? <Spinner size={14} /> : "Search"}</button>
              </div>
            </div>

            {/* CSV Export Filters — Admin/Manager Only */}
            {["admin", "manager"].includes(user.role) && (
              <ExportFilters toast={toast} Icon={Icon} Spinner={Spinner} />
            )}
            {sLogs.length === 0 ? (
              <div className="card-static p-12 text-center"><p className="text-zinc-600 text-sm">No received records yet</p></div>
            ) : (
              <div className="card-static overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-white/[0.02] border-b border-white/5">
                      <th className="px-3 py-3 text-left text-zinc-400 font-medium text-[11px]">Fleek ID</th>
                      <th className="px-3 py-3 text-left text-zinc-400 font-medium text-[11px]">Scanned By</th>
                      <th className="px-3 py-3 text-left text-zinc-400 font-medium text-[11px] hidden sm:table-cell">Email</th>
                      <th className="px-3 py-3 text-left text-zinc-400 font-medium text-[11px]">Boxes</th>
                      <th className="px-3 py-3 text-left text-zinc-400 font-medium text-[11px] hidden md:table-cell">Notes</th>
                      <th className="px-3 py-3 text-left text-zinc-400 font-medium text-[11px]">Status</th>
                      <th className="px-3 py-3 text-left text-zinc-400 font-medium text-[11px]">Date</th>
                      {isAdmin && <th className="px-3 py-3 text-left text-zinc-400 font-medium text-[11px]">Actions</th>}
                    </tr></thead>
                    <tbody className="divide-y divide-white/5">
                      {sLogs.map((l, i) => (
                        <tr key={l.id} className="table-row animate-fade-in" style={{ animationDelay: `${Math.min(i, 15) * 20}ms` }}>
                          <td className="px-3 py-3 text-indigo-400 font-mono font-semibold text-xs">{l.fleekId}</td>
                          <td className="px-3 py-3 text-zinc-300 text-xs">{l.userName}</td>
                          <td className="px-3 py-3 text-zinc-500 hidden sm:table-cell text-xs">{l.userEmail}</td>
                          <td className="px-3 py-3 text-white font-bold text-xs">{l.boxCount || "—"}</td>
                          <td className="px-3 py-3 hidden md:table-cell"><span className="text-zinc-400 text-[10px] max-w-[150px] truncate block">{l.notes || "—"}</span></td>
                          <td className="px-3 py-3"><span className="badge badge-success">Received</span></td>
                          <td className="px-3 py-3 text-zinc-500 whitespace-nowrap text-[11px]">{new Date(l.scannedAt).toLocaleString()}</td>
                          {isAdmin && (
                            <td className="px-3 py-3">
                              <div className="flex gap-1">
                                <button onClick={() => { setEditLog(l); setEditBoxCount(l.boxCount || ""); setEditNotes(l.notes || ""); }} className="btn-ghost px-2 py-1 rounded text-[10px] text-indigo-400">Edit</button>
                                <button onClick={() => deleteLog(l.id, l.fleekId)} className="btn-ghost px-2 py-1 rounded text-[10px] text-red-400">Del</button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* EXTRAS TAB */}
        {tab === "extras" && (
          <div className="animate-fade-in-up">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold text-base sm:text-lg">Extra Items <span className="text-amber-400 text-sm">({extraItems2.filter(i => i.status === "pending").length} pending)</span></h2>
              <button onClick={loadExtras} className="btn-ghost px-3 py-2 rounded-xl text-xs flex items-center gap-1.5"><Icon name="refresh" size={14} /> Refresh</button>
            </div>
            {extraItems2.length === 0 ? (
              <div className="card-static p-12 text-center"><p className="text-zinc-600 text-sm">No extra items reported</p></div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {extraItems2.map((item) => (
                  <div key={item.id} className="card-static overflow-hidden animate-fade-in">
                    {item.photoUrl && <img src={item.photoUrl} alt="" className="w-full h-40 object-cover cursor-pointer hover:opacity-80" onClick={() => window.open(item.photoUrl!, "_blank")} />}
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-amber-400 font-mono text-sm font-bold">{item.fleekId || "No Order ID"}</span>
                        <span className={`badge ${item.status === "pending" ? "badge-warning" : item.status === "resolved" ? "badge-success" : "badge-info"}`}>{item.status}</span>
                      </div>
                      <p className="text-zinc-300 text-xs">{item.description}</p>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-zinc-600 text-[10px]">{item.reportedByName} · {item.reportedByRole === "3pl_ecl" ? "ECL" : item.reportedByRole === "3pl_ge" ? "GE" : item.reportedByRole}</p>
                        <p className="text-zinc-600 text-[10px]">{new Date(item.createdAt).toLocaleDateString()}</p>
                      </div>
                      {item.adminNotes && <p className="text-indigo-400/80 text-[10px] mt-2 bg-indigo-500/5 rounded px-2 py-1 border border-indigo-500/10">{item.adminNotes}</p>}
                      {item.status === "pending" && (
                        <div className="flex gap-2 mt-3">
                          <button onClick={() => { const n = prompt("Admin note (optional):"); reviewExtra(item.id, "resolved", n || undefined); }} className="flex-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 py-1.5 rounded-lg text-[11px] font-medium hover:bg-emerald-500/20 transition-all">Resolve</button>
                          <button onClick={() => { const n = prompt("Admin note (optional):"); reviewExtra(item.id, "acknowledged", n || undefined); }} className="flex-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 py-1.5 rounded-lg text-[11px] font-medium hover:bg-indigo-500/20 transition-all">Acknowledge</button>
                        </div>
                      )}
                      {item.reviewedBy && <p className="text-zinc-600 text-[9px] mt-2">Reviewed by {item.reviewedBy}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ACTIVITY LOG TAB */}
        {tab === "activity" && (
          <div className="animate-fade-in-up">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between mb-4 gap-3">
              <h2 className={`${textPrimary} font-semibold text-base sm:text-lg`}>Activity Log</h2>
              <div className="flex gap-2">
                <input type="text" value={activitySearch} onChange={(e) => setActivitySearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") loadActivity(activitySearch); }} placeholder="Search user, action..." className="input-field flex-1 sm:w-52 px-3 py-2 rounded-xl text-xs" />
                <button onClick={() => loadActivity(activitySearch)} className="btn-ghost px-3 py-2 rounded-xl text-xs"><Icon name="search" size={14} /></button>
                <button onClick={() => { setActivitySearch(""); loadActivity(); }} className="btn-ghost px-3 py-2 rounded-xl text-xs"><Icon name="refresh" size={14} /></button>
              </div>
            </div>
            {activityData.length === 0 ? (
              <div className="card-static p-12 text-center"><p className="text-zinc-600 text-sm">No activity logged yet</p></div>
            ) : (
              <div className="space-y-2">
                {activityData.map((a, i) => {
                  const actionConfig: Record<string, { badge: string; icon: string; color: string }> = {
                    login: { badge: "badge-info", icon: "logout", color: "bg-indigo-500/10" },
                    received: { badge: "badge-success", icon: "check", color: "bg-emerald-500/10" },
                    "re-received": { badge: "badge-info", icon: "refresh", color: "bg-blue-500/10" },
                    csv_upload: { badge: "badge-purple", icon: "upload", color: "bg-purple-500/10" },
                    add_user: { badge: "badge-success", icon: "user", color: "bg-emerald-500/10" },
                    delete_user: { badge: "badge-danger", icon: "x", color: "bg-red-500/10" },
                    enable_user: { badge: "badge-success", icon: "check", color: "bg-emerald-500/10" },
                    disable_user: { badge: "badge-warning", icon: "stop", color: "bg-amber-500/10" },
                    change_password: { badge: "badge-warning", icon: "key", color: "bg-amber-500/10" },
                    edit_scan: { badge: "badge-info", icon: "search", color: "bg-indigo-500/10" },
                    delete_scan: { badge: "badge-danger", icon: "x", color: "bg-red-500/10" },
                    report_extra: { badge: "badge-warning", icon: "box", color: "bg-amber-500/10" },
                    review_extra: { badge: "badge-info", icon: "check", color: "bg-indigo-500/10" },
                  };
                  const cfg = actionConfig[a.action] || { badge: "badge-default", icon: "info", color: "bg-white/5" };
                  return (
                    <div key={a.id} className="card-static overflow-hidden animate-fade-in" style={{ animationDelay: `${Math.min(i, 15) * 20}ms` }}>
                      <div className="px-4 py-3 flex items-start gap-3">
                        {/* Icon */}
                        <div className={`w-9 h-9 rounded-xl ${cfg.color} flex items-center justify-center shrink-0 mt-0.5`}>
                          <Icon name={cfg.icon} size={18} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          {/* Row 1: Who + What */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white text-sm font-bold">{a.userName}</span>
                            <span className={`badge ${cfg.badge}`}>{a.action.replace(/_/g, " ")}</span>
                          </div>

                          {/* Row 2: Target */}
                          <p className="text-indigo-400 font-mono text-xs font-bold mt-1">{a.target}</p>

                          {/* Row 3: Details */}
                          {a.details && (
                            <div className="bg-white/[0.03] rounded-lg px-3 py-2 mt-2 border border-white/[0.05]">
                              <p className="text-zinc-300 text-xs">{a.details}</p>
                            </div>
                          )}

                          {/* Row 4: Time + Role */}
                          <div className="flex items-center gap-2 mt-2">
                            <p className="text-zinc-600 text-[10px]">{new Date(a.createdAt).toLocaleDateString()}</p>
                            <span className="text-zinc-700 text-[10px]">·</span>
                            <p className="text-zinc-600 text-[10px]">{new Date(a.createdAt).toLocaleTimeString()}</p>
                            <span className="text-zinc-700 text-[10px]">·</span>
                            <span className="badge badge-default">{a.userRole.replace(/_/g, " ")}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* DATABASE TAB */}
        {tab === "backend" && (
          <div className="animate-fade-in-up">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold text-base sm:text-lg">Database Overview</h2>
              <button onClick={getBk} disabled={loadBk} className="btn-ghost px-3 py-2 rounded-xl text-xs flex items-center gap-1.5">{loadBk ? <Spinner size={14} /> : <Icon name="refresh" size={14} />} Refresh</button>
            </div>
            {bkData && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3 mb-4 sm:mb-5">
                  {[{ l: "Records", v: bkData.stats.totalRecords, c: "from-indigo-500 to-purple-500" }, { l: "QR Codes", v: bkData.stats.totalQrCodes, c: "from-purple-500 to-pink-500" }, { l: "Scans", v: bkData.stats.totalScans, c: "from-pink-500 to-rose-500" }, { l: "Received", v: bkData.stats.totalReceived, c: "from-emerald-500 to-teal-500" }, { l: "Users", v: bkData.stats.totalUsers, c: "from-amber-500 to-orange-500" }].map((s, i) => (
                    <div key={s.l} className="card-static p-3 sm:p-4 text-center animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
                      <p className={`text-xl sm:text-2xl font-bold bg-gradient-to-r ${s.c} bg-clip-text text-transparent`}>{s.v}</p>
                      <p className={`${textMuted} text-[10px] sm:text-[11px] mt-0.5 sm:mt-1`}>{s.l}</p>
                    </div>
                  ))}
                </div>
                <div className="card-static overflow-hidden">
                  <div className="p-4 border-b border-white/5"><h3 className="text-white font-semibold text-sm">All Records ({bkData.records.length})</h3></div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px]">
                      <thead><tr className="bg-white/[0.02] border-b border-white/5"><th className="px-3 py-2.5 text-left text-zinc-400 font-medium">Fleek ID</th><th className="px-3 py-2.5 text-left text-zinc-400 font-medium">Status</th><th className="px-3 py-2.5 text-left text-zinc-400 font-medium hidden md:table-cell">Amount</th><th className="px-3 py-2.5 text-left text-zinc-400 font-medium hidden lg:table-cell">Vendor</th><th className="px-3 py-2.5 text-left text-zinc-400 font-medium">Qty</th><th className="px-3 py-2.5 text-left text-zinc-400 font-medium">Received</th></tr></thead>
                      <tbody className="divide-y divide-white/[0.03]">
                        {bkData.records.map((r) => (
                          <tr key={r.id} className="table-row">
                            <td className="px-3 py-2 text-indigo-400 font-mono font-semibold">{r.fleekId}</td>
                            <td className="px-3 py-2 text-zinc-400">{r.latestStatus || "—"}</td>
                            <td className="px-3 py-2 text-zinc-300 hidden md:table-cell">{r.totalOrderLineAmount || "—"}</td>
                            <td className="px-3 py-2 text-zinc-400 hidden lg:table-cell">{r.vendor || "—"}</td>
                            <td className="px-3 py-2 text-white font-medium">{r.quantitySold || "—"}</td>
                            <td className="px-3 py-2">{r.receivedStatus === "received" ? <span className="badge badge-success">Yes</span> : <span className="text-zinc-600">—</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}


        {/* GD DETAILS TAB */}
        {tab === "gddetails" && (
          <div className="animate-fade-in-up">
            <h2 className="text-white font-semibold text-base sm:text-lg mb-4">Seller GD Details</h2>
            
            {/* Date Range + Vendor Filter */}
            <div className="card-static p-4 mb-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                <div className="sm:col-span-2">
                  <DateRangePicker
                    label="📅 Date Range"
                    from={gdDate}
                    to={gdDateTo}
                    onFromChange={(v) => { setGdDate(v); if (!gdDateTo || v > gdDateTo) setGdDateTo(v); setGdVendor(""); setGdDetails([]); setGdFilterVendor(""); }}
                    onToChange={(v) => { setGdDateTo(v); setGdVendor(""); setGdDetails([]); setGdFilterVendor(""); }}
                  />
                </div>
                <ThemedSelect value={gdFilterVendor} onChange={setGdFilterVendor} label="Vendor" options={[{ value: "", label: "All Vendors" }, ...gdVendors.map(v => ({ value: v, label: v }))]} />
                <ThemedSelect value={gdFilter3pl} onChange={setGdFilter3pl} label="3PL" options={[{ value: "", label: "All" }, { value: "3pl_ecl", label: "ECL" }, { value: "3pl_ge", label: "GE" }, { value: "unassigned", label: "Unassigned" }]} />
                <button 
                  onClick={() => loadGdSummaries(gdDate, gdDateTo)} 
                  disabled={gdLoading || !gdDate} 
                  className="btn-primary py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {gdLoading ? <Spinner size={16} /> : <Icon name="refresh" size={16} />} Refresh
                </button>
              </div>
            </div>

            {/* Sellers Summary for selected date */}
            {gdDate && (() => {
              const filtered = gdSummaries.filter(s => (!gdFilterVendor || s.vendor === gdFilterVendor) && (!gdFilter3pl || (gdFilter3pl === "unassigned" ? !s.assigned3pl || s.assigned3pl === "" : s.assigned3pl === gdFilter3pl)));
              return (
              <div className="card-static overflow-hidden mb-4">
                <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                  <h3 className="text-white font-semibold text-sm">Sellers Summary — {gdDate} {gdFilterVendor && <span className="text-indigo-400">· {gdFilterVendor}</span>}</h3>
                  <span className="text-zinc-500 text-xs">{filtered.length} vendor{filtered.length !== 1 ? "s" : ""}</span>
                </div>
                {filtered.length === 0 ? (
                  <div className="p-6 text-center text-zinc-600 text-sm">No seller uploads for this date{gdFilterVendor ? " and vendor" : ""}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="bg-white/[0.02] border-b border-white/5">
                        <th className="px-3 py-2.5 text-left text-zinc-400 font-medium">Vendor</th>
                        <th className="px-3 py-2.5 text-left text-zinc-400 font-medium">Seller</th>
                        <th className="px-3 py-2.5 text-left text-zinc-400 font-medium">Orders</th>
                        <th className="px-3 py-2.5 text-left text-zinc-400 font-medium">Boxes</th>
                        <th className="px-3 py-2.5 text-left text-zinc-400 font-medium">Received</th>
                        <th className="px-3 py-2.5 text-left text-zinc-400 font-medium">Pending</th>
                        <th className="px-3 py-2.5 text-left text-zinc-400 font-medium">Weight</th>
                        <th className="px-3 py-2.5 text-left text-zinc-400 font-medium">Assign 3PL</th>
                        <th className="px-3 py-2.5 text-left text-zinc-400 font-medium">Actions</th>
                      </tr></thead>
                      <tbody className="divide-y divide-white/5">
                        {filtered.map((s, idx) => (
                          <tr key={`${s.vendor}-${s.uploadDate}-${idx}`} className="hover:bg-white/[0.02]">
                            <td className="px-3 py-2.5 text-indigo-400 font-semibold">{s.vendor}</td>
                            <td className="px-3 py-2.5 text-zinc-300">{s.sellerName}</td>
                            <td className="px-3 py-2.5 text-white font-bold">{s.totalOrders}</td>
                            <td className="px-3 py-2.5 text-white font-bold">{s.totalBoxes}</td>
                            <td className="px-3 py-2.5"><span className="text-emerald-400 font-bold">{s.receivedBoxes}</span></td>
                            <td className="px-3 py-2.5"><span className={`font-bold ${s.pendingBoxes > 0 ? "text-amber-400" : "text-emerald-400"}`}>{s.pendingBoxes}</span></td>
                            <td className="px-3 py-2.5 text-zinc-400">{s.totalWeight} kg</td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-1.5">
                                {s.assigned3pl === "3pl_ecl" && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">ECL</span>}
                                {s.assigned3pl === "3pl_ge" && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">GE</span>}
                                {(!s.assigned3pl || s.assigned3pl === "") && <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-500/10 text-zinc-500">—</span>}
                                <select value={s.assigned3pl || ""} onChange={(e) => assign3pl(s.vendor, s.uploadDate, e.target.value)} className="input-field px-1.5 py-1 rounded text-[10px] w-[70px]">
                                  <option value="">Set</option>
                                  <option value="3pl_ecl">ECL</option>
                                  <option value="3pl_ge">GE</option>
                                  <option value="pending">↩ Clear</option>
                                </select>
                              </div>
                            </td>
                            <td className="px-3 py-2.5">
                              <button onClick={() => { loadGdDetails(s.vendor, s.uploadDate); }} className="btn-ghost px-2 py-1 rounded text-[10px] text-indigo-400">View →</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              );
            })()}

            {/* Vendor Details */}
            {gdVendor && gdDetails.length > 0 && (
              <div className="card-static overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                  <div>
                    <h3 className="text-white font-semibold text-sm">{gdVendor} — Details</h3>
                    {gdSummary && <p className="text-zinc-500 text-xs mt-0.5">{gdSummary.totalOrders} orders · {gdSummary.totalBoxes} boxes · {gdSummary.receivedBoxes} received · {gdSummary.pendingBoxes} pending</p>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={exportGdCSV} className="btn-primary px-3 py-1.5 rounded-lg text-xs"><span>Export CSV</span></button>
                    <button onClick={() => { setGdVendor(""); setGdDetails([]); }} className="btn-ghost px-3 py-1.5 rounded-lg text-xs">Close</button>
                  </div>
                </div>
                <div className="overflow-x-auto max-h-[400px]">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-[#13131a]"><tr className="border-b border-white/5">
                      <th className="px-3 py-2 text-left text-zinc-400 font-medium">Fleek ID</th>
                      <th className="px-3 py-2 text-left text-zinc-400 font-medium">Box No</th>
                      <th className="px-3 py-2 text-left text-zinc-400 font-medium">Pieces</th>
                      <th className="px-3 py-2 text-left text-zinc-400 font-medium">Weight</th>
                      <th className="px-3 py-2 text-left text-zinc-400 font-medium hidden sm:table-cell">Dimensions</th>
                      <th className="px-3 py-2 text-left text-zinc-400 font-medium">Status</th>
                    </tr></thead>
                    <tbody className="divide-y divide-white/5">
                      {gdDetails.map((d, i) => (
                        <tr key={i} className="hover:bg-white/[0.02]">
                          <td className="px-3 py-2 text-indigo-400 font-mono font-semibold">{d.fleekId}</td>
                          <td className="px-3 py-2 text-white">{d.boxNo}</td>
                          <td className="px-3 py-2 text-zinc-400">{d.pieces || "—"}</td>
                          <td className="px-3 py-2 text-zinc-400">{d.weight || "—"}</td>
                          <td className="px-3 py-2 text-zinc-500 hidden sm:table-cell">{d.height && d.length && d.width ? `${d.height}×${d.length}×${d.width}` : "—"}</td>
                          <td className="px-3 py-2">{d.receivedStatus === "received" ? <span className="badge badge-success">Received</span> : <span className="badge bg-amber-500/15 text-amber-400">Pending</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}



                {/* SELLER VIEW & 3PL VIEW removed — now accessible via Tool Switcher */}

        {false && (
          <div>
            {sellerTab === "details" && groupedSellerDetails.length > 0 && (() => {
              const filtered = sellerSearch.trim() ? groupedSellerDetails.filter(d => d.fleekId.toLowerCase().includes(sellerSearch.trim().toLowerCase().replace(/\//g, "_"))) : groupedSellerDetails;
              const uniqueOrders = new Set(filtered.flatMap(d => d.fleekId.split(",").map(x => x.trim()).filter(Boolean))).size;
              const totalWeight = filtered.reduce((s, d) => s + (parseFloat(d.weight || "0") || 0), 0);
              return (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="card-static p-3 text-center"><p className="text-xl font-bold text-purple-400">{uniqueOrders}</p><p className="text-zinc-500 text-[10px]">Orders</p></div>
                    <div className="card-static p-3 text-center"><p className="text-xl font-bold text-indigo-400">{filtered.length}</p><p className="text-zinc-500 text-[10px]">Boxes</p></div>
                    <div className="card-static p-3 text-center"><p className="text-xl font-bold text-emerald-400">{totalWeight.toFixed(1)}</p><p className="text-zinc-500 text-[10px]">Weight (kg)</p></div>
                  </div>
                  <div className="flex gap-2">
                    <input type="text" value={sellerSearch} onChange={(e) => setSellerSearch(e.target.value)} placeholder="Search Order ID..." className="input-field flex-1 px-3 py-2 rounded-xl text-sm font-mono" />
                    {sellerSearch && <button onClick={() => setSellerSearch("")} className="btn-ghost px-3 py-2 rounded-xl text-xs">Clear</button>}
                  </div>
                  <div className="card-static overflow-hidden">
                    <div className="overflow-x-auto max-h-[50vh]">
                      <table className="w-full text-[11px]">
                        <thead className="sticky top-0 bg-[#13131a]"><tr className="border-b border-white/5"><th className="px-3 py-2 text-left text-zinc-400 font-medium">Order</th><th className="px-3 py-2 text-left text-zinc-400 font-medium">Box</th><th className="px-3 py-2 text-left text-zinc-400 font-medium">Pcs</th><th className="px-3 py-2 text-left text-zinc-400 font-medium">Wt</th><th className="px-3 py-2 text-left text-zinc-400 font-medium hidden sm:table-cell">Dim</th><th className="px-3 py-2 text-left text-zinc-400 font-medium">Date &amp; Time</th>{isAdmin && <th className="px-3 py-2 w-8"></th>}</tr></thead>
                        <tbody className="divide-y divide-white/5">{filtered.map((d, i) => (<tr key={i} className="hover:bg-white/[0.02]"><td className="px-3 py-2 text-purple-400 font-mono font-semibold">{d.fleekId}</td><td className="px-3 py-2 text-white">{d.boxNo}</td><td className="px-3 py-2 text-zinc-400">{d.pieces || "—"}</td><td className="px-3 py-2 text-zinc-300">{d.weight || "—"}</td><td className="px-3 py-2 text-zinc-500 hidden sm:table-cell">{d.dimensionalWeight || "—"}</td><td className="px-3 py-2 text-zinc-500 text-[10px]">{fmtDt(d.createdAt || d.uploadDate)}</td>{isAdmin && <td className="px-3 py-2"><button onClick={() => deleteSellerEntry(d.id)} className="text-red-400 text-xs">✕</button></td>}</tr>))}</tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })()}
            {sellerTab === "details" && groupedSellerDetails.length === 0 && <div className="card-static p-10 text-center"><p className="text-zinc-600 text-sm">No entries today</p></div>}
            {sellerTab === "qrcodes" && (
              <div>
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div>
                    <h3 className="seller-heading font-semibold text-sm">QR Codes ({sellerQrCodes.length})</h3>
                    {sellerQrSel.size > 0 && <p className="text-zinc-500 text-[10px]">{sellerQrSel.size} selected</p>}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {sellerQrSel.size > 0 && <button onClick={printSellerQRs} className="btn-primary px-3 py-1.5 rounded-lg text-xs flex items-center gap-1"><span>🖨️ Print ({sellerQrSel.size})</span></button>}
                    {sellerQrCodes.length > 0 && <button onClick={() => setSellerQrSel(sellerQrSel.size === sellerQrCodes.length ? new Set() : new Set(sellerQrCodes.map((_, i) => i)))} className="btn-ghost px-2.5 py-1.5 rounded-lg text-[11px]">{sellerQrSel.size === sellerQrCodes.length ? "Deselect All" : "Select All"}</button>}
                    {sellerQrCodes.length > 0 && <button onClick={dlAllSellerQr} className="btn-ghost px-2.5 py-1.5 rounded-lg text-[11px]"><span>Download All</span></button>}
                  </div>
                </div>
                {sellerQrCodes.length === 0 ? <div className="card-static p-10 text-center"><p className="text-zinc-600 text-sm">No QR codes</p></div> : <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-3">{sellerQrCodes.map((q, i) => (<div key={i} onClick={() => { const n = new Set(sellerQrSel); n.has(i) ? n.delete(i) : n.add(i); setSellerQrSel(n); }} className={`qr-card p-2 flex flex-col items-center cursor-pointer transition-all ${sellerQrSel.has(i) ? "ring-2 ring-purple-500 ring-offset-1" : "hover:ring-1 hover:ring-purple-300"}`}><img src={q.qrImageData} alt="" className="w-20 h-20 object-contain" /><p className="mt-1 text-gray-900 font-mono text-[8px] font-semibold text-center break-all">{q.fleekId}</p></div>))}</div>}
              </div>
            )}
            {sellerTab === "history" && (
              <div>{sellerHistory.length === 0 ? <div className="card-static p-10 text-center"><p className="text-zinc-600 text-sm">No history</p></div> : <div className="card-static overflow-hidden"><div className="divide-y divide-white/5 max-h-[50vh] overflow-y-auto">{sellerHistory.map(h => (<div key={h.id} className="px-4 py-3 flex items-center justify-between hover:bg-white/[0.02]"><div><span className="text-purple-400 font-semibold text-xs">{h.vendor}</span><span className="text-zinc-500 text-[10px] ml-2">{fmtDt(h.createdAt || h.uploadDate)}</span></div><div><span className="text-white text-xs font-bold">{h.totalOrders} orders</span><span className="text-zinc-500 text-[10px] ml-2">{h.totalBoxes} boxes</span></div></div>))}</div></div>}</div>
            )}
          </div>
        )}

        {/* ADMIN/MANAGER: 3PL VIEW */}
        {tab === "3plview" && (
          <div className="animate-fade-in-up">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20"><Icon name="logo" size={16} /></div>
                <div><h2 className="text-white font-semibold text-sm">3PL View</h2><p className="text-zinc-500 text-[10px]">Filter by date, 3PL, vendor</p></div>
              </div>
            </div>

            {/* Filters */}
            <div className="card-static p-4 mb-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                <div>
                  <DateRangePicker label="📅 Date" from={plFilterDate} to={plFilterDate} onFromChange={v => { setPlFilterDate(v); load3plOrders(v); }} onToChange={v => { setPlFilterDate(v); load3plOrders(v); }} />
                </div>
                <ThemedSelect value={plFilter3pl} onChange={(v) => { setPlFilter3pl(v); load3plOrders(undefined, v); }} label="3PL" options={[{ value: "all", label: "All 3PLs" }, { value: "3pl_ecl", label: "ECL" }, { value: "3pl_ge", label: "GE" }, { value: "unassigned", label: "Unassigned" }]} />
                <ThemedSelect value={plFilterVendor} onChange={(v) => { setPlFilterVendor(v); load3plOrders(undefined, undefined, v); }} label="Vendor" options={[{ value: "all", label: "All Vendors" }, ...plFilterVendors.map(v => ({ value: v, label: v }))]} />
                <button onClick={() => load3plOrders()} className="btn-primary py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5">
                  <Icon name="refresh" size={14} /> Load
                </button>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
              <div className="card-static p-3 text-center border border-amber-500/20"><p className="text-xl font-bold text-amber-400">{plTotals.pendingOrders}</p><p className="text-zinc-500 text-[10px]">Pending Orders</p></div>
              <div className="card-static p-3 text-center border border-amber-500/20"><p className="text-xl font-bold text-amber-400">{plTotals.pendingBoxes}</p><p className="text-zinc-500 text-[10px]">Pending Boxes</p></div>
              <div className="card-static p-3 text-center border border-emerald-500/20"><p className="text-xl font-bold text-emerald-400">{plTotals.receivedBoxes}</p><p className="text-zinc-500 text-[10px]">Received</p></div>
              <div className="card-static p-3 text-center border border-cyan-500/20"><p className="text-lg font-bold text-cyan-400 truncate">{plTotals.totalWeight}<span className="text-xs ml-0.5">kg</span></p><p className="text-zinc-500 text-[10px]">Weight</p></div>
              <div className="card-static p-3 text-center border border-indigo-500/20"><p className="text-xl font-bold text-indigo-400">{plTotals.totalVendors}</p><p className="text-zinc-500 text-[10px]">Vendors</p></div>
            </div>

            {/* Vendor Cards */}
            {plOrders.length === 0 ? (
              <div className="card-static p-10 text-center"><p className="text-zinc-500 text-sm">No data for selected filters</p></div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {plOrders.map((v, i) => (
                  <div key={i} className="card-static p-4">
                    <div className="flex items-center justify-between mb-3"><div><p className="text-indigo-400 font-semibold text-sm">{v.vendor}</p><p className="text-zinc-500 text-[10px]">{v.sellerName}</p></div>{v.pendingBoxes === 0 ? <span className="badge badge-success">Done</span> : <span className="badge bg-amber-500/15 text-amber-400">{v.pendingBoxes} pending</span>}</div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="bg-white/[0.04] rounded-lg py-2"><p className="text-white font-bold">{v.uniqueOrders}</p><p className="text-zinc-600 text-[9px]">Orders</p></div>
                      <div className="bg-white/[0.04] rounded-lg py-2"><p className="text-white font-bold">{v.totalBoxes}</p><p className="text-zinc-600 text-[9px]">Boxes</p></div>
                      <div className="bg-white/[0.04] rounded-lg py-2"><p className="text-emerald-400 font-bold">{v.receivedBoxes}</p><p className="text-zinc-600 text-[9px]">Done</p></div>
                      <div className="bg-white/[0.04] rounded-lg py-2"><p className="text-zinc-400 font-bold text-xs">{v.totalWeight}kg</p><p className="text-zinc-600 text-[9px]">Weight</p></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* USERS TAB */}
        {tab === "users" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 animate-fade-in-up">
            <div>
              <div className="card-static overflow-hidden">
                <div className="px-5 pt-5 pb-3 border-b border-white/5"><h2 className="text-white font-semibold text-sm">Add User</h2></div>
                <form onSubmit={addU} className="p-5 space-y-3">
                  <div><label className="text-zinc-400 text-[11px] font-medium mb-1 block">Email</label><input type="email" value={nu.email} onChange={(e) => setNu((p) => ({ ...p, email: e.target.value }))} className="input-field w-full px-3 py-2.5 rounded-xl text-sm" placeholder="user@email.com" required /></div>
                  <div><label className="text-zinc-400 text-[11px] font-medium mb-1 block">Name</label><input type="text" value={nu.name} onChange={(e) => setNu((p) => ({ ...p, name: e.target.value }))} className="input-field w-full px-3 py-2.5 rounded-xl text-sm" placeholder="John Doe" required /></div>
                  <div><label className="text-zinc-400 text-[11px] font-medium mb-1 block">Password</label><input type="password" value={nu.password} onChange={(e) => setNu((p) => ({ ...p, password: e.target.value }))} className="input-field w-full px-3 py-2.5 rounded-xl text-sm" placeholder="••••••" required /></div>
                  <ThemedSelect value={nu.role} onChange={(v) => setNu((p) => ({ ...p, role: v }))} label="Role" options={[{ value: "employee", label: "Employee" }, { value: "manager", label: "Manager" }, { value: "3pl_ecl", label: "3PL — ECL" }, { value: "3pl_ge", label: "3PL — GE" }, { value: "seller", label: "Seller" }]} />
                  <button type="submit" disabled={adding} className="btn-primary w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40">{adding ? <><Spinner size={18} /> <span>Adding...</span></> : <span>Add User</span>}</button>
                </form>
              </div>
            </div>
            <div className="lg:col-span-2">
              <div className="card-static overflow-hidden">
                <div className="px-5 pt-5 pb-3 border-b border-white/5 flex items-center justify-between">
                  <h2 className="text-white font-semibold text-sm">All Users ({users.length})</h2>
                  <button onClick={getU} disabled={loadUsers} className="text-zinc-500 hover:text-white text-[11px] transition-all">{loadUsers ? <Spinner size={14} /> : "Refresh"}</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-white/[0.02] border-b border-white/5"><th className="px-4 py-3 text-left text-zinc-400 font-medium text-[11px]">User</th><th className="px-4 py-3 text-left text-zinc-400 font-medium text-[11px]">Password</th><th className="px-4 py-3 text-left text-zinc-400 font-medium text-[11px]">Role</th><th className="px-4 py-3 text-left text-zinc-400 font-medium text-[11px]">Status</th><th className="px-4 py-3 text-left text-zinc-400 font-medium text-[11px]">Actions</th></tr></thead>
                    <tbody className="divide-y divide-white/5">
                      {users.map((u) => (
                        <tr key={u.id} className="table-row">
                          <td className="px-4 py-3"><p className="text-white text-xs font-medium">{u.name}</p><p className="text-zinc-500 text-[10px] font-mono">{u.email}</p></td>
                          <td className="px-4 py-3"><span className="text-amber-400 text-xs font-mono font-bold bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">{u.plainPassword || "••••"}</span></td>
                          <td className="px-4 py-3"><span className={`badge ${u.role === "admin" ? "badge-warning" : u.role === "manager" ? "badge-purple" : u.role === "3pl_ecl" ? "badge-success" : u.role === "3pl_ge" ? "badge-info" : u.role === "seller" ? "bg-purple-500/15 text-purple-400" : "badge-default"}`}>{u.role === "3pl_ecl" ? "3PL ECL" : u.role === "3pl_ge" ? "3PL GE" : u.role === "seller" ? "Seller" : u.role === "admin" ? "Admin" : u.role === "manager" ? "Manager" : "Employee"}</span></td>
                          <td className="px-4 py-3"><span className={`flex items-center gap-1.5 text-[11px] ${u.isActive ? "text-emerald-400" : "text-red-400"}`}><span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? "bg-emerald-400" : "bg-red-400"}`} />{u.isActive ? "Active" : "Disabled"}</span></td>
                          <td className="px-4 py-3"><div className="flex gap-1.5">
                            <button onClick={() => { setChgPassId(u.id); setChgPassVal(""); }} className="btn-ghost px-2 py-1 rounded text-[10px]">Password</button>
                            {u.role !== "admin" && <button onClick={() => toggleU(u.id, u.isActive)} className={`btn-ghost px-2 py-1 rounded text-[10px] ${u.isActive ? "text-red-400 hover:text-red-300" : "text-emerald-400 hover:text-emerald-300"}`}>{u.isActive ? "Disable" : "Enable"}</button>}
                            {u.role !== "admin" && <button onClick={() => deleteUser(u.id, u.name)} className="btn-ghost px-2 py-1 rounded text-[10px] text-red-400 hover:text-red-300">Delete</button>}
                          </div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════ GRANTED / PERMISSIONS TAB ═══════════════ */}
        {tab === "granted" && (
          <GrantedTab
            permUsers={permUsers}
            permLoading={permLoading}
            permSearch={permSearch}
            setPermSearch={setPermSearch}
            permToolFilter={permToolFilter}
            setPermToolFilter={setPermToolFilter}
            permSaving={permSaving}
            loadPermUsers={loadPermUsers}
            updatePermission={updatePermission}
            toggleAllPermissions={toggleAllPermissions}
            resetPermissions={resetPermissions}
            Spinner={Spinner}
          />
        )}
      </main>

      {/* Modals */}
      {chgPassId !== null && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in" onClick={() => { setChgPassId(null); setChgPassVal(""); }}>
          <div className="card-static p-6 max-w-sm w-full shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-semibold text-base mb-1">Change Password</h3>
            <p className="text-zinc-500 text-xs mb-4">{users.find((u) => u.id === chgPassId)?.email}</p>
            <input type="password" value={chgPassVal} onChange={(e) => setChgPassVal(e.target.value)} className="input-field w-full px-4 py-2.5 rounded-xl text-sm mb-4" placeholder="New password (min 3 chars)" autoFocus />
            <div className="flex gap-2">
              <button onClick={() => changePass(chgPassId, chgPassVal)} disabled={!chgPassVal || chgPassVal.length < 3} className="btn-primary flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"><span>Save</span></button>
              <button onClick={() => { setChgPassId(null); setChgPassVal(""); }} className="btn-ghost px-4 py-2.5 rounded-xl text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {chgOwnPass && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in" onClick={() => { setChgOwnPass(false); setCurrPass(""); setNewPass(""); }}>
          <div className="card-static p-6 max-w-sm w-full shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-semibold text-base mb-4">Change My Password</h3>
            <div className="space-y-3">
              <input type="password" value={currPass} onChange={(e) => setCurrPass(e.target.value)} className="input-field w-full px-4 py-2.5 rounded-xl text-sm" placeholder="Current password" autoFocus />
              <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} className="input-field w-full px-4 py-2.5 rounded-xl text-sm" placeholder="New password (min 3 chars)" />
              <div className="flex gap-2 pt-1">
                <button onClick={() => changePass(user!.id, newPass, currPass)} disabled={!currPass || !newPass || newPass.length < 3} className="btn-primary flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"><span>Save</span></button>
                <button onClick={() => { setChgOwnPass(false); setCurrPass(""); setNewPass(""); }} className="btn-ghost px-4 py-2.5 rounded-xl text-sm">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Scan Log Modal */}
      {editLog && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in" onClick={() => setEditLog(null)}>
          <div className="card-static p-5 sm:p-6 max-w-sm w-full shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-semibold text-base mb-1">Edit Received Log</h3>
            <p className="text-indigo-400 font-mono text-xs font-bold mb-4">{editLog.fleekId}</p>
            <div className="space-y-3">
              <div>
                <label className="text-zinc-400 text-[11px] font-medium mb-1 block">Box Count</label>
                <input type="number" value={editBoxCount} onChange={(e) => setEditBoxCount(e.target.value)} className="input-field w-full px-4 py-2.5 rounded-xl text-sm" placeholder="0" />
              </div>
              <div>
                <label className="text-zinc-400 text-[11px] font-medium mb-1 block">Notes</label>
                <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="input-field w-full px-4 py-2.5 rounded-xl text-sm resize-none h-20" placeholder="Notes..." />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={saveEditLog} className="btn-primary flex-1 py-2.5 rounded-xl text-sm font-semibold"><span>Save Changes</span></button>
                <button onClick={() => setEditLog(null)} className="btn-ghost px-4 py-2.5 rounded-xl text-sm">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Access Requests Popup */}
      {showAccessReqs && (
        <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50 sm:p-4 backdrop-blur-sm animate-fade-in" onClick={() => { setShowAccessReqs(false); setApproveId(null); }}>
          <div className="card-static w-full sm:max-w-lg max-h-[90vh] sm:max-h-[85vh] flex flex-col shadow-2xl animate-scale-in rounded-t-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="px-5 pt-5 pb-3 border-b border-white/5 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-white font-semibold text-base">Access Requests</h3>
                <p className="text-zinc-500 text-xs mt-0.5">{pendingCount} pending</p>
              </div>
              <button onClick={() => { setShowAccessReqs(false); setApproveId(null); }} className="btn-ghost p-1.5 rounded-lg"><Icon name="x" size={18} /></button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-white/5">
              {accessReqs.length === 0 ? (
                <div className="p-8 text-center text-zinc-600 text-sm">No requests yet</div>
              ) : (
                accessReqs.map((req) => (
                  <div key={req.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium">{req.name}</p>
                        <p className="text-zinc-500 text-xs font-mono">{req.email}</p>
                        {req.message && <p className="text-zinc-400 text-xs mt-1.5 bg-white/[0.03] rounded-lg px-3 py-2 border border-white/5">{req.message}</p>}
                        <p className="text-zinc-600 text-[10px] mt-1.5">{new Date(req.createdAt).toLocaleString()}</p>
                      </div>
                      <div className="shrink-0">
                        {req.status === "pending" ? (
                          <span className="badge bg-amber-500/15 text-amber-400">Pending</span>
                        ) : req.status === "approved" ? (
                          <div className="text-right">
                            <span className="badge badge-success">Approved</span>
                            {req.assignedRole && <p className="text-zinc-500 text-[10px] mt-1">as {req.assignedRole}</p>}
                          </div>
                        ) : (
                          <span className="badge badge-danger">Rejected</span>
                        )}
                      </div>
                    </div>

                    {/* Approve/Reject Actions for pending */}
                    {req.status === "pending" && (
                      <div className="mt-3">
                        {approveId === req.id ? (
                          <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3 animate-fade-in space-y-2.5">
                            <div>
                              <label className="text-zinc-400 text-[11px] font-medium mb-1 block">Assign Role</label>
                              <ThemedSelect value={approveRole} onChange={setApproveRole} options={[{ value: "employee", label: "Employee" }, { value: "manager", label: "Manager" }, { value: "3pl_ecl", label: "3PL — ECL" }, { value: "3pl_ge", label: "3PL — GE" }, { value: "seller", label: "Seller" }]} />
                              <p className="text-zinc-600 text-[10px] mt-1">Admin role cannot be assigned</p>
                            </div>
                            <div>
                              <label className="text-zinc-400 text-[11px] font-medium mb-1 block">Set Password</label>
                              <input
                                type="text"
                                value={approvePass}
                                onChange={(e) => setApprovePass(e.target.value)}
                                className="input-field w-full px-3 py-2 rounded-lg text-sm font-mono"
                                placeholder="fleek123"
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleApprove(req.id)}
                                className="btn-primary flex-1 py-2 rounded-lg text-xs font-semibold"
                              >
                                <span>Approve & Create Account</span>
                              </button>
                              <button onClick={() => setApproveId(null)} className="btn-ghost px-3 py-2 rounded-lg text-xs">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={() => { setApproveId(req.id); setApproveRole("employee"); setApprovePass("fleek123"); }}
                              className="flex-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5"
                            >
                              <Icon name="checkmark" size={14} /> Approve
                            </button>
                            <button
                              onClick={() => handleReject(req.id)}
                              className="flex-1 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5"
                            >
                              <Icon name="x" size={14} /> Reject
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Show who reviewed */}
                    {req.status !== "pending" && req.reviewedBy && (
                      <p className="text-zinc-600 text-[10px] mt-2">Reviewed by {req.reviewedBy}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className={`max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 mt-6 sm:mt-8 border-t ${borderColor}`}>
        <p className={`text-center ${textMuted} text-[10px] sm:text-xs flex items-center justify-center gap-1.5`}>
          <Icon name="shield" size={12} />
          FleekTrack — All data permanently stored
        </p>
      </footer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// EXPORT FILTERS — CSV export with date/3PL filters
// ═══════════════════════════════════════════════════════════════
function ExportFilters({ toast, Icon, Spinner }: { toast: (m: string, t: "success" | "error" | "info") => void; Icon: (props: { name: string; size?: number }) => React.ReactElement; Spinner: (props: { size?: number }) => React.ReactElement }) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<{ total: number; dateWise: { date: string; count: number }[] } | null>(null);

  const doExport = async (download: boolean) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type: "received" });
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      if (roleFilter) params.set("role", roleFilter);

      const r = await authFetch(`/api/export?${params}`);
      const d = await r.json();
      if (!r.ok) { toast(d.error || "Failed", "error"); return; }

      setSummary(d.summary);

      if (download && d.csv) {
        const csvContent = [d.csv.headers, ...d.csv.rows].map((row: string[]) => row.map((c: string) => `"${(c || "").replace(/"/g, '""')}"`).join(",")).join("\n");
        const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
        const a = document.createElement("a"); 
        a.download = `FleekTrack_Received_${dateFrom || "all"}_${dateTo || "all"}_${roleFilter || "all"}.csv`; 
        a.href = URL.createObjectURL(blob); a.click();
        toast(`${d.summary.total} records exported!`, "success");
      }
    } catch { toast("Export failed", "error"); }
    finally { setLoading(false); }
  };

  return (
      <div className="card-static p-4 mb-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row gap-3 items-end">
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
          <DateRangePicker label="📅 Date Range" from={dateFrom} to={dateTo} onFromChange={v => { setDateFrom(v); if (!dateTo || v > dateTo) setDateTo(v); }} onToChange={v => setDateTo(v)} />
          <ThemedSelect value={roleFilter} onChange={setRoleFilter} label="3PL Company" options={[{ value: "", label: "All 3PLs" }, { value: "3pl_ecl", label: "ECL Only" }, { value: "3pl_ge", label: "GE Only" }]} />
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => doExport(false)} disabled={loading} className="btn-ghost px-3 py-2 rounded-lg text-[11px] flex items-center gap-1.5">
            {loading ? <Spinner size={14} /> : <Icon name="search" size={14} />} Summary
          </button>
          <button onClick={() => doExport(true)} disabled={loading} className="btn-primary px-3 py-2 rounded-lg text-[11px] flex items-center gap-1.5">
            <span className="flex items-center gap-1.5"><Icon name="download" size={14} /> Export CSV</span>
          </button>
        </div>
      </div>

      {/* Date-wise Summary */}
      {summary && (
        <div className="mt-4 pt-4 border-t border-white/5 animate-fade-in">
          <div className="flex items-center gap-4 mb-3">
            <div className="bg-indigo-500/10 rounded-lg px-3 py-2 border border-indigo-500/20">
              <p className="text-indigo-400 text-lg font-bold">{summary.total}</p>
              <p className="text-zinc-500 text-[10px]">Total Received</p>
            </div>
          </div>
          {summary.dateWise.length > 0 && (
            <div>
              <p className="text-zinc-400 text-[11px] font-medium mb-2">Daily Breakdown</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-1.5">
                {summary.dateWise.slice(0, 30).map((d) => (
                  <div key={d.date} className="bg-white/[0.03] rounded-lg px-2.5 py-1.5 border border-white/5 text-center">
                    <p className="text-white text-xs font-bold">{d.count}</p>
                    <p className="text-zinc-500 text-[9px]">{d.date}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// DETAIL CELL — for search results
// ═══════════════════════════════════════════════════════════════
function DetailCell({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0 bg-white/[0.04] rounded-lg px-2.5 py-2 border border-white/[0.06]">
      <p className="text-indigo-400 text-[10px] font-semibold uppercase tracking-wider">{label}</p>
      <p className="text-white text-sm font-bold truncate mt-0.5">{value || <span className="text-zinc-600 font-normal text-xs">N/A</span>}</p>
    </div>
  );
}

// TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════
function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed top-3 right-3 sm:top-4 sm:right-4 z-50 space-y-2 max-w-[85vw] sm:max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl shadow-2xl text-xs sm:text-sm font-medium flex items-center gap-2 sm:gap-3 animate-toast ${
            t.type === "success" ? "bg-emerald-500 text-white" :
            t.type === "error" ? "bg-red-500 text-white" :
            "bg-indigo-500 text-white"
          }`}
        >
          {t.type === "success" && <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
          {t.type === "error" && <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>}
          {t.type === "info" && <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          {t.message}
        </div>
      ))}
    </div>
  );
}
