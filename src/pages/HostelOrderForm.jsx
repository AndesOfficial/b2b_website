import { useState, useEffect, useRef } from "react";
import { collection, addDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "../firebase";
import BrandLogo from "../components/Shared/BrandLogo";
import {
  FiUser, FiHome, FiHash, FiSend, FiCheckCircle,
  FiPhone, FiMail, FiAlertCircle, FiLoader, FiChevronDown,
  FiCalendar, FiShoppingBag, FiArrowLeft, FiClock, FiStar, FiZap
} from "react-icons/fi";

const HOSTELS = [
  "Meera Hostel Karve Nagar",
  "Keerti Hostel Karve Nagar",
  "Samshursti Hostel Karve Nagar",
  "Tara Hostel Kothurd",
  "Aakansha Hostel Kothurd",
  "Gurukul Hostel Bhavdan",
  "Aaradhana Hostel Bhavdan",
  "Samriddhi Hostel Bhavdan",
  "Tulsi Hostel Bhavdan",
  "Adarsha Hostel Bhavdan",
  "Curie Hostel SB Road",
  "Plato Hostel Viman Nagar",
];

const STATS = [
  { icon: <FiStar size={18} />, value: "500+", label: "Happy Students" },
  { icon: <FiZap size={18} />, value: "24h", label: "Turnaround" },
  { icon: <FiClock size={18} />, value: "12", label: "Hostels Served" },
];

function getTomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateForInput(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Animated floating bubble component
function Bubble({ style }) {
  return (
    <div
      className="absolute rounded-full pointer-events-none"
      style={{
        background: "rgba(255,255,255,0.08)",
        animation: "floatBubble 8s ease-in-out infinite",
        ...style,
      }}
    />
  );
}

export default function HostelOrderForm() {
  const [form, setForm] = useState({
    userName: "",
    userEmail: "",
    userMobile: "",
    hostel: "",
    room: "",
    clothes: "",
    scheduledPickupDate: formatDateForInput(getTomorrow()),
  });

  const [hostelOpen, setHostelOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [focusedField, setFocusedField] = useState(null);
  const dropdownRef = useRef(null);
  const cooldownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setHostelOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setError("");
  };

  // Progress: count filled fields out of 7
  const filledCount = [
    form.userName.trim(),
    form.userEmail.trim(),
    form.userMobile.trim(),
    form.hostel,
    form.room.trim(),
    form.clothes,
    form.scheduledPickupDate,
  ].filter(Boolean).length;
  const progress = Math.round((filledCount / 7) * 100);

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
    if (!form.scheduledPickupDate) return "Please select a pickup date.";
    const pickup = new Date(form.scheduledPickupDate);
    if (pickup < getTomorrow()) return "Pickup date must be at least tomorrow.";
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (cooldown > 0) { setError(`Please wait ${cooldown}s before submitting again.`); return; }
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setSubmitting(true);
    setError("");

    try {
      const pickupDate = new Date(form.scheduledPickupDate);
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
    setForm({
      userName: "",
      userEmail: "",
      userMobile: "",
      hostel: "",
      room: "",
      clothes: "",
      scheduledPickupDate: formatDateForInput(getTomorrow()),
    });
  };

  /* ── Shared input class ── */
  const inputCls = (field) =>
    `w-full pl-10 pr-4 py-3 rounded-xl border text-sm text-gray-900 focus:outline-none transition-all duration-200 placeholder-gray-300 bg-white ${
      focusedField === field
        ? "border-[#1976D2] ring-2 ring-[#1976D2]/20 shadow-sm"
        : "border-gray-200 hover:border-gray-300"
    }`;

  /* ════════════════════════════════════════
     SUCCESS SCREEN
  ════════════════════════════════════════ */
  if (submitted) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0D47A1] via-[#1565C0] to-[#1976D2] px-4 relative overflow-hidden"
        style={{ fontFamily: "Poppins, sans-serif" }}
      >
        {/* Background bubbles */}
        <Bubble style={{ width: 320, height: 320, top: "-80px", left: "-80px" }} />
        <Bubble style={{ width: 200, height: 200, bottom: "-60px", right: "-40px", animationDelay: "2s" }} />
        <Bubble style={{ width: 140, height: 140, top: "40%", left: "5%", animationDelay: "4s" }} />

        <div className="relative z-10 w-full max-w-lg">
          {/* Card */}
          <div className="bg-white rounded-3xl shadow-2xl p-10 text-center" style={{ animation: "slideUp 0.5s ease" }}>
            <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-200">
              <FiCheckCircle size={44} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Request Submitted! 🎉</h2>
            <p className="text-gray-500 text-sm mb-6">
              Our team will collect your laundry on the scheduled date.
            </p>

            {/* Summary grid */}
            <div className="grid grid-cols-2 gap-3 text-left mb-8">
              {[
                { label: "Name", value: form.userName },
                { label: "Room", value: form.room.toUpperCase() },
                { label: "Clothes", value: `${form.clothes} items` },
                {
                  label: "Pickup",
                  value: new Date(form.scheduledPickupDate).toLocaleDateString("en-IN", {
                    day: "numeric", month: "short", year: "numeric",
                  }),
                },
              ].map(({ label, value }) => (
                <div key={label} className="bg-[#F0F7FF] rounded-2xl p-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">{label}</p>
                  <p className="text-sm font-semibold text-gray-800 truncate">{value}</p>
                </div>
              ))}
              <div className="col-span-2 bg-[#F0F7FF] rounded-2xl p-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Hostel</p>
                <p className="text-sm font-semibold text-gray-800">{form.hostel}</p>
              </div>
            </div>

            <button
              onClick={handleReset}
              className="w-full py-3.5 bg-gradient-to-r from-[#1976D2] to-[#1565C0] hover:from-[#1565C0] hover:to-[#0D47A1] text-white font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-[#1976D2]/30 hover:-translate-y-0.5"
            >
              <FiArrowLeft size={16} />
              Place Another Request
            </button>
          </div>
        </div>

        <style>{`
          @keyframes slideUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes floatBubble { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-20px) scale(1.05); } }
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
      <div className="hidden lg:flex w-[42%] bg-gradient-to-br from-[#0D47A1] via-[#1565C0] to-[#1976D2] flex-col justify-between p-12 relative overflow-hidden">

        {/* Decorative bubbles */}
        <Bubble style={{ width: 380, height: 380, top: "-100px", left: "-100px" }} />
        <Bubble style={{ width: 240, height: 240, bottom: "-60px", right: "-60px", animationDelay: "3s" }} />
        <Bubble style={{ width: 120, height: 120, top: "55%", left: "8%", animationDelay: "1.5s" }} />
        <Bubble style={{ width: 80, height: 80, top: "30%", right: "10%", animationDelay: "5s" }} />

        {/* Top: Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-xl">
              <BrandLogo className="w-8 h-8 text-[#1976D2]" />
            </div>
            <div>
              <p className="text-white font-bold text-xl leading-none">Andes Laundry</p>
              <p className="text-white/60 text-xs mt-0.5">MITWPU · Hostel Partner</p>
            </div>
          </div>

          {/* Headline */}
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Fresh Clothes,<br />
            <span className="text-white/70">Zero Effort.</span>
          </h1>
          <p className="text-white/65 text-sm leading-relaxed max-w-xs">
            Submit your laundry pickup request in under a minute. We'll handle the rest — right from your hostel room.
          </p>

          {/* Steps */}
          <div className="mt-10 space-y-4">
            {[
              { step: "01", title: "Fill the Form", desc: "Enter your details & clothes count" },
              { step: "02", title: "Schedule Pickup", desc: "Choose your preferred date" },
              { step: "03", title: "We Collect & Deliver", desc: "Fresh & clean back to your room" },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0 text-white font-bold text-xs border border-white/20">
                  {step}
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{title}</p>
                  <p className="text-white/55 text-xs">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom: Stats */}
        <div className="relative z-10">
          <div className="grid grid-cols-3 gap-3">
            {STATS.map(({ icon, value, label }) => (
              <div key={label} className="bg-white/10 border border-white/20 rounded-2xl p-4 text-center hover:bg-white/15 transition-colors duration-200">
                <div className="flex justify-center text-white/70 mb-1.5">{icon}</div>
                <p className="text-white font-bold text-lg leading-none">{value}</p>
                <p className="text-white/55 text-[10px] mt-1">{label}</p>
              </div>
            ))}
          </div>
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
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
            Live
          </span>
        </div>

        {/* Form area */}
        <div className="flex-1 flex items-center justify-center px-6 py-8">
          <div className="w-full max-w-lg">

            {/* Header row */}
            <div className="flex items-center justify-between mb-7">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Pickup Request</h2>
                <p className="text-gray-400 text-sm mt-0.5">Fill in your details to schedule a pickup</p>
              </div>
              <span className="hidden lg:flex items-center gap-1.5 text-[11px] bg-green-50 text-green-700 font-semibold px-3 py-1.5 rounded-full border border-green-200">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
                Accepting Orders
              </span>
            </div>

            {/* Progress bar */}
            <div className="mb-6">
              <div className="flex items-center justify-between text-xs mb-1.5">
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

            {/* Card */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-visible">
              <form onSubmit={handleSubmit} noValidate>

                {/* ── YOUR DETAILS ── */}
                <div className="px-7 pt-7 pb-5">
                  <p className="text-[10px] font-bold text-gray-400 tracking-[0.15em] uppercase mb-5">Your Details</p>

                  <div className="grid grid-cols-1 gap-4">

                    {/* Full Name */}
                    <div className="group">
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5 pl-0.5">Full Name</label>
                      <div className="relative">
                        <FiUser size={14} className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${focusedField === "userName" ? "text-[#1976D2]" : "text-gray-400"}`} />
                        <input
                          id="userName" type="text"
                          value={form.userName}
                          onChange={set("userName")}
                          onFocus={() => setFocusedField("userName")}
                          onBlur={() => setFocusedField(null)}
                          placeholder="Aarushi Tyagi"
                          maxLength={100}
                          className={inputCls("userName")}
                        />
                      </div>
                    </div>

                    {/* Email + Mobile side by side on wider screens */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5 pl-0.5">Email Address</label>
                        <div className="relative">
                          <FiMail size={14} className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${focusedField === "userEmail" ? "text-[#1976D2]" : "text-gray-400"}`} />
                          <input
                            id="userEmail" type="email"
                            value={form.userEmail}
                            onChange={set("userEmail")}
                            onFocus={() => setFocusedField("userEmail")}
                            onBlur={() => setFocusedField(null)}
                            placeholder="name@mitwpu.edu.in"
                            className={inputCls("userEmail")}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5 pl-0.5">Mobile Number</label>
                        <div className="relative">
                          <FiPhone size={14} className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${focusedField === "userMobile" ? "text-[#1976D2]" : "text-gray-400"}`} />
                          <input
                            id="userMobile" type="tel"
                            value={form.userMobile}
                            onChange={set("userMobile")}
                            onFocus={() => setFocusedField("userMobile")}
                            onBlur={() => setFocusedField(null)}
                            placeholder="+91 98765 43210"
                            maxLength={15}
                            className={inputCls("userMobile")}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Hostel + Room side by side */}
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-end">
                      {/* Hostel Dropdown */}
                      <div ref={dropdownRef}>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5 pl-0.5">Select Hostel</label>
                        <div className="relative">
                          <button
                            id="hostelDropdown"
                            type="button"
                            onClick={() => setHostelOpen((v) => !v)}
                            className={`w-full pl-10 pr-10 py-3 rounded-xl border text-sm text-left transition-all duration-200 flex items-center focus:outline-none ${
                              form.hostel
                                ? "border-[#1976D2] text-gray-900 bg-white ring-2 ring-[#1976D2]/20 shadow-sm"
                                : hostelOpen
                                ? "border-[#1976D2] text-gray-400 ring-2 ring-[#1976D2]/20 bg-white"
                                : "border-gray-200 text-gray-300 bg-white hover:border-gray-300"
                            }`}
                          >
                            <FiHome size={14} className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${form.hostel || hostelOpen ? "text-[#1976D2]" : "text-gray-400"}`} />
                            <span className={form.hostel ? "text-gray-900" : "text-gray-300"}>
                              {form.hostel || "Choose your hostel"}
                            </span>
                            <FiChevronDown
                              size={14}
                              className={`absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 transition-transform duration-300 ${hostelOpen ? "rotate-180" : ""}`}
                            />
                          </button>

                          {hostelOpen && (
                            <div className="absolute z-30 mt-1.5 w-full bg-white border border-gray-100 rounded-2xl shadow-2xl overflow-hidden"
                              style={{ animation: "dropdownIn 0.15s ease" }}>
                              <div className="max-h-52 overflow-y-auto py-1">
                                {HOSTELS.map((h) => (
                                  <button
                                    key={h}
                                    type="button"
                                    onClick={() => { setForm((f) => ({ ...f, hostel: h })); setHostelOpen(false); setError(""); }}
                                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors duration-150 flex items-center gap-2 ${
                                      form.hostel === h
                                        ? "bg-[#EBF4FF] text-[#1976D2] font-semibold"
                                        : "text-gray-700 hover:bg-gray-50"
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
                      <div className="sm:w-36">
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5 pl-0.5">Room No.</label>
                        <div className="relative">
                          <FiHash size={14} className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${focusedField === "room" ? "text-[#1976D2]" : "text-gray-400"}`} />
                          <input
                            id="roomNumber" type="text"
                            value={form.room}
                            onChange={set("room")}
                            onFocus={() => setFocusedField("room")}
                            onBlur={() => setFocusedField(null)}
                            placeholder="C-505"
                            maxLength={20}
                            className={inputCls("room")}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dashed divider */}
                <div className="mx-7 border-t-2 border-dashed border-gray-100" />

                {/* ── PICKUP REQUEST ── */}
                <div className="px-7 py-6">
                  <p className="text-[10px] font-bold text-gray-400 tracking-[0.15em] uppercase mb-5">Pickup Request</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Clothes count */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5 pl-0.5">Number of Clothes</label>
                      <div className="relative">
                        <FiShoppingBag size={14} className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${focusedField === "clothes" ? "text-[#1976D2]" : "text-gray-400"}`} />
                        <input
                          id="clothesCount" type="number"
                          min="1" max="200"
                          value={form.clothes}
                          onChange={set("clothes")}
                          onFocus={() => setFocusedField("clothes")}
                          onBlur={() => setFocusedField(null)}
                          placeholder="e.g. 10"
                          className={inputCls("clothes")}
                        />
                      </div>
                      <p className="text-[10px] text-[#1976D2] font-semibold mt-1.5 pl-0.5">
                        ℹ Free limit: 10.00 kg per pickup
                      </p>
                    </div>

                    {/* Pickup Date */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5 pl-0.5">Scheduled Pickup Date</label>
                      <div className="relative">
                        <FiCalendar size={14} className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${focusedField === "pickupDate" ? "text-[#1976D2]" : "text-gray-400"}`} />
                        <input
                          id="pickupDate" type="date"
                          value={form.scheduledPickupDate}
                          min={formatDateForInput(getTomorrow())}
                          onChange={set("scheduledPickupDate")}
                          onFocus={() => setFocusedField("pickupDate")}
                          onBlur={() => setFocusedField(null)}
                          className={inputCls("pickupDate")}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="mx-7 mb-4 flex items-start gap-2.5 bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl px-4 py-3">
                    <FiAlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Submit */}
                <div className="px-7 pb-7">
                  <button
                    id="submitPickupRequest"
                    type="submit"
                    disabled={submitting || cooldown > 0}
                    className="w-full py-4 text-white font-bold rounded-2xl transition-all duration-200 flex items-center justify-center gap-2.5 text-sm disabled:opacity-60 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0"
                    style={{
                      background: submitting || cooldown > 0
                        ? "#93bde8"
                        : "linear-gradient(135deg, #1976D2 0%, #1565C0 100%)",
                      boxShadow: submitting || cooldown > 0 ? "none" : "0 8px 24px rgba(25,118,210,0.35)",
                    }}
                  >
                    {submitting ? (
                      <><FiLoader size={18} className="animate-spin" /> Submitting...</>
                    ) : cooldown > 0 ? (
                      <><FiClock size={16} /> Please wait {cooldown}s...</>
                    ) : (
                      <><FiSend size={15} /> Submit Pickup Request</>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Footer */}
            <p className="text-center text-xs text-gray-400 mt-5">
              Secured by <span className="font-semibold text-[#1976D2]">Andes Laundry</span> · MITWPU Partner Service
            </p>
          </div>
        </div>
      </div>

      {/* Global keyframes */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
        @keyframes floatBubble {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-22px) scale(1.04); }
        }
        @keyframes dropdownIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        input[type="date"]::-webkit-calendar-picker-indicator { opacity: 0.4; cursor: pointer; }
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; }
      `}</style>
    </div>
  );
}
