"use client";

import { useState, useCallback, useRef, useEffect } from "react";

/* ═══════════════════════════════════════════════════════════════
   FLEEKTRACK - WAREHOUSE MANAGEMENT SYSTEM
   Premium Dark Theme with 3D Animations
   ═══════════════════════════════════════════════════════════════ */

// ─── Types ───
interface User { id: number; email: string; name: string; role: string; }
interface SearchResult { id: number; fleekId: string; latestStatus: string | null; latestStatusDate: string | null; totalOrderLineAmount: string | null; customerCountry: string | null; vendor: string | null; customerName: string | null; quantitySold: string | null; category: string | null; receivedStatus: string | null; receivedDate: string | null; receivedBoxCount: string | null; receivedBy: string | null; }
interface QrResult { fleekId: string; success: boolean; qrImageData?: string; error?: string; }
interface SavedQrCode { id: number; fleekId: string; fleekIdNormalized: string; qrImageData: string; createdAt: string; }
interface UserRow { id: number; email: string; name: string; role: string; isActive: boolean; createdAt: string; }
interface ScanLog { id: number; userId: number; userName: string; userEmail: string; fleekId: string; fleekIdNormalized: string; boxCount: string | null; status: string; scannedAt: string; notes?: string | null; boxDetails?: string | null; }
interface Toast { id: number; message: string; type: "success" | "error" | "info"; }
interface BoxDetail { weight: string; height: string; width: string; length: string; }

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
  const [boxDetails, setBoxDetails] = useState<BoxDetail[]>([]);
  const [marking, setMarking] = useState(false);
  const [scannerOn, setScannerOn] = useState(false);
  const [scanDet, setScanDet] = useState<{ vendor: string | null; quantitySold: string | null; fleekId: string } | null>(null);
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
  const tid = useRef(0);

  // ─── LOGIC FUNCTIONS ───
  const toast = useCallback((m: string, tp: Toast["type"] = "info") => {
    const id = ++tid.current;
    setToasts((p) => [...p, { id, message: m, type: tp }]);
    setTimeout(() => setToasts((p) => p.filter((x) => x.id !== id)), 4000);
  }, []);

  const stats = useCallback(async () => {
    try {
      const r = await fetch("/api/stats");
      const d = await r.json();
      setTotRec(d.totalRecords);
      setTotQr(d.totalQrCodes);
    } catch {}
  }, []);

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
        const r = await fetch("/api/auth/me");
        const d = await r.json();
        if (d.user) {
          setUser(d.user);
          setTab(d.user.role === "3pl" ? "scan" : "upload");
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
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password: pass })
      });
      const d = await r.json();
      if (!r.ok) setLoginErr(d.error || "Login failed");
      else {
        setUser(d.user);
        setTab(d.user.role === "3pl" ? "scan" : "upload");
        stats();
        toast(`Welcome back, ${d.user.name}!`, "success");
      }
    } catch { setLoginErr("Connection error"); }
    setLoginSub(false);
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
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
      const r = await fetch("/api/access-requests", {
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
    try { const r = await fetch("/api/access-requests"); const d = await r.json(); if (r.ok) setAccessReqs(d.requests); } catch {}
  };

  const handleApprove = async (reqId: number) => {
    try {
      const r = await fetch("/api/access-requests", {
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
      const r = await fetch("/api/access-requests", {
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
    if (user && ["admin", "manager"].includes(user.role)) loadAccessReqs();
  }, [user]);

  const upFile = async (f: File) => {
    if (!f.name.endsWith(".csv")) { setUpErr("Only CSV files allowed"); return; }
    const maxSize = 100 * 1024 * 1024;
    if (f.size > maxSize) { setUpErr(`File too large (${(f.size/1024/1024).toFixed(1)}MB). Max 100MB.`); return; }
    
    setUploading(true); setUpErr(""); setUpResult(null);
    setFname(`${f.name} (${(f.size/1024/1024).toFixed(1)}MB)`);
    setProgress(5);
    
    const fd = new FormData(); fd.append("file", f);
    try {
      setProgress(10);
      toast(`Uploading ${f.name}...`, "info");
      const response = await new Promise<Response>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/upload-csv");
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) setProgress(10 + Math.round((e.loaded/e.total)*50)); };
        xhr.onload = () => { setProgress(70); resolve(new Response(xhr.responseText, { status: xhr.status })); };
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.ontimeout = () => reject(new Error("Timeout"));
        xhr.timeout = 300000;
        xhr.send(fd);
      });
      setProgress(80);
      const d = await response.json();
      setProgress(90);
      if (!response.ok) setUpErr(d.error || "Upload failed");
      else {
        setUpResult({ added: d.added, skipped: d.skipped, totalRows: d.totalRows });
        stats();
        if (d.added > 0) toast(`${d.added} new records saved!`, "success");
        else if (d.skipped > 0) toast("All records already exist", "info");
      }
      setProgress(100);
    } catch (err) { setUpErr(err instanceof Error ? err.message : "Network error"); }
    finally { setTimeout(() => { setUploading(false); setProgress(0); setFname(""); }, 800); if (fileRef.current) fileRef.current.value = ""; }
  };

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true); setSErr(""); setQrRes([]); setSel(new Set());
    try {
      const r = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const d = await r.json();
      if (!r.ok) setSErr(d.error || "Search failed");
      else { setResults(d.results); if (d.results.length === 0) toast("No results found", "info"); }
    } catch { setSErr("Network error"); }
    setSearching(false);
  };

  const genQr = async (ids: string[]) => {
    setGening(true);
    try {
      const r = await fetch("/api/generate-qr", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fleekIds: ids }) });
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

  const getU = async () => { setLoadUsers(true); try { const r = await fetch("/api/users"); const d = await r.json(); if (r.ok) setUsers(d.users); } catch {} setLoadUsers(false); };
  const addU = async (e: React.FormEvent) => { e.preventDefault(); setAdding(true); try { const r = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nu) }); const d = await r.json(); if (!r.ok) toast(d.error || "Failed", "error"); else { toast(`${nu.name} added!`, "success"); setNu({ email: "", name: "", password: "", role: "employee" }); getU(); } } catch { toast("Network error", "error"); } setAdding(false); };
  const toggleU = async (id: number, a: boolean) => { try { const r = await fetch("/api/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: id, isActive: !a }) }); if (r.ok) { toast(a ? "User disabled" : "User enabled", "info"); getU(); } } catch {} };
  const changePass = async (userId: number, newP: string, currP?: string) => { try { const r = await fetch("/api/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, newPassword: newP, currentPassword: currP }) }); const d = await r.json(); if (r.ok) { toast("Password changed!", "success"); setChgPassId(null); setChgPassVal(""); setChgOwnPass(false); setCurrPass(""); setNewPass(""); } else toast(d.error || "Failed", "error"); } catch { toast("Network error", "error"); } };

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

      const r = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fleekId: scanId.trim(),
          boxCount: scanBox.trim(),
          notes: scanNotes.trim() || null,
          boxDetails: boxDetailsStr,
        })
      });
      const d = await r.json();
      if (!r.ok) toast(d.error || "Failed", "error");
      else { toast(d.message, "success"); setScanId(""); setScanBox(""); setScanNotes(""); setBoxDetails([]); setScanDet(null); getLogs(); }
    } catch { toast("Network error", "error"); }
    setMarking(false);
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

  const getLogs = async () => { setLoadLogs(true); try { const q = logSearch.trim(); const r = await fetch(`/api/scan${q ? `?q=${encodeURIComponent(q)}` : ""}`); const d = await r.json(); if (r.ok) setSLogs(d.logs); } catch {} setLoadLogs(false); };
  const getSaved = async () => { setLoadQr(true); try { const r = await fetch("/api/qr-codes"); const d = await r.json(); if (r.ok) setSavedQr(d.qrCodes); } catch {} setLoadQr(false); };
  const getBk = async () => { setLoadBk(true); try { const r = await fetch("/api/backend"); const d = await r.json(); if (r.ok) setBkData(d); } catch {} setLoadBk(false); };

  useEffect(() => { if (tab === "qrcodes") getSaved(); if (tab === "users") getU(); if (tab === "received") getLogs(); if (tab === "backend") getBk(); if (tab === "upload" || tab === "search") stats(); }, [tab, stats]);
  useEffect(() => { return () => { stopScan(); }; }, [tab]);
  useEffect(() => { if (user?.role !== "3pl" || !scanId.trim()) { setScanDet(null); return; } const t = setTimeout(async () => { try { const r = await fetch(`/api/search?q=${encodeURIComponent(scanId.trim())}`); const d = await r.json(); if (d.results?.length > 0) setScanDet({ vendor: d.results[0].vendor, quantitySold: d.results[0].quantitySold, fleekId: d.results[0].fleekId }); else setScanDet(null); } catch {} }, 600); return () => clearTimeout(t); }, [scanId, user?.role]);

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
    <div className={`min-h-screen ${theme === "dark" ? "bg-[#0a0a0f]" : "bg-gray-50"} flex items-center justify-center`}>
      <div className="flex flex-col items-center animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl animate-pulse-glow">
          <Icon name="logo" size={32} />
        </div>
        <div className="mt-6"><Spinner size={24} /></div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════
  // 3D FLIP LOGIN CARD
  // ═══════════════════════════════════════════════════════════════
  if (!user) return (
    <div className={`min-h-screen ${theme === "dark" ? "bg-[#0a0a0f]" : "bg-gray-50"} flex items-center justify-center p-4 overflow-hidden`}>
      <Toasts toasts={toasts} />
      
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-float delay-500" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-indigo-500/5 to-purple-500/5 rounded-full blur-3xl" />
      </div>

      {/* 3D Flip Card Container */}
      <div className="perspective-1000 w-full max-w-sm sm:max-w-md animate-fade-in-up">
        <div className={`flip-card preserve-3d relative w-full ${isFlipped ? "flipped" : ""}`}>
          
          {/* ═══ FRONT: SIGN IN ═══ */}
          <div className="backface-hidden w-full">
            <div className="glass-strong rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-2xl">
              {/* Logo */}
              <div className="text-center mb-6 sm:mb-8">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center mx-auto shadow-2xl shadow-indigo-500/30 animate-pulse-glow">
                  <Icon name="logo" size={32} />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-white mt-4 sm:mt-5 tracking-tight">FleekTrack</h1>
                <p className="text-zinc-500 text-xs sm:text-sm mt-1">Warehouse Management System</p>
              </div>

              {/* Form */}
              <form onSubmit={login} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-zinc-400 text-xs font-medium flex items-center gap-2">
                    <Icon name="mail" size={14} /> Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-field w-full px-4 py-3 rounded-xl text-sm"
                    placeholder="you@company.com"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-zinc-400 text-xs font-medium flex items-center gap-2">
                    <Icon name="lock" size={14} /> Password
                  </label>
                  <input
                    type="password"
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                    className="input-field w-full px-4 py-3 rounded-xl text-sm"
                    placeholder="••••••••"
                  />
                </div>

                {loginErr && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-xs flex items-center gap-2 animate-fade-in">
                    <Icon name="x" size={16} /> {loginErr}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loginSub}
                  className="btn-primary w-full py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loginSub ? <><Spinner size={18} /> <span>Signing in...</span></> : <span>Sign In</span>}
                </button>
              </form>

              {/* Flip Trigger */}
              <div className="mt-6 pt-6 border-t border-white/5 text-center">
                <p className="text-zinc-500 text-sm">Don&apos;t have an account?</p>
                <button
                  onClick={() => setIsFlipped(true)}
                  className="text-indigo-400 hover:text-indigo-300 text-sm font-medium mt-1 transition-colors"
                >
                  Request Access →
                </button>
              </div>
            </div>
          </div>

          {/* ═══ BACK: REQUEST ACCESS ═══ */}
          <div className="backface-hidden w-full absolute inset-0 rotate-y-180">
            <div className="glass-strong rounded-3xl p-8 shadow-2xl h-full">
              {reqSent ? (
                <div className="h-full flex flex-col items-center justify-center text-center animate-scale-in">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mb-6 shadow-2xl shadow-emerald-500/30">
                    <Icon name="checkmark" size={40} />
                  </div>
                  <h2 className="text-xl font-bold text-white">Request Submitted!</h2>
                  <p className="text-zinc-400 text-sm mt-2 max-w-xs">
                    We&apos;ll review your request and get back to you within 24 hours.
                  </p>
                  <button
                    onClick={() => { setIsFlipped(false); setReqSent(false); setReqEmail(""); setReqName(""); setReqMsg(""); }}
                    className="btn-ghost mt-8 px-6 py-2.5 rounded-xl text-sm font-medium"
                  >
                    ← Back to Sign In
                  </button>
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mx-auto shadow-2xl shadow-purple-500/30">
                      <Icon name="user" size={32} />
                    </div>
                    <h2 className="text-xl font-bold text-white mt-4">Request Access</h2>
                    <p className="text-zinc-500 text-sm mt-1">Get your account credentials</p>
                  </div>

                  {/* Form */}
                  <form onSubmit={handleRequestAccess} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-zinc-400 text-xs font-medium">Full Name</label>
                      <input
                        type="text"
                        value={reqName}
                        onChange={(e) => setReqName(e.target.value)}
                        className="input-field w-full px-4 py-3 rounded-xl text-sm"
                        placeholder="John Doe"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-zinc-400 text-xs font-medium">Work Email</label>
                      <input
                        type="email"
                        value={reqEmail}
                        onChange={(e) => setReqEmail(e.target.value)}
                        className="input-field w-full px-4 py-3 rounded-xl text-sm"
                        placeholder="john@company.com"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-zinc-400 text-xs font-medium">Message (Optional)</label>
                      <textarea
                        value={reqMsg}
                        onChange={(e) => setReqMsg(e.target.value)}
                        className="input-field w-full px-4 py-3 rounded-xl text-sm resize-none h-20"
                        placeholder="Why do you need access?"
                      />
                    </div>

                    <button
                      type="submit"
                      className="btn-primary w-full py-3.5 rounded-xl text-sm font-semibold"
                    >
                      <span>Submit Request</span>
                    </button>
                  </form>

                  {/* Flip Back */}
                  <div className="mt-6 pt-6 border-t border-white/5 text-center">
                    <button
                      onClick={() => setIsFlipped(false)}
                      className="text-zinc-400 hover:text-white text-sm font-medium transition-colors"
                    >
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

      {/* Footer */}
      <div className="absolute bottom-6 left-0 right-0 text-center">
        <p className={`text-xs flex items-center justify-center gap-1.5 ${theme === "dark" ? "text-zinc-600" : "text-gray-500"}`}>
          <Icon name="shield" size={14} />
          All data permanently stored — never deleted
        </p>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════
  // 3PL SCANNER VIEW
  // ═══════════════════════════════════════════════════════════════
  if (user.role === "3pl") return (
    <div className={`min-h-screen ${theme === "dark" ? "bg-[#0a0a0f]" : "bg-gray-50"} flex flex-col`}>
      <Toasts toasts={toasts} />

      {/* Header */}
      <header className="glass border-b border-white/5 px-3 sm:px-4 py-3 sm:py-4 animate-fade-in-down">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
              <Icon name="box" size={18} />
            </div>
            <div>
              <h1 className="text-white font-semibold text-xs sm:text-sm">3PL Receiving</h1>
              <p className="text-zinc-500 text-[10px] sm:text-xs">{user.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className="btn-ghost p-2 rounded-lg" title={theme === "dark" ? "Light Mode" : "Dark Mode"}>
              <Icon name={theme === "dark" ? "sun" : "moon"} size={16} />
            </button>
            <button onClick={logout} className="btn-ghost px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5">
              <Icon name="logout" size={14} /> Logout
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col p-3 sm:p-4 max-w-lg mx-auto w-full gap-3 sm:gap-4">
        {/* Scanner Card */}
        <div className="card-static p-4 sm:p-5 animate-fade-in-up delay-100">
          <h2 className="text-white font-semibold text-xs sm:text-sm mb-3 sm:mb-4 flex items-center gap-2">
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
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 animate-fade-in">
                <p className="text-emerald-400 text-xs font-semibold mb-2">Order Found</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-zinc-500 text-[10px]">Vendor</p><p className="text-white text-sm font-medium">{scanDet.vendor || "—"}</p></div>
                  <div><p className="text-zinc-500 text-[10px]">Quantity</p><p className="text-white text-sm font-medium">{scanDet.quantitySold || "—"}</p></div>
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

            <button
              onClick={markRec}
              disabled={marking || !scanId.trim() || !scanBox.trim()}
              className="btn-primary w-full py-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {marking ? <><Spinner size={20} /> <span>Processing...</span></> : <><Icon name="checkmark" size={20} /> <span>Mark Received</span></>}
            </button>
          </div>
        </div>

        {/* Recent Scans */}
        <div className="card-static flex-1 overflow-hidden animate-fade-in-up delay-200">
          <div className="p-4 border-b border-white/5">
            <h3 className="text-white font-semibold text-sm">Recent Activity</h3>
          </div>
          {sLogs.length === 0 ? (
            <div className="p-8 text-center text-zinc-600 text-sm">No scans yet</div>
          ) : (
            <div className="divide-y divide-white/5 max-h-64 overflow-y-auto">
              {sLogs.slice(0, 20).map((l, i) => (
                <div key={l.id} className="px-4 py-3 table-row animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-emerald-400 font-mono text-xs font-semibold">{l.fleekId}</p>
                      <p className="text-zinc-600 text-[10px] mt-0.5">{new Date(l.scannedAt).toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <span className="badge badge-success">Received</span>
                      {l.boxCount && <p className="text-zinc-500 text-[10px] mt-1">{l.boxCount} boxes</p>}
                    </div>
                  </div>
                  {l.notes && <p className="text-amber-400/80 text-[10px] mt-1.5 bg-amber-500/5 rounded px-2 py-1 border border-amber-500/10">📝 {l.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════
  // MAIN DASHBOARD
  // ═══════════════════════════════════════════════════════════════
  const isAdmin = user.role === "admin";
  const tabItems = [
    { k: "upload", label: "Upload", icon: "upload" },
    { k: "search", label: "Search", icon: "search" },
    { k: "qrcodes", label: "QR Codes", icon: "qr" },
    { k: "received", label: "Received", icon: "check" },
    ...(isAdmin ? [{ k: "backend", label: "Database", icon: "database" }, { k: "users", label: "Users", icon: "users" }] : []),
  ];

  // Theme classes
  const dk = theme === "dark";
  const bg = dk ? "bg-[#0a0a0f]" : "bg-gray-50";
  const cardBg = dk ? "bg-[#16161f]" : "bg-white";
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

      {/* Header */}
      <header className={`${glassHeader} border-b ${borderColor} sticky top-0 z-40 animate-fade-in-down`}>
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
              <Icon name="logo" size={18} />
            </div>
            <div className="min-w-0">
              <h1 className={`${textPrimary} font-semibold text-xs sm:text-sm`}>FleekTrack</h1>
              <p className={`${textSecondary} text-[10px] sm:text-xs truncate`}>{user.name} · <span className="capitalize">{user.role}</span></p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
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

            {/* Access Requests Bell - admin/manager only */}
            {["admin", "manager"].includes(user.role) && (
              <button
                onClick={() => { setShowAccessReqs(true); loadAccessReqs(); }}
                className="btn-ghost p-2 rounded-lg relative"
                title="Access Requests"
              >
                <Icon name="bell" size={18} />
                {pendingCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse">{pendingCount}</span>
                )}
              </button>
            )}

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
          <div className="max-w-2xl mx-auto space-y-3 sm:space-y-4 animate-fade-in-up">
            {/* Info Banner */}
            <div className="gradient-border p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                <Icon name="shield" size={18} />
              </div>
              <div>
                <p className={`${textPrimary} text-xs sm:text-sm font-medium`}>Data Permanently Saved</p>
                <p className={`${textSecondary} text-[10px] sm:text-xs mt-0.5`}>New records only. Existing data never modified.</p>
              </div>
            </div>

            {/* Upload Card */}
            <div className="card-static overflow-hidden">
              <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b border-white/5">
                <h2 className="text-white font-semibold text-base sm:text-lg">Upload CSV</h2>
                <p className={`${textSecondary} text-xs sm:text-sm mt-1`}>Import orders — duplicates auto-skipped</p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {["fleek_id", "vendor", "quantity_sold", "category", "customer_name"].map((c) => (
                    <span key={c} className="badge badge-info font-mono">{c}</span>
                  ))}
                </div>
              </div>

              <div className="p-4 sm:p-6">
                <div
                  onDrop={(e) => { e.preventDefault(); setDragging(false); e.dataTransfer.files[0] && upFile(e.dataTransfer.files[0]); }}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onClick={() => fileRef.current?.click()}
                  className={`relative flex flex-col items-center justify-center h-40 sm:h-48 border-2 border-dashed rounded-xl sm:rounded-2xl cursor-pointer transition-all ${
                    dragging ? "border-indigo-500 bg-indigo-500/5" : uploading ? "border-emerald-500/40 bg-emerald-500/5" : `${theme === "dark" ? "border-white/10 hover:border-white/20 hover:bg-white/[0.02]" : "border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/30"}`
                  }`}
                >
                  {uploading && <div className="absolute bottom-0 left-0 h-1 progress-bar rounded-full transition-all" style={{ width: `${progress}%` }} />}
                  
                  <div className="flex flex-col items-center">
                    {uploading ? (
                      <><Spinner size={32} /><p className="text-emerald-400 text-sm font-medium mt-4">{fname}</p><p className="text-zinc-500 text-xs mt-1">{progress}% complete</p></>
                    ) : dragging ? (
                      <p className="text-indigo-400 font-medium">Drop file here</p>
                    ) : (
                      <>
                        <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-3">
                          <Icon name="upload" size={24} />
                        </div>
                        <p className="text-zinc-400 text-sm"><span className="text-indigo-400 font-medium">Click to upload</span> or drag & drop</p>
                        <p className="text-zinc-600 text-xs mt-1">CSV files up to 100MB</p>
                      </>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept=".csv" onChange={(e) => e.target.files?.[0] && upFile(e.target.files[0])} className="hidden" disabled={uploading} />
                </div>

                {upErr && <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm animate-fade-in">{upErr}</div>}

                {upResult && (
                  <div className="mt-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-5 animate-scale-in">
                    <p className="text-emerald-400 font-semibold text-sm mb-4">Upload Complete</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-white/5 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-white">{upResult.totalRows}</p><p className="text-zinc-500 text-[10px] mt-1">Total Rows</p></div>
                      <div className="bg-emerald-500/10 rounded-xl p-4 text-center border border-emerald-500/20"><p className="text-2xl font-bold text-emerald-400">{upResult.added}</p><p className="text-emerald-400/60 text-[10px] mt-1">Added</p></div>
                      <div className="bg-white/5 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-zinc-400">{upResult.skipped}</p><p className="text-zinc-500 text-[10px] mt-1">Skipped</p></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SEARCH TAB */}
        {tab === "search" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 animate-fade-in-up">
            <div className="space-y-3 sm:space-y-4">
              <div className="card-static p-4 sm:p-5">
                <h2 className="text-white font-semibold text-sm sm:text-base mb-1">Search Orders</h2>
                <p className="text-zinc-500 text-xs mb-4">Enter Fleek IDs (comma or newline separated)</p>
                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); search(); } }}
                  placeholder={"158985_30\n158984_14, 158983_70"}
                  className="input-field w-full px-4 py-3 rounded-xl resize-none h-28 text-sm font-mono"
                />
                <button onClick={search} disabled={searching || !query.trim()} className="btn-primary w-full py-3 rounded-xl text-sm font-semibold mt-3 flex items-center justify-center gap-2 disabled:opacity-40">
                  {searching ? <><Spinner size={18} /> <span>Searching...</span></> : <><Icon name="search" size={18} /> <span>Search</span></>}
                </button>
                {sErr && <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-xs">{sErr}</div>}
              </div>

              {results.length > 0 && (
                <div className="card-static overflow-hidden animate-fade-in">
                  <div className="p-4 border-b border-white/5 flex items-center justify-between flex-wrap gap-2">
                    <h3 className="text-white font-semibold text-sm">Results <span className="text-indigo-400">({results.length})</span></h3>
                    <div className="flex gap-1.5">
                      <button onClick={exportCSV} className="btn-ghost px-3 py-1.5 rounded-lg text-[11px]">Export CSV</button>
                      <button onClick={() => setSel(sel.size === results.length ? new Set() : new Set(results.map((_, i) => i)))} className="btn-ghost px-3 py-1.5 rounded-lg text-[11px]">{sel.size === results.length ? "Deselect" : "Select All"}</button>
                      <button onClick={() => { const ids = Array.from(sel).map((i) => results[i]?.fleekId).filter(Boolean) as string[]; ids.length && genQr(ids); }} disabled={gening || sel.size === 0} className="btn-primary px-3 py-1.5 rounded-lg text-[11px] disabled:opacity-40"><span>QR ({sel.size})</span></button>
                    </div>
                  </div>
                  <div className="max-h-[55vh] overflow-y-auto divide-y divide-white/5">
                    {results.map((r, i) => (
                      <div key={r.id} className={`px-4 py-3 transition-all table-row ${sel.has(i) ? "bg-indigo-500/5" : ""}`}>
                        <div className="flex items-start gap-3">
                          <input type="checkbox" checked={sel.has(i)} onChange={() => { const n = new Set(sel); n.has(i) ? n.delete(i) : n.add(i); setSel(n); }} className="mt-1 w-4 h-4 accent-indigo-500 cursor-pointer rounded" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <span className="text-indigo-400 font-mono font-semibold text-xs">{r.fleekId}</span>
                              <button onClick={() => genQr([r.fleekId])} disabled={gening} className="badge badge-success cursor-pointer hover:opacity-80">Generate QR</button>
                              {r.receivedStatus === "received" && <span className="badge badge-success">Received</span>}
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-[11px]">
                              {r.vendor && <div><span className="text-zinc-600">Vendor: </span><span className="text-zinc-300">{r.vendor}</span></div>}
                              {r.customerCountry && <div><span className="text-zinc-600">Country: </span><span className="text-zinc-300">{r.customerCountry}</span></div>}
                              {r.quantitySold && <div><span className="text-zinc-600">Qty: </span><span className="text-zinc-300">{r.quantitySold}</span></div>}
                            </div>
                          </div>
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
              <h2 className="text-white font-semibold text-base sm:text-lg">QR Library <span className="text-indigo-400 text-xs sm:text-sm">({savedQr.length})</span></h2>
              <div className="flex gap-2">
                {savedQr.length > 0 && <button onClick={() => dlAllQr(savedQr, "All_QR")} className="btn-primary px-4 py-2 rounded-xl text-xs font-medium"><span>Download All</span></button>}
                <button onClick={getSaved} disabled={loadQr} className="btn-ghost px-3 py-2 rounded-xl text-xs flex items-center gap-1.5">{loadQr ? <Spinner size={14} /> : <Icon name="refresh" size={14} />} Refresh</button>
              </div>
            </div>
            {savedQr.length === 0 ? (
              <div className="card-static p-12 text-center"><p className="text-zinc-600 text-sm">No QR codes yet</p></div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {savedQr.map((q, i) => (
                  <div key={q.id} className="qr-card p-3 flex flex-col items-center animate-fade-in" style={{ animationDelay: `${i * 30}ms` }}>
                    <img src={q.qrImageData} alt="" className="w-24 h-24 sm:w-28 sm:h-28 object-contain" />
                    <p className="mt-2 text-gray-900 font-mono text-[10px] font-semibold text-center break-all">{q.fleekId}</p>
                    <p className="text-gray-400 text-[9px]">{new Date(q.createdAt).toLocaleDateString()}</p>
                    <button onClick={() => dlQr(q.qrImageData, q.fleekId)} className="mt-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-medium px-3 py-1 rounded transition-all">Download</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* RECEIVED TAB */}
        {tab === "received" && (
          <div className="animate-fade-in-up">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between mb-4 gap-3">
              <h2 className="text-white font-semibold text-base sm:text-lg">Received Logs</h2>
              <div className="flex gap-2">
                <input type="text" value={logSearch} onChange={(e) => setLogSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") getLogs(); }} placeholder="Search..." className="input-field flex-1 sm:w-48 px-3 py-2 rounded-xl text-xs" />
                <button onClick={getLogs} disabled={loadLogs} className="btn-ghost px-3 py-2 rounded-xl text-xs">{loadLogs ? <Spinner size={14} /> : "Search"}</button>
              </div>
            </div>
            {sLogs.length === 0 ? (
              <div className="card-static p-12 text-center"><p className="text-zinc-600 text-sm">No received records yet</p></div>
            ) : (
              <div className="card-static overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-white/[0.02] border-b border-white/5"><th className="px-4 py-3 text-left text-zinc-400 font-medium text-[11px]">Fleek ID</th><th className="px-4 py-3 text-left text-zinc-400 font-medium text-[11px]">Scanned By</th><th className="px-4 py-3 text-left text-zinc-400 font-medium text-[11px] hidden sm:table-cell">Email</th><th className="px-4 py-3 text-left text-zinc-400 font-medium text-[11px]">Boxes</th><th className="px-4 py-3 text-left text-zinc-400 font-medium text-[11px]">Status</th><th className="px-4 py-3 text-left text-zinc-400 font-medium text-[11px]">Date</th></tr></thead>
                    <tbody className="divide-y divide-white/5">
                      {sLogs.map((l, i) => (
                        <tr key={l.id} className="table-row animate-fade-in" style={{ animationDelay: `${i * 20}ms` }}>
                          <td className="px-4 py-3 text-indigo-400 font-mono font-semibold">{l.fleekId}</td>
                          <td className="px-4 py-3 text-zinc-300">{l.userName}</td>
                          <td className="px-4 py-3 text-zinc-500 hidden sm:table-cell">{l.userEmail}</td>
                          <td className="px-4 py-3 text-white font-semibold">{l.boxCount || "—"}</td>
                          <td className="px-4 py-3"><span className="badge badge-success">Received</span></td>
                          <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">{new Date(l.scannedAt).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* DATABASE TAB */}
        {tab === "backend" && isAdmin && (
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

        {/* USERS TAB */}
        {tab === "users" && isAdmin && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 animate-fade-in-up">
            <div>
              <div className="card-static overflow-hidden">
                <div className="px-5 pt-5 pb-3 border-b border-white/5"><h2 className="text-white font-semibold text-sm">Add User</h2></div>
                <form onSubmit={addU} className="p-5 space-y-3">
                  <div><label className="text-zinc-400 text-[11px] font-medium mb-1 block">Email</label><input type="email" value={nu.email} onChange={(e) => setNu((p) => ({ ...p, email: e.target.value }))} className="input-field w-full px-3 py-2.5 rounded-xl text-sm" placeholder="user@email.com" required /></div>
                  <div><label className="text-zinc-400 text-[11px] font-medium mb-1 block">Name</label><input type="text" value={nu.name} onChange={(e) => setNu((p) => ({ ...p, name: e.target.value }))} className="input-field w-full px-3 py-2.5 rounded-xl text-sm" placeholder="John Doe" required /></div>
                  <div><label className="text-zinc-400 text-[11px] font-medium mb-1 block">Password</label><input type="password" value={nu.password} onChange={(e) => setNu((p) => ({ ...p, password: e.target.value }))} className="input-field w-full px-3 py-2.5 rounded-xl text-sm" placeholder="••••••" required /></div>
                  <div><label className="text-zinc-400 text-[11px] font-medium mb-1 block">Role</label><select value={nu.role} onChange={(e) => setNu((p) => ({ ...p, role: e.target.value }))} className="input-field w-full px-3 py-2.5 rounded-xl text-sm"><option value="employee">Employee</option><option value="manager">Manager</option><option value="3pl">3PL (Scanner)</option></select></div>
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
                    <thead><tr className="bg-white/[0.02] border-b border-white/5"><th className="px-4 py-3 text-left text-zinc-400 font-medium text-[11px]">User</th><th className="px-4 py-3 text-left text-zinc-400 font-medium text-[11px]">Role</th><th className="px-4 py-3 text-left text-zinc-400 font-medium text-[11px]">Status</th><th className="px-4 py-3 text-left text-zinc-400 font-medium text-[11px]">Actions</th></tr></thead>
                    <tbody className="divide-y divide-white/5">
                      {users.map((u) => (
                        <tr key={u.id} className="table-row">
                          <td className="px-4 py-3"><p className="text-white text-xs font-medium">{u.name}</p><p className="text-zinc-500 text-[10px] font-mono">{u.email}</p></td>
                          <td className="px-4 py-3"><span className={`badge ${u.role === "admin" ? "badge-warning" : u.role === "manager" ? "badge-purple" : u.role === "3pl" ? "badge-success" : "badge-default"}`}>{u.role === "3pl" ? "3PL" : u.role.charAt(0).toUpperCase() + u.role.slice(1)}</span></td>
                          <td className="px-4 py-3"><span className={`flex items-center gap-1.5 text-[11px] ${u.isActive ? "text-emerald-400" : "text-red-400"}`}><span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? "bg-emerald-400" : "bg-red-400"}`} />{u.isActive ? "Active" : "Disabled"}</span></td>
                          <td className="px-4 py-3"><div className="flex gap-1.5">
                            <button onClick={() => { setChgPassId(u.id); setChgPassVal(""); }} className="btn-ghost px-2 py-1 rounded text-[10px]">Password</button>
                            {u.role !== "admin" && <button onClick={() => toggleU(u.id, u.isActive)} className={`btn-ghost px-2 py-1 rounded text-[10px] ${u.isActive ? "text-red-400 hover:text-red-300" : "text-emerald-400 hover:text-emerald-300"}`}>{u.isActive ? "Disable" : "Enable"}</button>}
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
                              <select
                                value={approveRole}
                                onChange={(e) => setApproveRole(e.target.value)}
                                className="input-field w-full px-3 py-2 rounded-lg text-sm"
                              >
                                <option value="employee">Employee</option>
                                <option value="manager">Manager</option>
                                <option value="3pl">3PL (Scanner Only)</option>
                              </select>
                              <p className="text-zinc-600 text-[10px] mt-1">Admin role cannot be assigned here</p>
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
