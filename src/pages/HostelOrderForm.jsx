import { useState, useEffect, useRef } from "react";
import {
  collection, addDoc, getDocs, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase";
import BrandLogo from "../components/Shared/BrandLogo";
import {
  FiUser, FiHome, FiHash, FiSend, FiCheckCircle,
  FiPhone, FiMail, FiAlertCircle, FiLoader, FiChevronDown,
  FiCalendar, FiShoppingBag, FiArrowLeft, FiClock, FiStar,
  FiZap, FiRefreshCw, FiMessageSquare, FiAlertTriangle,
  FiFileText, FiImage, FiX, FiUploadCloud,
} from "react-icons/fi";

/* ─────────────────────────────────────────────
   DAY UTILITIES
───────────────────────────────────────────── */
const DAY_NUM = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_FULL   = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Returns the next Date (starting from tomorrow) that falls on one of the given day names */
function getNextPickupDate(pickupDayNames = []) {
  const dayNums = pickupDayNames.map((d) => DAY_NUM[d.toLowerCase()]).filter((n) => n !== undefined);
  const today = new Date();
  for (let i = 1; i <= 7; i++) {
    const candidate = new Date(today);
    candidate.setDate(today.getDate() + i);
    candidate.setHours(0, 0, 0, 0);
    if (dayNums.includes(candidate.getDay())) return candidate;
  }
  return null;
}

function formatDateDisplay(date) {
  if (!date) return "—";
  return date.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", year: "numeric" });
}

const STATS = [
  { icon: <FiStar size={18} />, value: "500+", label: "Happy Students" },
  { icon: <FiZap size={18} />, value: "24h", label: "Turnaround" },
  { icon: <FiClock size={18} />, value: "12", label: "Hostels Served" },
];

function Bubble({ style }) {
  return (
    <div
      className="absolute rounded-full pointer-events-none"
      style={{ background: "rgba(255,255,255,0.08)", animation: "floatBubble 8s ease-in-out infinite", ...style }}
    />
  );
}

/* ─────────────────────────────────────────────
   ISSUE CATEGORIES
───────────────────────────────────────────── */
const ISSUE_CATEGORIES = [
  "Missing Clothes",
  "Damaged / Torn Clothes",
  "Wrong Clothes Delivered",
  "Late Delivery",
  "Poor Washing Quality",
  "Incorrect Billing",
  "Staff Behaviour",
  "Other",
];

/* ════════════════════════════════════════
   RAISE ISSUE FORM COMPONENT
════════════════════════════════════════ */
const MAX_PHOTOS = 4;
const MAX_FILE_MB = 5;

function RaiseIssueForm({ hostels, configLoading, configError }) {
  const [form, setForm] = useState({
    userName: "", userMobile: "", hostel: "", room: "", issue: "", issueDetails: "",
  });
  const [hostelOpen, setHostelOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  /* ── Image upload state ── */
  const [photos, setPhotos] = useState([]); // [{ file, preview, id }]
  const [uploadProgress, setUploadProgress] = useState({}); // { id: 0-100 }
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const hostelDropRef = useRef(null);
  const issueDropRef = useRef(null);
  const cooldownRef = useRef(null);

  /* ── Cleanup object URLs on unmount ── */
  useEffect(() => {
    return () => photos.forEach((p) => URL.revokeObjectURL(p.preview));
  }, [photos]);

  /* ── Close dropdowns on outside click ── */
  useEffect(() => {
    const handler = (e) => {
      if (hostelDropRef.current && !hostelDropRef.current.contains(e.target)) setHostelOpen(false);
      if (issueDropRef.current && !issueDropRef.current.contains(e.target)) setIssueOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setError("");
  };

  /* ── Add photos helper ── */
  const addFiles = (files) => {
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) return;
    const accepted = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .filter((f) => f.size <= MAX_FILE_MB * 1024 * 1024)
      .slice(0, remaining);
    const newPhotos = accepted.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      id: `${Date.now()}-${Math.random()}`,
    }));
    setPhotos((prev) => [...prev, ...newPhotos]);
  };

  const removePhoto = (id) => {
    setPhotos((prev) => {
      const p = prev.find((x) => x.id === id);
      if (p) URL.revokeObjectURL(p.preview);
      return prev.filter((x) => x.id !== id);
    });
    setUploadProgress((prev) => { const n = { ...prev }; delete n[id]; return n; });
  };

  /* ── Progress ── */
  const filledCount = [
    form.userName.trim(), form.userMobile.trim(),
    form.hostel, form.room.trim(), form.issue,
  ].filter(Boolean).length;
  const progress = Math.round((filledCount / 5) * 100);

  const inputCls = (field) =>
    `w-full pl-10 pr-4 py-3 rounded-xl border text-sm text-gray-900 focus:outline-none transition-all duration-200 placeholder-gray-300 bg-white ${
      focusedField === field
        ? "border-[#C62828] ring-2 ring-[#C62828]/20 shadow-sm"
        : "border-gray-200 hover:border-gray-300"
    }`;

  const validate = () => {
    if (!form.userName.trim()) return "Please enter your full name.";
    const digitsOnly = (form.userMobile.match(/\d/g) || []).length;
    if (!form.userMobile.trim() || !/^\+?[\d\s\-]{7,15}$/.test(form.userMobile) || digitsOnly < 7)
      return "Please enter a valid mobile number (min 7 digits).";
    if (!form.hostel) return "Please select your hostel.";
    if (!form.room.trim()) return "Please enter your room number.";
    if (!form.issue) return "Please select an issue category.";
    return null;
  };

  /* ── Upload a single photo to Firebase Storage ── */
  const uploadPhoto = (photo) =>
    new Promise((resolve, reject) => {
      const path = `complaints/${Date.now()}_${photo.file.name}`;
      const storageRef = ref(storage, path);
      const task = uploadBytesResumable(storageRef, photo.file);
      task.on(
        "state_changed",
        (snap) => {
          const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
          setUploadProgress((prev) => ({ ...prev, [photo.id]: pct }));
        },
        reject,
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve(url);
        }
      );
    });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (cooldown > 0) { setError(`Please wait ${cooldown}s before submitting again.`); return; }
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setSubmitting(true);
    setError("");
    try {
      /* Upload all images first, collect URLs */
      const photoUrls = photos.length > 0
        ? await Promise.all(photos.map(uploadPhoto))
        : [];

      const mobile = form.userMobile.trim().startsWith("+")
        ? form.userMobile.trim()
        : `+91${form.userMobile.trim().replace(/\D/g, "")}`;

      await addDoc(collection(db, "complaint"), {
        userName: form.userName.trim(),
        userMobile: mobile,
        hostel: form.hostel,
        room: form.room.trim().toUpperCase(),
        issue: form.issue + (form.issueDetails.trim() ? ` — ${form.issueDetails.trim()}` : ""),
        status: "open",
        flagged: false,
        photoUrls,
        orderId: "",
        userId: "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setSubmitted(true);
      setCooldown(30);
      cooldownRef.current = setInterval(() => {
        setCooldown((c) => {
          if (c <= 1) { clearInterval(cooldownRef.current); return 0; }
          return c - 1;
        });
      }, 1000);
    } catch (err) {
      console.error("Issue submission error:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSubmitted(false);
    setPhotos([]);
    setUploadProgress({});
    setForm({ userName: "", userMobile: "", hostel: "", room: "", issue: "", issueDetails: "" });
  };

  /* ── Success screen ── */
  if (submitted) {
    return (
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xl p-10 text-center" style={{ animation: "slideUp 0.5s ease" }}>
        <div className="w-20 h-20 bg-gradient-to-br from-red-400 to-rose-500 rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg shadow-red-200">
          <FiCheckCircle size={38} className="text-white" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-1">Issue Reported!</h3>
        <p className="text-gray-400 text-sm mb-6">
          Our team will review your complaint and get back to you shortly.
        </p>

        <div className="grid grid-cols-2 gap-3 text-left mb-6">
          {[
            { label: "Name", value: form.userName },
            { label: "Room", value: form.room.toUpperCase() },
            { label: "Hostel", value: form.hostel },
            { label: "Issue", value: form.issue },
          ].map(({ label, value }) => (
            <div key={label} className="bg-red-50 rounded-2xl p-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">{label}</p>
              <p className="text-sm font-semibold text-gray-800 truncate">{value}</p>
            </div>
          ))}
        </div>

        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3.5 mb-6 text-left flex items-start gap-2.5">
          <FiAlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 font-medium leading-relaxed">
            Your complaint has been logged as <span className="font-bold">open</span>. Keep your mobile handy — we may contact you for more details.
          </p>
        </div>

        <button
          onClick={handleReset}
          className="w-full py-3.5 font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 hover:-translate-y-0.5 text-white"
          style={{ background: "linear-gradient(135deg,#C62828 0%,#B71C1C 100%)", boxShadow: "0 8px 24px rgba(198,40,40,0.30)" }}
        >
          <FiArrowLeft size={16} /> Raise Another Issue
        </button>
      </div>
    );
  }

  if (configLoading) {
    return (
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xl p-12 flex flex-col items-center justify-center gap-3">
        <FiLoader size={28} className="text-[#C62828] animate-spin" />
        <p className="text-sm text-gray-400 font-medium">Loading hostel configuration…</p>
      </div>
    );
  }

  if (configError) {
    return (
      <div className="bg-white rounded-3xl border border-red-100 shadow-xl p-10 flex flex-col items-center gap-4 text-center">
        <FiAlertCircle size={36} className="text-red-400" />
        <div>
          <p className="font-bold text-gray-800 mb-1">Failed to load configuration</p>
          <p className="text-xs text-gray-400">Could not fetch hostel list. Please check your connection.</p>
        </div>
        <button onClick={() => window.location.reload()} className="flex items-center gap-2 text-sm text-[#C62828] font-semibold hover:underline">
          <FiRefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-visible p-6">
      <form onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

          {/* LEFT COLUMN: YOUR DETAILS */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
              <span className="w-5 h-5 rounded-full bg-red-100 text-[#C62828] text-[10px] font-bold flex items-center justify-center">1</span>
              <p className="text-[11px] font-bold text-gray-400 tracking-[0.12em] uppercase">Your Details</p>
            </div>

            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Full Name</label>
              <div className="relative">
                <FiUser size={14} className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${focusedField === "userName" ? "text-[#C62828]" : "text-gray-400"}`} />
                <input
                  id="issue_userName" type="text"
                  value={form.userName} onChange={set("userName")}
                  onFocus={() => setFocusedField("userName")} onBlur={() => setFocusedField(null)}
                  placeholder="Aarushi Tyagi" maxLength={100}
                  className={inputCls("userName")}
                />
              </div>
            </div>

            {/* Mobile */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Mobile Number</label>
              <div className="relative">
                <FiPhone size={14} className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${focusedField === "userMobile" ? "text-[#C62828]" : "text-gray-400"}`} />
                <input
                  id="issue_userMobile" type="tel"
                  value={form.userMobile} onChange={set("userMobile")}
                  onFocus={() => setFocusedField("userMobile")} onBlur={() => setFocusedField(null)}
                  placeholder="+91 98765 43210" maxLength={15}
                  className={inputCls("userMobile")}
                />
              </div>
            </div>

            {/* Hostel + Room */}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
              {/* Hostel Dropdown */}
              <div ref={hostelDropRef}>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Select Hostel</label>
                <div className="relative">
                  <button
                    id="issue_hostelDropdown" type="button"
                    onClick={() => setHostelOpen((v) => !v)}
                    className={`w-full pl-10 pr-10 py-2.5 rounded-xl border text-sm text-left transition-all duration-200 flex items-center focus:outline-none ${
                      form.hostel
                        ? "border-[#C62828] text-gray-900 bg-white ring-2 ring-[#C62828]/20 shadow-sm"
                        : hostelOpen
                        ? "border-[#C62828] ring-2 ring-[#C62828]/20 bg-white text-gray-400"
                        : "border-gray-200 text-gray-400 bg-white hover:border-gray-300"
                    }`}
                  >
                    <FiHome size={14} className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${form.hostel || hostelOpen ? "text-[#C62828]" : "text-gray-400"}`} />
                    <span className={form.hostel ? "text-gray-900" : "text-gray-400"}>
                      {form.hostel || "Choose your hostel"}
                    </span>
                    <FiChevronDown size={14} className={`absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 transition-transform duration-300 ${hostelOpen ? "rotate-180" : ""}`} />
                  </button>
                  {hostelOpen && (
                    <div className="absolute z-30 mt-1.5 w-full bg-white border border-gray-100 rounded-2xl shadow-2xl overflow-hidden" style={{ animation: "dropdownIn 0.15s ease" }}>
                      <div className="max-h-48 overflow-y-auto py-1">
                        {hostels.map((h) => (
                          <button
                            key={h} type="button"
                            onClick={() => { setForm((f) => ({ ...f, hostel: h })); setHostelOpen(false); setError(""); }}
                            className={`w-full text-left px-4 py-2 text-sm transition-colors duration-150 flex items-center gap-2 ${
                              form.hostel === h ? "bg-red-50 text-[#C62828] font-semibold" : "text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            {form.hostel === h && <FiCheckCircle size={13} className="shrink-0" />}
                            {h}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Room Number */}
              <div className="sm:w-32">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Room No.</label>
                <div className="relative">
                  <FiHash size={14} className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${focusedField === "room" ? "text-[#C62828]" : "text-gray-400"}`} />
                  <input
                    id="issue_roomNumber" type="text"
                    value={form.room} onChange={set("room")}
                    onFocus={() => setFocusedField("room")} onBlur={() => setFocusedField(null)}
                    placeholder="C-505" maxLength={20}
                    className={inputCls("room")}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: ISSUE DETAILS & PHOTOS */}
          <div className="space-y-4 flex flex-col justify-between h-full">
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                <span className="w-5 h-5 rounded-full bg-red-100 text-[#C62828] text-[10px] font-bold flex items-center justify-center">2</span>
                <p className="text-[11px] font-bold text-gray-400 tracking-[0.12em] uppercase">Issue Details</p>
              </div>

              {/* Issue Category Dropdown */}
              <div ref={issueDropRef}>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Issue Category</label>
                <div className="relative">
                  <button
                    id="issue_categoryDropdown" type="button"
                    onClick={() => setIssueOpen((v) => !v)}
                    className={`w-full pl-10 pr-10 py-2.5 rounded-xl border text-sm text-left transition-all duration-200 flex items-center focus:outline-none ${
                      form.issue
                        ? "border-[#C62828] text-gray-900 bg-white ring-2 ring-[#C62828]/20 shadow-sm"
                        : issueOpen
                        ? "border-[#C62828] ring-2 ring-[#C62828]/20 bg-white text-gray-400"
                        : "border-gray-200 text-gray-400 bg-white hover:border-gray-300"
                    }`}
                  >
                    <FiAlertTriangle size={14} className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${form.issue || issueOpen ? "text-[#C62828]" : "text-gray-400"}`} />
                    <span className={form.issue ? "text-gray-900" : "text-gray-400"}>
                      {form.issue || "Select issue type"}
                    </span>
                    <FiChevronDown size={14} className={`absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 transition-transform duration-300 ${issueOpen ? "rotate-180" : ""}`} />
                  </button>
                  {issueOpen && (
                    <div className="absolute z-30 mt-1.5 w-full bg-white border border-gray-100 rounded-2xl shadow-2xl overflow-hidden" style={{ animation: "dropdownIn 0.15s ease" }}>
                      <div className="max-h-48 overflow-y-auto py-1">
                        {ISSUE_CATEGORIES.map((cat) => (
                          <button
                            key={cat} type="button"
                            onClick={() => { setForm((f) => ({ ...f, issue: cat })); setIssueOpen(false); setError(""); }}
                            className={`w-full text-left px-4 py-2 text-sm transition-colors duration-150 flex items-center gap-2 ${
                              form.issue === cat ? "bg-red-50 text-[#C62828] font-semibold" : "text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            {form.issue === cat && <FiCheckCircle size={13} className="shrink-0" />}
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Additional Details */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Additional Details <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <FiFileText size={14} className={`absolute left-3.5 top-3 transition-colors duration-200 ${focusedField === "issueDetails" ? "text-[#C62828]" : "text-gray-400"}`} />
                  <textarea
                    id="issue_details"
                    value={form.issueDetails} onChange={set("issueDetails")}
                    onFocus={() => setFocusedField("issueDetails")} onBlur={() => setFocusedField(null)}
                    placeholder="Describe your issue in detail…"
                    rows={2} maxLength={500}
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm text-gray-900 focus:outline-none transition-all duration-200 placeholder-gray-300 bg-white resize-none ${
                      focusedField === "issueDetails"
                        ? "border-[#C62828] ring-2 ring-[#C62828]/20 shadow-sm"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  />
                </div>
              </div>

              {/* ── PHOTO UPLOAD ── */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center justify-between">
                  <span>Attach Photos <span className="text-gray-400 font-normal">(optional)</span></span>
                  <span className="text-[10px] text-gray-400">{photos.length}/{MAX_PHOTOS}</span>
                </label>

              {/* Drop Zone */}
              {photos.length < MAX_PHOTOS && (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
                  className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 py-6 ${
                    dragOver
                      ? "border-[#C62828] bg-red-50 scale-[1.01]"
                      : "border-gray-200 bg-gray-50 hover:border-[#C62828]/50 hover:bg-red-50/40"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-200 ${dragOver ? "bg-red-100" : "bg-white shadow-sm border border-gray-100"}`}>
                    <FiUploadCloud size={20} className={dragOver ? "text-[#C62828]" : "text-gray-400"} />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-semibold text-gray-600">
                      {dragOver ? "Drop to upload" : "Click or drag & drop photos"}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      JPG, PNG, WEBP · {MAX_PHOTOS - photos.length} slot{MAX_PHOTOS - photos.length !== 1 ? "s" : ""} remaining
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => addFiles(e.target.files)}
                    id="issue_photoUpload"
                  />
                </div>
              )}

              {/* Thumbnail grid */}
              {photos.length > 0 && (
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {photos.map((photo) => (
                    <div key={photo.id} className="relative group rounded-xl overflow-hidden border border-gray-100 shadow-sm aspect-square bg-gray-50">
                      <img
                        src={photo.preview}
                        alt="preview"
                        className="w-full h-full object-cover"
                      />
                      {/* Progress overlay */}
                      {submitting && uploadProgress[photo.id] !== undefined && uploadProgress[photo.id] < 100 && (
                        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-1">
                          <p className="text-white text-[10px] font-bold">{uploadProgress[photo.id]}%</p>
                          <div className="w-10 h-1 bg-white/30 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-white rounded-full transition-all duration-300"
                              style={{ width: `${uploadProgress[photo.id]}%` }}
                            />
                          </div>
                        </div>
                      )}
                      {/* Done overlay */}
                      {submitting && uploadProgress[photo.id] === 100 && (
                        <div className="absolute inset-0 bg-green-500/60 flex items-center justify-center">
                          <FiCheckCircle size={18} className="text-white" />
                        </div>
                      )}
                      {/* Remove button */}
                      {!submitting && (
                        <button
                          type="button"
                          onClick={() => removePhoto(photo.id)}
                          className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow"
                        >
                          <FiX size={10} className="text-white" />
                        </button>
                      )}
                    </div>
                  ))}
                  {/* Add more slot */}
                  {photos.length < MAX_PHOTOS && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square rounded-xl border-2 border-dashed border-gray-200 hover:border-[#C62828]/50 hover:bg-red-50/40 flex flex-col items-center justify-center gap-1 transition-all duration-200 text-gray-400 hover:text-[#C62828]"
                    >
                      <FiImage size={16} />
                      <span className="text-[9px] font-semibold">Add</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mb-3 flex items-start gap-2.5 bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl px-4 py-2.5">
            <FiAlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Submit */}
        <div className="pt-2">
          <button
            id="submitIssue" type="submit"
            disabled={submitting || cooldown > 0}
            className="w-full py-3 text-white font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2.5 text-sm disabled:opacity-60 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0"
            style={{
              background: submitting || cooldown > 0
                ? "#e08080"
                : "linear-gradient(135deg,#C62828 0%,#B71C1C 100%)",
              boxShadow: submitting || cooldown > 0 ? "none" : "0 8px 24px rgba(198,40,40,0.30)",
            }}
          >
            {submitting ? (
              <><FiLoader size={18} className="animate-spin" /> Submitting…</>
            ) : cooldown > 0 ? (
              <><FiClock size={16} /> Please wait {cooldown}s…</>
            ) : (
              <><FiSend size={15} /> Submit Issue Report</>
            )}
          </button>
        </div>
      </div>
    </form>
  </div>
);
}

/* ─────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */
export default function HostelOrderForm() {
  /* ── Tab state ── */
  const [activeTab, setActiveTab] = useState("pickup"); // "pickup" | "issue"

  /* ── Remote config from b2b_partner ── */
  const [hostels, setHostels] = useState([]);
  const [pickupDaysMap, setPickupDaysMap] = useState({});
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState(false);

  /* ── Form state (pickup) ── */
  const [form, setForm] = useState({
    userName: "", userEmail: "", userMobile: "", hostel: "", room: "", clothes: "",
  });
  const [nextPickup, setNextPickup] = useState(null);

  /* ── UI state (pickup) ── */
  const [hostelOpen, setHostelOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [focusedField, setFocusedField] = useState(null);

  const dropdownRef = useRef(null);
  const cooldownRef = useRef(null);

  /* ── Fetch hostel config from b2b_partner ── */
  useEffect(() => {
    async function fetchConfig() {
      try {
        setConfigLoading(true);
        const snap = await getDocs(collection(db, "b2b_partner"));
        let foundHostels = [];
        let foundPickupDays = {};
        snap.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.pickupDays && typeof data.pickupDays === "object") foundPickupDays = data.pickupDays;
          if (Array.isArray(data.hostels) && data.hostels.length > 0) foundHostels = data.hostels;
        });
        if (foundHostels.length === 0) throw new Error("No hostels found");
        setHostels(foundHostels);
        setPickupDaysMap(foundPickupDays);
      } catch (err) {
        console.error("Failed to load hostel config:", err);
        setConfigError(true);
      } finally {
        setConfigLoading(false);
      }
    }
    fetchConfig();
  }, []);

  /* ── Close dropdown on outside click ── */
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setHostelOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ── Recompute next pickup when hostel changes ── */
  useEffect(() => {
    if (!form.hostel || !pickupDaysMap[form.hostel]) { setNextPickup(null); return; }
    const days = pickupDaysMap[form.hostel];
    const date = getNextPickupDate(days);
    setNextPickup({ date, days });
  }, [form.hostel, pickupDaysMap]);

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setError("");
  };

  /* ── Progress (pickup) ── */
  const filledCount = [
    form.userName.trim(), form.userEmail.trim(), form.userMobile.trim(),
    form.hostel, form.room.trim(), form.clothes,
  ].filter(Boolean).length;
  const progress = Math.round((filledCount / 6) * 100);

  /* ── Validation (pickup) ── */
  const validate = () => {
    if (!form.userName.trim()) return "Please enter your full name.";
    if (!form.userEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.userEmail))
      return "Please enter a valid email address.";
    const digitsOnly = (form.userMobile.match(/\d/g) || []).length;
    if (!form.userMobile.trim() || !/^\+?[\d\s\-]{7,15}$/.test(form.userMobile) || digitsOnly < 7)
      return "Please enter a valid mobile number (min 7 digits).";
    if (!form.hostel) return "Please select your hostel.";
    if (!form.room.trim()) return "Please enter your room number.";
    const clothesNum = parseInt(form.clothes, 10);
    if (!form.clothes || isNaN(clothesNum) || clothesNum < 1 || clothesNum > 200)
      return "Please enter a valid number of clothes (1–200).";
    if (!nextPickup?.date) return "Could not determine pickup date for selected hostel.";
    return null;
  };

  /* ── Submit (pickup) ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (cooldown > 0) { setError(`Please wait ${cooldown}s before submitting again.`); return; }
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    setSubmitting(true);
    setError("");
    try {
      const pickupDate = new Date(nextPickup.date);
      pickupDate.setHours(0, 0, 0, 0);
      const mobile = form.userMobile.trim().startsWith("+")
        ? form.userMobile.trim()
        : `+91${form.userMobile.trim().replace(/\D/g, "")}`;
      await addDoc(collection(db, "hostels_orders"), {
        userName: form.userName.trim(),
        userEmail: form.userEmail.trim().toLowerCase(),
        userMobile: mobile,
        hostel: form.hostel,
        room: form.room.trim().toUpperCase(),
        clothes: String(parseInt(form.clothes, 10)),
        scheduledPickupDate: Timestamp.fromDate(pickupDate),
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        userId: "",
      });
      setSubmitted(true);
      setCooldown(30);
      cooldownRef.current = setInterval(() => {
        setCooldown((c) => {
          if (c <= 1) { clearInterval(cooldownRef.current); return 0; }
          return c - 1;
        });
      }, 1000);
    } catch (err) {
      console.error("Order submission error:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSubmitted(false);
    setForm({ userName: "", userEmail: "", userMobile: "", hostel: "", room: "", clothes: "" });
    setNextPickup(null);
  };

  const inputCls = (field) =>
    `w-full pl-10 pr-4 py-3 rounded-xl border text-sm text-gray-900 focus:outline-none transition-all duration-200 placeholder-gray-300 bg-white ${
      focusedField === field
        ? "border-[#1976D2] ring-2 ring-[#1976D2]/20 shadow-sm"
        : "border-gray-200 hover:border-gray-300"
    }`;

  /* ════════════════════════════════════════
     SUCCESS SCREEN (PICKUP)
  ════════════════════════════════════════ */
  if (submitted) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0D47A1] via-[#1565C0] to-[#1976D2] px-4 relative overflow-hidden"
        style={{ fontFamily: "Poppins, sans-serif" }}
      >
        <Bubble style={{ width: 320, height: 320, top: "-80px", left: "-80px" }} />
        <Bubble style={{ width: 200, height: 200, bottom: "-60px", right: "-40px", animationDelay: "2s" }} />

        <div className="relative z-10 w-full max-w-lg">
          <div className="bg-white rounded-3xl shadow-2xl p-10 text-center" style={{ animation: "slideUp 0.5s ease" }}>
            <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-200">
              <FiCheckCircle size={44} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Request Submitted! 🎉</h2>
            <p className="text-gray-500 text-sm mb-6">Our team will collect your laundry on the scheduled date.</p>

            <div className="grid grid-cols-2 gap-3 text-left mb-4">
              {[
                { label: "Name", value: form.userName },
                { label: "Room", value: form.room.toUpperCase() },
                { label: "Clothes", value: `${form.clothes} items` },
                { label: "Pickup Day", value: nextPickup?.date ? DAY_FULL[nextPickup.date.getDay()] : "—" },
              ].map(({ label, value }) => (
                <div key={label} className="bg-[#F0F7FF] rounded-2xl p-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">{label}</p>
                  <p className="text-sm font-semibold text-gray-800 truncate">{value}</p>
                </div>
              ))}
            </div>

            <div className="bg-gradient-to-r from-[#EBF4FF] to-[#DBEAFE] rounded-2xl p-4 mb-6 flex items-center gap-3">
              <div className="w-10 h-10 bg-[#1976D2] rounded-xl flex items-center justify-center shrink-0">
                <FiCalendar size={18} className="text-white" />
              </div>
              <div className="text-left">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Scheduled Pickup</p>
                <p className="text-sm font-bold text-[#1976D2]">{formatDateDisplay(nextPickup?.date)}</p>
              </div>
            </div>

            <button
              onClick={handleReset}
              className="w-full py-3.5 bg-gradient-to-r from-[#1976D2] to-[#1565C0] hover:from-[#1565C0] hover:to-[#0D47A1] text-white font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-[#1976D2]/30 hover:-translate-y-0.5"
            >
              <FiArrowLeft size={16} /> Place Another Request
            </button>
          </div>
        </div>

        <style>{`
          @keyframes slideUp { from { opacity:0;transform:translateY(30px); } to { opacity:1;transform:translateY(0); } }
          @keyframes floatBubble { 0%,100%{transform:translateY(0) scale(1);} 50%{transform:translateY(-20px) scale(1.05);} }
        `}</style>
      </div>
    );
  }

  /* ════════════════════════════════════════
     MAIN FORM — TWO COLUMN LAYOUT
  ════════════════════════════════════════ */
  return (
    <div className="min-h-screen flex" style={{ fontFamily: "Poppins, sans-serif" }}>

      {/* ── LEFT PANEL ── */}
      <div className="hidden lg:flex w-[32%] xl:w-[30%] bg-gradient-to-br from-[#0D47A1] via-[#1565C0] to-[#1976D2] flex-col justify-between p-8 xl:p-10 relative overflow-hidden">
        <Bubble style={{ width: 380, height: 380, top: "-100px", left: "-100px" }} />
        <Bubble style={{ width: 240, height: 240, bottom: "-60px", right: "-60px", animationDelay: "3s" }} />
        <Bubble style={{ width: 120, height: 120, top: "55%", left: "8%", animationDelay: "1.5s" }} />
        <Bubble style={{ width: 80, height: 80, top: "30%", right: "10%", animationDelay: "5s" }} />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-xl">
              <BrandLogo className="w-7 h-7 text-[#1976D2]" />
            </div>
            <div>
              <p className="text-white font-bold text-lg leading-none">Andes Laundry</p>
              <p className="text-white/60 text-xs mt-0.5">MITWPU · Hostel Partner</p>
            </div>
          </div>

          <h1 className="text-3xl xl:text-4xl font-bold text-white leading-tight mb-3">
            Fresh Clothes,<br />
            <span className="text-white/70">Zero Effort.</span>
          </h1>
          <p className="text-white/65 text-xs xl:text-sm leading-relaxed max-w-xs mb-8">
            Submit your laundry pickup request in under a minute. We'll handle the rest — right from your hostel room.
          </p>

          <div className="space-y-3">
            {[
              { step: "01", title: "Fill the Form", desc: "Enter your details & clothes count" },
              { step: "02", title: "Auto-Scheduled", desc: "We assign the next fixed pickup slot" },
              { step: "03", title: "We Collect & Deliver", desc: "Fresh & clean back to your room" },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center shrink-0 text-white font-bold text-xs border border-white/20">
                  {step}
                </div>
                <div>
                  <p className="text-white font-semibold text-xs xl:text-sm">{title}</p>
                  <p className="text-white/55 text-[11px]">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 grid grid-cols-3 gap-2 mt-6">
          {STATS.map(({ icon, value, label }) => (
            <div key={label} className="bg-white/10 border border-white/20 rounded-xl p-3 text-center hover:bg-white/15 transition-colors duration-200">
              <div className="flex justify-center text-white/70 mb-1">{icon}</div>
              <p className="text-white font-bold text-base leading-none">{value}</p>
              <p className="text-white/55 text-[9px] mt-1">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="flex-1 flex flex-col min-h-screen bg-[radial-gradient(circle_at_top_right,_#DBEAFE_0%,_#F8FAFF_60%)] overflow-y-auto">

        {/* Mobile Header */}
        <div className="lg:hidden flex items-center gap-3 px-6 pt-6 pb-2">
          <div className="w-9 h-9 rounded-xl bg-[#1976D2] flex items-center justify-center">
            <BrandLogo className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="font-bold text-[#1976D2] text-base leading-none">Andes Laundry</p>
            <p className="text-gray-400 text-[10px]">MITWPU · Hostel Service</p>
          </div>
          <span className="ml-auto text-[10px] bg-green-100 text-green-700 font-semibold px-2.5 py-1 rounded-full border border-green-200 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" /> Live
          </span>
        </div>

        <div className="flex-1 flex items-center justify-center px-4 py-6 xl:px-8">
          <div className="w-full max-w-full lg:max-w-4xl xl:max-w-5xl">

            {/* ── TAB SWITCHER ── */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-2xl p-1 mb-5 relative max-w-md mx-auto">
              {/* Sliding indicator */}
              <div
                className="absolute top-1 bottom-1 rounded-xl transition-all duration-300 ease-in-out"
                style={{
                  width: "calc(50% - 4px)",
                  left: activeTab === "pickup" ? "4px" : "calc(50%)",
                  background: activeTab === "pickup"
                    ? "linear-gradient(135deg,#1976D2,#1565C0)"
                    : "linear-gradient(135deg,#C62828,#B71C1C)",
                  boxShadow: activeTab === "pickup"
                    ? "0 4px 12px rgba(25,118,210,0.25)"
                    : "0 4px 12px rgba(198,40,40,0.25)",
                }}
              />
              <button
                id="tab_pickup"
                onClick={() => setActiveTab("pickup")}
                className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors duration-300 ${
                  activeTab === "pickup" ? "text-white" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <FiShoppingBag size={15} /> Pickup Request
              </button>
              <button
                id="tab_issue"
                onClick={() => setActiveTab("issue")}
                className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors duration-300 ${
                  activeTab === "issue" ? "text-white" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <FiMessageSquare size={15} /> Raise Issue
              </button>
            </div>

            {/* ══ PICKUP TAB ══ */}
            {activeTab === "pickup" && (
              <>
                {/* Header row */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Pickup Request</h2>
                    <p className="text-gray-400 text-xs mt-0.5">Fill in your details to schedule a pickup</p>
                  </div>
                  <span className="hidden lg:flex items-center gap-1.5 text-[11px] bg-green-50 text-green-700 font-semibold px-3 py-1 rounded-full border border-green-200">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
                    Accepting Orders
                  </span>
                </div>

                {/* Progress bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-400 font-medium">Form completion</span>
                    <span className={`font-bold transition-colors duration-300 ${progress === 100 ? "text-green-500" : "text-[#1976D2]"}`}>
                      {progress}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500 ease-out"
                      style={{
                        width: `${progress}%`,
                        background: progress === 100
                          ? "linear-gradient(90deg,#22c55e,#16a34a)"
                          : "linear-gradient(90deg,#1976D2,#42A5F5)",
                      }}
                    />
                  </div>
                </div>

                {/* ── Loading / Error state ── */}
                {configLoading ? (
                  <div className="bg-white rounded-3xl border border-gray-100 shadow-xl p-12 flex flex-col items-center justify-center gap-3">
                    <FiLoader size={28} className="text-[#1976D2] animate-spin" />
                    <p className="text-sm text-gray-400 font-medium">Loading hostel configuration…</p>
                  </div>
                ) : configError ? (
                  <div className="bg-white rounded-3xl border border-red-100 shadow-xl p-10 flex flex-col items-center gap-4 text-center">
                    <FiAlertCircle size={36} className="text-red-400" />
                    <div>
                      <p className="font-bold text-gray-800 mb-1">Failed to load configuration</p>
                      <p className="text-xs text-gray-400">Could not fetch hostel list. Please check your connection.</p>
                    </div>
                    <button onClick={() => window.location.reload()} className="flex items-center gap-2 text-sm text-[#1976D2] font-semibold hover:underline">
                      <FiRefreshCw size={14} /> Retry
                    </button>
                  </div>
                ) : (
                  /* ── FORM CARD ── */
                  <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-visible p-6">
                    <form onSubmit={handleSubmit} noValidate>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

                        {/* LEFT COLUMN: YOUR DETAILS */}
                        <div className="space-y-3.5">
                          <div className="flex items-center gap-2 pb-1.5 border-b border-gray-100">
                            <span className="w-5 h-5 rounded-full bg-blue-100 text-[#1976D2] text-[10px] font-bold flex items-center justify-center">1</span>
                            <p className="text-[11px] font-bold text-gray-400 tracking-[0.12em] uppercase">Your Details</p>
                          </div>

                          {/* Full Name */}
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Full Name</label>
                            <div className="relative">
                              <FiUser size={14} className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${focusedField === "userName" ? "text-[#1976D2]" : "text-gray-400"}`} />
                              <input
                                id="userName" type="text"
                                value={form.userName} onChange={set("userName")}
                                onFocus={() => setFocusedField("userName")} onBlur={() => setFocusedField(null)}
                                placeholder="Aarushi Tyagi" maxLength={100}
                                className={inputCls("userName")}
                              />
                            </div>
                          </div>

                          {/* Email + Mobile */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Email Address</label>
                              <div className="relative">
                                <FiMail size={14} className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${focusedField === "userEmail" ? "text-[#1976D2]" : "text-gray-400"}`} />
                                <input
                                  id="userEmail" type="email"
                                  value={form.userEmail} onChange={set("userEmail")}
                                  onFocus={() => setFocusedField("userEmail")} onBlur={() => setFocusedField(null)}
                                  placeholder="name@mitwpu.edu.in"
                                  className={inputCls("userEmail")}
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Mobile Number</label>
                              <div className="relative">
                                <FiPhone size={14} className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${focusedField === "userMobile" ? "text-[#1976D2]" : "text-gray-400"}`} />
                                <input
                                  id="userMobile" type="tel"
                                  value={form.userMobile} onChange={set("userMobile")}
                                  onFocus={() => setFocusedField("userMobile")} onBlur={() => setFocusedField(null)}
                                  placeholder="+91 98765 43210" maxLength={15}
                                  className={inputCls("userMobile")}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Hostel + Room */}
                          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
                            <div ref={dropdownRef}>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Select Hostel</label>
                              <div className="relative">
                                <button
                                  id="hostelDropdown" type="button"
                                  onClick={() => setHostelOpen((v) => !v)}
                                  className={`w-full pl-10 pr-10 py-2.5 rounded-xl border text-sm text-left transition-all duration-200 flex items-center focus:outline-none ${
                                    form.hostel
                                      ? "border-[#1976D2] text-gray-900 bg-white ring-2 ring-[#1976D2]/20 shadow-sm"
                                      : hostelOpen
                                      ? "border-[#1976D2] ring-2 ring-[#1976D2]/20 bg-white text-gray-400"
                                      : "border-gray-200 text-gray-400 bg-white hover:border-gray-300"
                                  }`}
                                >
                                  <FiHome size={14} className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${form.hostel || hostelOpen ? "text-[#1976D2]" : "text-gray-400"}`} />
                                  <span className={form.hostel ? "text-gray-900" : "text-gray-400"}>
                                    {form.hostel || "Choose your hostel"}
                                  </span>
                                  <FiChevronDown size={14} className={`absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 transition-transform duration-300 ${hostelOpen ? "rotate-180" : ""}`} />
                                </button>
                                {hostelOpen && (
                                  <div className="absolute z-30 mt-1.5 w-full bg-white border border-gray-100 rounded-2xl shadow-2xl overflow-hidden" style={{ animation: "dropdownIn 0.15s ease" }}>
                                    <div className="max-h-48 overflow-y-auto py-1">
                                      {hostels.map((h) => (
                                        <button
                                          key={h} type="button"
                                          onClick={() => { setForm((f) => ({ ...f, hostel: h })); setHostelOpen(false); setError(""); }}
                                          className={`w-full text-left px-4 py-2 text-sm transition-colors duration-150 flex items-center gap-2 ${
                                            form.hostel === h ? "bg-[#EBF4FF] text-[#1976D2] font-semibold" : "text-gray-700 hover:bg-gray-50"
                                          }`}
                                        >
                                          {form.hostel === h && <FiCheckCircle size={13} className="shrink-0" />}
                                          {h}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="sm:w-32">
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Room No.</label>
                              <div className="relative">
                                <FiHash size={14} className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${focusedField === "room" ? "text-[#1976D2]" : "text-gray-400"}`} />
                                <input
                                  id="roomNumber" type="text"
                                  value={form.room} onChange={set("room")}
                                  onFocus={() => setFocusedField("room")} onBlur={() => setFocusedField(null)}
                                  placeholder="C-505" maxLength={20}
                                  className={inputCls("room")}
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* RIGHT COLUMN: PICKUP REQUEST & SCHEDULE */}
                        <div className="space-y-3.5 flex flex-col justify-between h-full">
                          <div className="space-y-3.5">
                            <div className="flex items-center gap-2 pb-1.5 border-b border-gray-100">
                              <span className="w-5 h-5 rounded-full bg-blue-100 text-[#1976D2] text-[10px] font-bold flex items-center justify-center">2</span>
                              <p className="text-[11px] font-bold text-gray-400 tracking-[0.12em] uppercase">Pickup Request</p>
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Number of Clothes</label>
                              <div className="relative">
                                <FiShoppingBag size={14} className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${focusedField === "clothes" ? "text-[#1976D2]" : "text-gray-400"}`} />
                                <input
                                  id="clothesCount" type="number"
                                  min="1" max="200"
                                  value={form.clothes} onChange={set("clothes")}
                                  onFocus={() => setFocusedField("clothes")} onBlur={() => setFocusedField(null)}
                                  placeholder="e.g. 10"
                                  className={inputCls("clothes")}
                                />
                              </div>
                              <p className="text-[10px] text-[#1976D2] font-semibold mt-1 pl-0.5">
                                ℹ Free limit: 10.00 kg per pickup
                              </p>
                            </div>

                            {/* Pickup schedule info card */}
                            {form.hostel && (
                              <div className="rounded-2xl border overflow-hidden transition-all duration-300" style={{ animation: "slideUp 0.25s ease" }}>
                                {nextPickup ? (
                                  <div className="bg-gradient-to-r from-[#EBF4FF] to-[#DBEAFE] p-3.5 flex items-center gap-3">
                                    <div className="w-10 h-10 bg-[#1976D2] rounded-xl flex items-center justify-center shrink-0 shadow-md shadow-[#1976D2]/30">
                                      <FiCalendar size={18} className="text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Next Scheduled Pickup</p>
                                      <p className="text-xs font-bold text-[#1976D2] truncate">{formatDateDisplay(nextPickup.date)}</p>
                                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                                        <span className="text-[9px] text-gray-400 font-medium">Slots:</span>
                                        {nextPickup.days.map((d) => (
                                          <span key={d} className="text-[9px] font-bold text-[#1976D2] bg-white px-1.5 py-0.5 rounded-full border border-[#1976D2]/20 capitalize">{d}</span>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="bg-amber-50 border-amber-200 p-2.5 flex items-center gap-2 text-amber-700">
                                    <FiAlertCircle size={14} className="shrink-0" />
                                    <span className="text-xs font-medium">No pickup schedule found for this hostel.</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Error */}
                          {error && (
                            <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl px-3.5 py-2.5">
                              <FiAlertCircle size={14} className="shrink-0 mt-0.5" />
                              <span>{error}</span>
                            </div>
                          )}

                          {/* Submit */}
                          <div className="pt-2">
                            <button
                              id="submitPickupRequest" type="submit"
                              disabled={submitting || cooldown > 0}
                              className="w-full py-3 text-white font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0"
                              style={{
                                background: submitting || cooldown > 0
                                  ? "#93bde8"
                                  : "linear-gradient(135deg,#1976D2 0%,#1565C0 100%)",
                                boxShadow: submitting || cooldown > 0 ? "none" : "0 8px 24px rgba(25,118,210,0.35)",
                              }}
                            >
                              {submitting ? (
                                <><FiLoader size={18} className="animate-spin" /> Submitting…</>
                              ) : cooldown > 0 ? (
                                <><FiClock size={16} /> Please wait {cooldown}s…</>
                              ) : (
                                <><FiSend size={15} /> Submit Pickup Request</>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </form>
                  </div>
                )}
              </>
            )}

            {/* ══ ISSUE TAB ══ */}
            {activeTab === "issue" && (
              <>
                {/* Header row */}
                <div className="flex items-center justify-between mb-7">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Raise an Issue</h2>
                    <p className="text-gray-400 text-sm mt-0.5">Report a problem with your laundry service</p>
                  </div>
                  <span className="hidden lg:flex items-center gap-1.5 text-[11px] bg-red-50 text-red-600 font-semibold px-3 py-1.5 rounded-full border border-red-200">
                    <FiAlertTriangle size={11} />
                    Complaint Portal
                  </span>
                </div>

                {/* Info banner */}
                <div className="mb-6 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3.5">
                  <FiAlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 font-medium leading-relaxed">
                    Issues are reviewed within <span className="font-bold">24 hours</span>. Our team will contact you for resolution. Please provide as much detail as possible.
                  </p>
                </div>

                <RaiseIssueForm
                  hostels={hostels}
                  configLoading={configLoading}
                  configError={configError}
                />
              </>
            )}

            <p className="text-center text-xs text-gray-400 mt-5">
              Secured by <span className="font-semibold text-[#1976D2]">Andes Laundry</span> · MITWPU Partner Service
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
        @keyframes floatBubble { 0%,100%{transform:translateY(0) scale(1);} 50%{transform:translateY(-22px) scale(1.04);} }
        @keyframes dropdownIn { from{opacity:0;transform:translateY(-6px);} to{opacity:1;transform:translateY(0);} }
        @keyframes slideUp { from{opacity:0;transform:translateY(14px);} to{opacity:1;transform:translateY(0);} }
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button { -webkit-appearance:none; }
      `}</style>
    </div>
  );
}
