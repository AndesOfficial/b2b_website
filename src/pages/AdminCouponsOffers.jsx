import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  Timestamp,
  query,
  where,
  limit,
  orderBy,
  getDocs,
} from "firebase/firestore";
import {
  FiMenu,
  FiPlus,
  FiSearch,
  FiTag,
  FiEdit2,
  FiTrash2,
  FiCopy,
  FiCheck,
  FiX,
  FiAlertCircle,
  FiCheckCircle,
  FiPercent,
  FiCalendar,
  FiShoppingBag,
  FiLayers,
  FiEye,
  FiEyeOff,
  FiSave,
  FiRefreshCw,
  FiArrowRight,
  FiDollarSign,
} from "react-icons/fi";
import { db } from "../firebase";
import AdminSidebar from "../components/Layout/AdminSidebar";
import DashboardSkeleton from "../components/Shared/DashboardSkeleton";
import { useHostelAuth } from "../context/HostelAuthContext";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatDisplayDate(val) {
  if (!val) return "Permanent";
  if (val?.toDate) return val.toDate().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  if (typeof val === "string") {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }
  return String(val);
}

function toInputDate(val) {
  if (!val) return "";
  if (val?.toDate) return val.toDate().toISOString().split("T")[0];
  if (typeof val === "string") {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  }
  return "";
}

export default function AdminCouponsOffers() {
  const navigate = useNavigate();
  const { client, logout, isViewer } = useHostelAuth();

  // Responsive sidebar
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Sub-view tabs: 'coupons' | 'categories' | 'orders'
  const [activeTab, setActiveTab] = useState("coupons");

  // Coupons State
  const [coupons, setCoupons] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all"); // 'all' | 'active' | 'inactive'
  const [searchQuery, setSearchQuery] = useState("");
  const [editingCoupon, setEditingCoupon] = useState(undefined); // undefined: closed, null: new, obj: editing
  const [deleteConfirm, setDeleteConfirm] = useState(null); // coupon to delete
  const [copiedCode, setCopiedCode] = useState(null);

  // Category Promotions State (store_settings/config.promotion)
  const [promotionConfig, setPromotionConfig] = useState(null);
  const [promoForm, setPromoForm] = useState(null);
  const [isSavingPromo, setIsSavingPromo] = useState(false);

  // Coupon Orders Log State
  const [couponOrders, setCouponOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderSearchQuery, setOrderSearchQuery] = useState("");

  // Feedback Toast
  const [toast, setToast] = useState(null);
  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // Window resize handler
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 1024;
      setIsSidebarCollapsed(isMobile);
      if (!isMobile) setIsMobileMenuOpen(false);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 1. Live Firestore Sync for available_coupons
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "available_coupons"),
      (snap) => {
        const list = snap.docs.map((docSnap) => {
          const data = docSnap.data();
          const code = (data.code || data.couponCode || docSnap.id).toString().trim().toUpperCase();
          const isActive = data.isActive === true || data.active === true || data.isActive === "true";
          return {
            id: docSnap.id,
            ...data,
            code,
            isActive,
          };
        });
        setCoupons(list);
      },
      (err) => {
        console.error("Error loading coupons:", err);
        showToast("error", "Failed to load coupons from Firestore.");
        setCoupons([]);
      }
    );
    return () => unsub();
  }, []);

  // 2. Live Firestore Sync for store_settings/config (Promotion)
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "store_settings", "config"),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const promo = data.promotion || {};
          setPromotionConfig(promo);
          setPromoForm(promo);
        } else {
          setPromotionConfig({});
          setPromoForm({});
        }
      },
      (err) => {
        console.error("Error loading promotion config:", err);
      }
    );
    return () => unsub();
  }, []);

  // 3. Load Recent Coupon Orders
  const loadRecentCouponOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      // Query cartdetails for orders with coupon discounts or coupon code
      // Read last 150 orders to identify ones with discounts
      const q = query(collection(db, "cartdetails"), orderBy("orderDate", "desc"), limit(150));
      const snap = await getDocs(q);
      const orders = [];
      snap.docs.forEach((d) => {
        const data = d.data();
        const couponDiscount = Number(data.couponDiscount || data.coupon_discount || 0);
        const promotionDiscount = Number(data.promotionDiscount || (data.promotion && data.promotion.discount) || 0);
        const couponCode = (data.couponCode || data.coupon_code || "").toString().trim();
        if (couponDiscount > 0 || promotionDiscount > 0 || couponCode) {
          orders.push({
            id: d.id,
            ...data,
            couponDiscount,
            promotionDiscount,
            couponCode,
          });
        }
      });
      setCouponOrders(orders);
    } catch (e) {
      console.warn("Could not load from cartdetails, trying regular orders:", e);
      try {
        const q2 = query(collection(db, "orders"), limit(100));
        const snap2 = await getDocs(q2);
        const orders = [];
        snap2.docs.forEach((d) => {
          const data = d.data();
          const couponDiscount = Number(data.couponDiscount || data.coupon_discount || 0);
          const couponCode = (data.couponCode || data.coupon_code || "").toString().trim();
          if (couponDiscount > 0 || couponCode) {
            orders.push({
              id: d.id,
              ...data,
              couponDiscount,
              couponCode,
            });
          }
        });
        setCouponOrders(orders);
      } catch (err) {
        console.error("Error loading coupon orders:", err);
      }
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "orders") {
      loadRecentCouponOrders();
    }
  }, [activeTab, loadRecentCouponOrders]);

  // Sidebar navigation handler
  const handleSidebarTabChange = useCallback(
    (tab) => {
      setIsMobileMenuOpen(false);
      if (tab === "coupons") return;
      if (tab === "services") { navigate("/admin/services"); return; }
      if (tab === "b2b") { navigate("/admin/b2b-orders"); return; }
      if (tab === "regular") { navigate("/admin/regular-orders"); return; }
      if (tab === "investors") { navigate("/admin/investors"); return; }
      if (tab === "expenses") { navigate("/admin/expenses"); return; }
      if (tab === "salaries") { navigate("/admin/salaries"); return; }
      if (tab === "calculator") { navigate("/admin/calculator"); return; }
      if (tab === "dailyReport") { navigate("/admin/daily-report"); return; }
      if (tab === "metaleads") { navigate("/admin/meta-leads"); return; }
      navigate("/admin", { state: { initialTab: tab } });
    },
    [navigate]
  );

  // Copy coupon code to clipboard
  const handleCopyCode = (code, e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    showToast("success", `Coupon code "${code}" copied to clipboard!`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Instant inline toggle for Active/Inactive status
  const handleToggleActive = async (coupon, e) => {
    e.stopPropagation();
    if (isViewer) {
      showToast("error", "Viewer accounts cannot modify coupons.");
      return;
    }
    const newStatus = !coupon.isActive;
    try {
      await setDoc(
        doc(db, "available_coupons", coupon.id),
        {
          isActive: newStatus,
          active: newStatus,
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      );
      showToast("success", `Coupon "${coupon.code}" is now ${newStatus ? "Active" : "Inactive"}.`);
    } catch (err) {
      console.error("Error toggling coupon status:", err);
      showToast("error", "Failed to update coupon status: " + err.message);
    }
  };

  // Delete coupon
  const handleDeleteCoupon = async () => {
    if (!deleteConfirm) return;
    if (isViewer) {
      showToast("error", "Viewer accounts cannot delete coupons.");
      return;
    }
    try {
      await deleteDoc(doc(db, "available_coupons", deleteConfirm.id));
      showToast("success", `Coupon "${deleteConfirm.code}" deleted successfully.`);
      setDeleteConfirm(null);
    } catch (err) {
      console.error("Error deleting coupon:", err);
      showToast("error", "Failed to delete coupon: " + err.message);
    }
  };

  // Save Category Promotion Config
  const handleSavePromotionConfig = async () => {
    if (isViewer) {
      showToast("error", "Viewer accounts cannot modify store promotion settings.");
      return;
    }
    setIsSavingPromo(true);
    try {
      await setDoc(
        doc(db, "store_settings", "config"),
        {
          promotion: promoForm,
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      );
      showToast("success", "Category promotional offers updated successfully!");
    } catch (err) {
      console.error("Error saving promotion config:", err);
      showToast("error", "Failed to update category offers: " + err.message);
    } finally {
      setIsSavingPromo(false);
    }
  };

  // Filtered & Searched coupons list
  const filteredCoupons = useMemo(() => {
    if (!coupons) return [];
    return coupons.filter((c) => {
      // Status filter
      if (statusFilter === "active" && !c.isActive) return false;
      if (statusFilter === "inactive" && c.isActive) return false;

      // Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const code = (c.code || "").toLowerCase();
        const title = (c.title || "").toLowerCase();
        const desc = (c.description || "").toLowerCase();
        if (!code.includes(q) && !title.includes(q) && !desc.includes(q)) return false;
      }
      return true;
    });
  }, [coupons, statusFilter, searchQuery]);

  // Key KPI stats
  const stats = useMemo(() => {
    const list = coupons || [];
    const total = list.length;
    const active = list.filter((c) => c.isActive).length;
    const inactive = total - active;
    const onHome = list.filter((c) => c.showOnHome && c.isActive).length;
    const totalDiscountGiven = couponOrders.reduce((sum, o) => sum + (o.couponDiscount || 0), 0);
    return { total, active, inactive, onHome, totalDiscountGiven };
  }, [coupons, couponOrders]);

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    if (!orderSearchQuery.trim()) return couponOrders;
    const q = orderSearchQuery.toLowerCase().trim();
    return couponOrders.filter((o) => {
      const id = (o.id || "").toLowerCase();
      const name = (o.name || o.userName || "").toLowerCase();
      const phone = (o.phone || o.userPhone || o.mobile || "").toLowerCase();
      const code = (o.couponCode || "").toLowerCase();
      return id.includes(q) || name.includes(q) || phone.includes(q) || code.includes(q);
    });
  }, [couponOrders, orderSearchQuery]);

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]" style={{ fontFamily: "DM Sans, sans-serif" }}>
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-semibold transition-all duration-300 animate-slide-up ${
            toast.type === "error"
              ? "bg-red-600 text-white shadow-red-500/20"
              : "bg-slate-900 text-white shadow-slate-900/20"
          }`}
        >
          {toast.type === "error" ? <FiAlertCircle size={18} /> : <FiCheckCircle size={18} className="text-emerald-400" />}
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 text-white/70 hover:text-white">
            <FiX size={16} />
          </button>
        </div>
      )}

      {/* Sidebar */}
      <AdminSidebar
        activeTab="coupons"
        setActiveTab={handleSidebarTabChange}
        issuesCount={0}
        user={client}
        onLogout={logout}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        isMobileOpen={isMobileMenuOpen}
        setIsMobileOpen={setIsMobileMenuOpen}
      />

      {/* Main Content */}
      <main
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${
          isSidebarCollapsed ? "lg:ml-[80px]" : "lg:ml-[220px]"
        }`}
      >
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-6 py-4 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="Open navigation menu"
            >
              <FiMenu size={22} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                  <FiPercent size={20} />
                </span>
                <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Coupons & Promotional Offers</h1>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage active and inactive promo codes, category deals, and view order redemptions across all apps.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!isViewer && (
              <button
                onClick={() => setEditingCoupon(null)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-sm hover:shadow transition-all cursor-pointer active:scale-95"
              >
                <FiPlus size={18} />
                <span>Create Coupon</span>
              </button>
            )}
          </div>
        </header>

        {/* Content Container */}
        <div className="p-6 max-w-7xl w-full mx-auto space-y-6">
          {/* Key KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Total Coupons</span>
                <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <FiTag size={16} />
                </span>
              </div>
              <div className="text-2xl font-black text-slate-900">{stats.total}</div>
              <div className="text-[11px] text-slate-400 mt-1">Codes created in Firestore</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-xs">
              <div className="flex items-center justify-between text-emerald-600 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Coupons</span>
                <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <FiCheckCircle size={16} />
                </span>
              </div>
              <div className="text-2xl font-black text-emerald-600">{stats.active}</div>
              <div className="text-[11px] text-emerald-600/80 mt-1">Live & usable in customer app</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Inactive / Paused</span>
                <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
                  <FiEyeOff size={16} />
                </span>
              </div>
              <div className="text-2xl font-black text-amber-600">{stats.inactive}</div>
              <div className="text-[11px] text-slate-400 mt-1">Disabled from public checkout</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Featured on Home</span>
                <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <FiLayers size={16} />
                </span>
              </div>
              <div className="text-2xl font-black text-indigo-600">{stats.onHome}</div>
              <div className="text-[11px] text-slate-400 mt-1">Active on home carousel</div>
            </div>
          </div>

          {/* Sub-View Navigation Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
            <div className="inline-flex items-center gap-1.5 bg-slate-200/70 p-1.5 rounded-2xl w-fit">
              <button
                type="button"
                onClick={() => setActiveTab("coupons")}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  activeTab === "coupons"
                    ? "bg-white text-blue-600 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <FiTag size={15} />
                <span>Coupons Directory ({stats.total})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("categories")}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  activeTab === "categories"
                    ? "bg-white text-blue-600 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <FiLayers size={15} />
                <span>Category Offers</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("orders")}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  activeTab === "orders"
                    ? "bg-white text-blue-600 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <FiShoppingBag size={15} />
                <span>Coupon Orders Log</span>
              </button>
            </div>
          </div>

          {/* TAB 1: COUPONS DIRECTORY */}
          {activeTab === "coupons" && (
            <div className="space-y-4">
              {/* Search & Filter Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/70 shadow-xs">
                {/* Status Filter Pills */}
                <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => setStatusFilter("all")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      statusFilter === "all" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    All ({stats.total})
                  </button>
                  <button
                    onClick={() => setStatusFilter("active")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      statusFilter === "active" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Active ({stats.active})
                  </button>
                  <button
                    onClick={() => setStatusFilter("inactive")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      statusFilter === "inactive" ? "bg-amber-600 text-white shadow-xs" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Inactive ({stats.inactive})
                  </button>
                </div>

                {/* Search Input */}
                <div className="relative flex-1 max-w-md">
                  <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by coupon code, title, or description..."
                    className="w-full pl-10 pr-9 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <FiX size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Coupons List */}
              {coupons === null ? (
                <DashboardSkeleton />
              ) : filteredCoupons.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200/70 p-12 text-center">
                  <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
                    <FiTag size={26} />
                  </div>
                  <h3 className="text-base font-bold text-slate-800">No coupons found</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    {searchQuery
                      ? "No coupons match your search query. Try searching for something else."
                      : statusFilter !== "all"
                      ? `There are currently no ${statusFilter} coupons.`
                      : "Create your first promotional coupon to offer discounts to your customers."}
                  </p>
                  {!isViewer && (
                    <button
                      onClick={() => setEditingCoupon(null)}
                      className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                    >
                      <FiPlus size={15} />
                      <span>Create New Coupon</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredCoupons.map((coupon) => {
                    const isPercentage = Number(coupon.discountPercentage) > 0;
                    const isFlat = Number(coupon.discount) > 0;
                    const isFreeDel = coupon.freeDelivery === true;

                    return (
                      <div
                        key={coupon.id}
                        className={`bg-white rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-md ${
                          coupon.isActive ? "border-slate-200/80 hover:border-blue-300" : "border-slate-200/60 opacity-80 bg-slate-50/50"
                        }`}
                      >
                        {/* Card Top Banner */}
                        <div className="p-5 pb-3">
                          <div className="flex items-start justify-between gap-3 mb-3">
                            {/* Code Badge with Copy */}
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-base font-black px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200/80 rounded-xl tracking-wider select-all">
                                {coupon.code}
                              </span>
                              <button
                                onClick={(e) => handleCopyCode(coupon.code, e)}
                                title="Copy code"
                                className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                              >
                                {copiedCode === coupon.code ? <FiCheck size={14} className="text-emerald-600" /> : <FiCopy size={14} />}
                              </button>
                            </div>

                            {/* Active Switch Toggle */}
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={isViewer}
                                onClick={(e) => handleToggleActive(coupon, e)}
                                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                  coupon.isActive ? "bg-emerald-500" : "bg-slate-300"
                                }`}
                                role="switch"
                                aria-checked={coupon.isActive}
                                title={coupon.isActive ? "Click to deactivate" : "Click to activate"}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                    coupon.isActive ? "translate-x-5" : "translate-x-0"
                                  }`}
                                />
                              </button>
                              <span
                                className={`text-[11px] font-bold uppercase tracking-wider ${
                                  coupon.isActive ? "text-emerald-600" : "text-slate-400"
                                }`}
                              >
                                {coupon.isActive ? "Active" : "Inactive"}
                              </span>
                            </div>
                          </div>

                          {/* Title & Description */}
                          <h4 className="font-bold text-slate-900 text-sm leading-snug line-clamp-1">{coupon.title || coupon.code}</h4>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                            {coupon.description || "No description provided."}
                          </p>

                          {/* Discount Feature Pill */}
                          <div className="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-200/50 text-blue-700 text-xs font-extrabold">
                            <FiPercent size={13} />
                            <span>
                              {isPercentage && `${coupon.discountPercentage}% OFF`}
                              {isPercentage && Number(coupon.upto) > 0 && ` (up to ₹${coupon.upto})`}
                              {isFlat && `Flat ₹${coupon.discount} OFF`}
                              {isFreeDel && "Free Delivery"}
                              {!isPercentage && !isFlat && !isFreeDel && "Special Promotion"}
                            </span>
                          </div>
                        </div>

                        {/* Conditions & Details */}
                        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 space-y-2 text-[11px] text-slate-600">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Min Order:</span>
                            <span className="font-bold text-slate-800">
                              {Number(coupon.minOrder) > 0 ? `₹${coupon.minOrder}` : "None"}
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Usage Limit:</span>
                            <span className="font-bold text-slate-800">
                              {coupon.maxUsesPerUser ? `${coupon.maxUsesPerUser} per customer` : "Unlimited"}
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Validity:</span>
                            <span className="font-bold text-slate-800">
                              {formatDisplayDate(coupon.validUntil)}
                            </span>
                          </div>

                          {/* Badges: Visibility & Carousel */}
                          <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                            {coupon.hidden ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                <FiEyeOff size={11} />
                                Secret / Direct Code
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <FiEye size={11} />
                                Public in App
                              </span>
                            )}

                            {coupon.showOnHome && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                <FiLayers size={11} />
                                Home Banner
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions Footer */}
                        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-end gap-2 bg-white">
                          {!isViewer && (
                            <>
                              <button
                                onClick={() => setEditingCoupon(coupon)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              >
                                <FiEdit2 size={13} />
                                <span>Edit</span>
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(coupon)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              >
                                <FiTrash2 size={13} />
                                <span>Delete</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CATEGORY PROMOTIONS */}
          {activeTab === "categories" && (
            <div className="bg-white rounded-2xl border border-slate-200/70 p-6 shadow-xs space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-900">Automatic Category Promotions</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  These promotional deals are applied automatically to customer carts when qualifying items are added (configured in{" "}
                  <code className="text-blue-600 font-mono">store_settings/config.promotion</code>).
                </p>
              </div>

              {!promoForm ? (
                <DashboardSkeleton />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* 1. Laundry Promotion */}
                  <div className="p-5 rounded-2xl border border-slate-200/80 bg-slate-50/50 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                          🧺
                        </span>
                        <div>
                          <h4 className="font-bold text-slate-800 text-sm">Laundry Promotion</h4>
                          <span className="text-[11px] text-slate-400">e.g. ₹1 Laundry Offer</span>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          disabled={isViewer}
                          checked={Boolean(promoForm.laundry?.enabled)}
                          onChange={(e) =>
                            setPromoForm((prev) => ({
                              ...prev,
                              laundry: { ...prev.laundry, enabled: e.target.checked },
                            }))
                          }
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block font-medium text-slate-600 mb-1">Promo Quantity (kg)</label>
                        <input
                          type="number"
                          disabled={isViewer}
                          value={promoForm.laundry?.promotionalQuantity ?? ""}
                          onChange={(e) =>
                            setPromoForm((prev) => ({
                              ...prev,
                              laundry: { ...prev.laundry, promotionalQuantity: Number(e.target.value) },
                            }))
                          }
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-600 mb-1">Promo Rate (₹/kg)</label>
                        <input
                          type="number"
                          disabled={isViewer}
                          value={promoForm.laundry?.promotionalUnitPrice ?? ""}
                          onChange={(e) =>
                            setPromoForm((prev) => ({
                              ...prev,
                              laundry: { ...prev.laundry, promotionalUnitPrice: Number(e.target.value) },
                            }))
                          }
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block font-medium text-slate-600 mb-1">Min Order Value (₹)</label>
                        <input
                          type="number"
                          disabled={isViewer}
                          value={promoForm.laundry?.minimumOrderValue ?? ""}
                          onChange={(e) =>
                            setPromoForm((prev) => ({
                              ...prev,
                              laundry: { ...prev.laundry, minimumOrderValue: Number(e.target.value) },
                            }))
                          }
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 2. Dry Cleaning Promotion */}
                  <div className="p-5 rounded-2xl border border-slate-200/80 bg-slate-50/50 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-xs">
                          👔
                        </span>
                        <div>
                          <h4 className="font-bold text-slate-800 text-sm">Dry Cleaning Promotion</h4>
                          <span className="text-[11px] text-slate-400">e.g. ₹30 Dry Clean Items</span>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          disabled={isViewer}
                          checked={Boolean(promoForm.dryCleaning?.enabled)}
                          onChange={(e) =>
                            setPromoForm((prev) => ({
                              ...prev,
                              dryCleaning: { ...prev.dryCleaning, enabled: e.target.checked },
                            }))
                          }
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block font-medium text-slate-600 mb-1">Promo Quantity (pcs)</label>
                        <input
                          type="number"
                          disabled={isViewer}
                          value={promoForm.dryCleaning?.promotionalQuantity ?? ""}
                          onChange={(e) =>
                            setPromoForm((prev) => ({
                              ...prev,
                              dryCleaning: { ...prev.dryCleaning, promotionalQuantity: Number(e.target.value) },
                            }))
                          }
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-600 mb-1">Promo Rate (₹/pc)</label>
                        <input
                          type="number"
                          disabled={isViewer}
                          value={promoForm.dryCleaning?.promotionalUnitPrice ?? ""}
                          onChange={(e) =>
                            setPromoForm((prev) => ({
                              ...prev,
                              dryCleaning: { ...prev.dryCleaning, promotionalUnitPrice: Number(e.target.value) },
                            }))
                          }
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-600 mb-1">Flat Discount (₹)</label>
                        <input
                          type="number"
                          disabled={isViewer}
                          value={promoForm.dryCleaning?.flatDiscount ?? ""}
                          onChange={(e) =>
                            setPromoForm((prev) => ({
                              ...prev,
                              dryCleaning: { ...prev.dryCleaning, flatDiscount: Number(e.target.value) },
                            }))
                          }
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-600 mb-1">Min Order Value (₹)</label>
                        <input
                          type="number"
                          disabled={isViewer}
                          value={promoForm.dryCleaning?.minimumOrderValue ?? ""}
                          onChange={(e) =>
                            setPromoForm((prev) => ({
                              ...prev,
                              dryCleaning: { ...prev.dryCleaning, minimumOrderValue: Number(e.target.value) },
                            }))
                          }
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 3. Footwear Promotion */}
                  <div className="p-5 rounded-2xl border border-slate-200/80 bg-slate-50/50 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-xs">
                          👟
                        </span>
                        <div>
                          <h4 className="font-bold text-slate-800 text-sm">Footwear Promotion</h4>
                          <span className="text-[11px] text-slate-400">e.g. Flat ₹50 off shoes</span>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          disabled={isViewer}
                          checked={Boolean(promoForm.footwear?.enabled)}
                          onChange={(e) =>
                            setPromoForm((prev) => ({
                              ...prev,
                              footwear: { ...prev.footwear, enabled: e.target.checked },
                            }))
                          }
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block font-medium text-slate-600 mb-1">Flat Discount (₹)</label>
                        <input
                          type="number"
                          disabled={isViewer}
                          value={promoForm.footwear?.flatDiscount ?? ""}
                          onChange={(e) =>
                            setPromoForm((prev) => ({
                              ...prev,
                              footwear: { ...prev.footwear, flatDiscount: Number(e.target.value) },
                            }))
                          }
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-600 mb-1">Min Order Value (₹)</label>
                        <input
                          type="number"
                          disabled={isViewer}
                          value={promoForm.footwear?.minimumOrderValue ?? ""}
                          onChange={(e) =>
                            setPromoForm((prev) => ({
                              ...prev,
                              footwear: { ...prev.footwear, minimumOrderValue: Number(e.target.value) },
                            }))
                          }
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 4. New User Promotion */}
                  <div className="p-5 rounded-2xl border border-slate-200/80 bg-slate-50/50 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xs">
                          🎉
                        </span>
                        <div>
                          <h4 className="font-bold text-slate-800 text-sm">New User Promotion</h4>
                          <span className="text-[11px] text-slate-400">e.g. ₹99 first order deal</span>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          disabled={isViewer}
                          checked={Boolean(promoForm.newUser?.enabled)}
                          onChange={(e) =>
                            setPromoForm((prev) => ({
                              ...prev,
                              newUser: { ...prev.newUser, enabled: e.target.checked },
                            }))
                          }
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block font-medium text-slate-600 mb-1">Max Kg</label>
                        <input
                          type="number"
                          disabled={isViewer}
                          value={promoForm.newUser?.maxKg ?? promoForm.newUser?.promotionalQuantity ?? ""}
                          onChange={(e) =>
                            setPromoForm((prev) => ({
                              ...prev,
                              newUser: { ...prev.newUser, maxKg: Number(e.target.value), promotionalQuantity: Number(e.target.value) },
                            }))
                          }
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-600 mb-1">Price per Kg (₹)</label>
                        <input
                          type="number"
                          disabled={isViewer}
                          value={promoForm.newUser?.pricePerKg ?? promoForm.newUser?.promotionalUnitPrice ?? ""}
                          onChange={(e) =>
                            setPromoForm((prev) => ({
                              ...prev,
                              newUser: { ...prev.newUser, pricePerKg: Number(e.target.value), promotionalUnitPrice: Number(e.target.value) },
                            }))
                          }
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block font-medium text-slate-600 mb-1">Min Order Value (₹)</label>
                        <input
                          type="number"
                          disabled={isViewer}
                          value={promoForm.newUser?.minimumOrderValue ?? ""}
                          onChange={(e) =>
                            setPromoForm((prev) => ({
                              ...prev,
                              newUser: { ...prev.newUser, minimumOrderValue: Number(e.target.value) },
                            }))
                          }
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {!isViewer && (
                <div className="flex justify-end pt-4 border-t border-slate-100">
                  <button
                    onClick={handleSavePromotionConfig}
                    disabled={isSavingPromo}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-sm transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    <FiSave size={16} />
                    <span>{isSavingPromo ? "Saving..." : "Save Category Offers"}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: COUPON ORDERS LOG */}
          {activeTab === "orders" && (
            <div className="bg-white rounded-2xl border border-slate-200/70 p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Orders with Coupons & Promotional Offers</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Live log of B2C customer orders where a coupon code or promotion discount was redeemed.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                      type="text"
                      value={orderSearchQuery}
                      onChange={(e) => setOrderSearchQuery(e.target.value)}
                      placeholder="Search order ID, customer, coupon..."
                      className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    onClick={loadRecentCouponOrders}
                    title="Refresh orders"
                    className="p-2 text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                  >
                    <FiRefreshCw size={14} className={loadingOrders ? "animate-spin" : ""} />
                  </button>
                </div>
              </div>

              {loadingOrders ? (
                <DashboardSkeleton />
              ) : filteredOrders.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  No orders with coupon discounts found.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200/80">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="px-4 py-3">Order ID</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Customer</th>
                        <th className="px-4 py-3">Coupon / Promo</th>
                        <th className="px-4 py-3 text-right">Items Subtotal</th>
                        <th className="px-4 py-3 text-right">Discount</th>
                        <th className="px-4 py-3 text-right">Net Total</th>
                        <th className="px-4 py-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {filteredOrders.map((order) => {
                        const total = Number(order.totalCost || order.total || order.amount || 0);
                        const subtotal = Number(order.subtotal || order.itemsTotal || total + (order.couponDiscount || 0));
                        return (
                          <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="px-4 py-3 font-mono font-bold text-blue-600 select-all">
                              {order.id.slice(0, 10)}...
                            </td>
                            <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                              {order.orderDate ? formatDisplayDate(order.orderDate) : "Recent"}
                            </td>
                            <td className="px-4 py-3 text-slate-800">
                              <div className="font-bold">{order.name || order.userName || "Customer"}</div>
                              <div className="text-[10px] text-slate-400">{order.phone || order.userPhone || "—"}</div>
                            </td>
                            <td className="px-4 py-3">
                              {order.couponCode ? (
                                <span className="font-mono font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[11px]">
                                  {order.couponCode}
                                </span>
                              ) : (
                                <span className="text-[11px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md font-bold">
                                  Category Deal
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right text-slate-500 font-mono">
                              ₹{subtotal.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600 whitespace-nowrap">
                              🏷️ -₹{((order.couponDiscount || 0) + (order.promotionDiscount || 0)).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-black text-slate-900 whitespace-nowrap">
                              ₹{total.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                  order.isPaid
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-amber-50 text-amber-700 border border-amber-200"
                                }`}
                              >
                                {order.isPaid ? "Paid" : "Pending"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ─── CREATE / EDIT MODAL ──────────────────────────────────────────────── */}
      {editingCoupon !== undefined && (
        <CouponEditorModal
          coupon={editingCoupon}
          isOpen={true}
          onClose={() => setEditingCoupon(undefined)}
          onSuccess={(savedCoupon) => {
            setEditingCoupon(undefined);
            showToast("success", `Coupon "${savedCoupon.code}" saved successfully!`);
          }}
        />
      )}

      {/* ─── DELETE CONFIRMATION MODAL ────────────────────────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <FiTrash2 size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Delete Coupon?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to permanently delete coupon{" "}
                <span className="font-mono font-bold text-slate-800">{deleteConfirm.code}</span>? This code will no longer be usable by any customer.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteCoupon}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors shadow-sm"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── COUPON EDITOR MODAL COMPONENT ───────────────────────────────────────────
function CouponEditorModal({ coupon, isOpen, onClose, onSuccess }) {
  const isNew = !coupon || !coupon.id;

  const [formData, setFormData] = useState({
    code: coupon?.code || "",
    title: coupon?.title || "",
    description: coupon?.description || "",
    discountType: coupon?.discountType || (Number(coupon?.discount) > 0 ? "flat" : coupon?.freeDelivery ? "free_delivery" : "percentage"),
    discountPercentage: coupon?.discountPercentage || "",
    discount: coupon?.discount || "",
    upto: coupon?.upto || "",
    minOrder: coupon?.minOrder ?? "149",
    freeDelivery: Boolean(coupon?.freeDelivery),
    isActive: coupon ? coupon.isActive : true,
    hidden: Boolean(coupon?.hidden),
    showOnHome: Boolean(coupon?.showOnHome),
    maxUsesPerUser: coupon?.maxUsesPerUser ?? "1",
    maxTotalUses: coupon?.maxTotalUses ?? "",
    validUntil: toInputDate(coupon?.validUntil),
  });

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const code = formData.code.trim().toUpperCase().replace(/\s+/g, "");
    if (!code) {
      setError("Coupon Code is required.");
      return;
    }

    if (!formData.title.trim()) {
      setError("Please provide a title for the coupon.");
      return;
    }

    const discountPercentage = formData.discountType === "percentage" ? Number(formData.discountPercentage) : 0;
    const flatDiscount = formData.discountType === "flat" ? Number(formData.discount) : 0;
    const isFreeDel = formData.discountType === "free_delivery" || formData.freeDelivery;

    if (formData.discountType === "percentage" && (!discountPercentage || discountPercentage <= 0 || discountPercentage > 100)) {
      setError("Please enter a valid discount percentage (1% to 100%).");
      return;
    }

    if (formData.discountType === "flat" && (!flatDiscount || flatDiscount <= 0)) {
      setError("Please enter a valid flat discount amount in rupees.");
      return;
    }

    setSubmitting(true);
    try {
      const docData = {
        code,
        couponCode: code,
        title: formData.title.trim(),
        description: formData.description.trim(),
        discountType: formData.discountType,
        discountPercentage: discountPercentage > 0 ? discountPercentage : 0,
        discount: flatDiscount > 0 ? flatDiscount : 0,
        upto: Number(formData.upto) || (formData.discountType === "percentage" ? 100 : 0),
        minOrder: Number(formData.minOrder) || 0,
        freeDelivery: isFreeDel,
        isActive: Boolean(formData.isActive),
        active: Boolean(formData.isActive),
        hidden: Boolean(formData.hidden),
        showOnHome: Boolean(formData.showOnHome),
        maxUsesPerUser: formData.maxUsesPerUser ? Number(formData.maxUsesPerUser) : null,
        maxTotalUses: formData.maxTotalUses ? Number(formData.maxTotalUses) : null,
        validUntil: formData.validUntil ? formData.validUntil : null,
        updatedAt: Timestamp.now(),
      };

      if (isNew) {
        docData.createdAt = Timestamp.now();
      }

      await setDoc(doc(db, "available_coupons", code), docData, { merge: true });

      onSuccess({ id: code, ...docData });
    } catch (err) {
      console.error("Error saving coupon:", err);
      setError("Failed to save coupon: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 my-8 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <FiTag size={18} />
            </span>
            <h3 className="text-base font-bold text-slate-900">{isNew ? "Create New Coupon" : "Edit Coupon"}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
            <FiX size={18} />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl">
            <FiAlertCircle size={15} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-medium">
          {/* Coupon Code */}
          <div>
            <label className="block text-slate-700 font-bold mb-1">Coupon Code *</label>
            <input
              type="text"
              required
              disabled={!isNew}
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/\s+/g, "") })}
              placeholder="e.g. FESTIVE50, ANDESFIRST"
              className="w-full px-3.5 py-2.5 font-mono uppercase bg-slate-50 border border-slate-200 rounded-xl font-bold tracking-wider focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-60"
            />
            {!isNew && <p className="text-[10px] text-slate-400 mt-0.5">Code identifier cannot be renamed after creation.</p>}
          </div>

          {/* Title & Description */}
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Display Title *</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. 50% OFF up to ₹100 on Laundry"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Description / Terms</label>
              <textarea
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="e.g. Valid on all laundry & dry clean orders above ₹199"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Discount Type Radio */}
          <div>
            <label className="block text-slate-700 font-bold mb-1.5">Discount Type *</label>
            <div className="grid grid-cols-3 gap-2">
              <label
                className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border cursor-pointer font-bold transition-all ${
                  formData.discountType === "percentage"
                    ? "bg-blue-50 border-blue-500 text-blue-700"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <input
                  type="radio"
                  name="discountType"
                  value="percentage"
                  checked={formData.discountType === "percentage"}
                  onChange={() => setFormData({ ...formData, discountType: "percentage" })}
                  className="sr-only"
                />
                <span>Percentage (%)</span>
              </label>

              <label
                className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border cursor-pointer font-bold transition-all ${
                  formData.discountType === "flat"
                    ? "bg-blue-50 border-blue-500 text-blue-700"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <input
                  type="radio"
                  name="discountType"
                  value="flat"
                  checked={formData.discountType === "flat"}
                  onChange={() => setFormData({ ...formData, discountType: "flat" })}
                  className="sr-only"
                />
                <span>Flat Rupee (₹)</span>
              </label>

              <label
                className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border cursor-pointer font-bold transition-all ${
                  formData.discountType === "free_delivery"
                    ? "bg-blue-50 border-blue-500 text-blue-700"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <input
                  type="radio"
                  name="discountType"
                  value="free_delivery"
                  checked={formData.discountType === "free_delivery"}
                  onChange={() => setFormData({ ...formData, discountType: "free_delivery", freeDelivery: true })}
                  className="sr-only"
                />
                <span>Free Delivery</span>
              </label>
            </div>
          </div>

          {/* Discount Values */}
          <div className="grid grid-cols-2 gap-3">
            {formData.discountType === "percentage" && (
              <>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Discount % *</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={formData.discountPercentage}
                    onChange={(e) => setFormData({ ...formData, discountPercentage: e.target.value })}
                    placeholder="e.g. 50"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Max Cap (₹ Upto)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.upto}
                    onChange={(e) => setFormData({ ...formData, upto: e.target.value })}
                    placeholder="e.g. 100"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </>
            )}

            {formData.discountType === "flat" && (
              <div className="col-span-2">
                <label className="block text-slate-700 font-bold mb-1">Flat Discount Amount (₹) *</label>
                <input
                  type="number"
                  min="1"
                  value={formData.discount}
                  onChange={(e) => setFormData({ ...formData, discount: e.target.value })}
                  placeholder="e.g. 75"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
            )}

            <div>
              <label className="block text-slate-700 font-bold mb-1">Minimum Order (₹)</label>
              <input
                type="number"
                min="0"
                value={formData.minOrder}
                onChange={(e) => setFormData({ ...formData, minOrder: e.target.value })}
                placeholder="e.g. 199"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Max Uses Per Customer</label>
              <input
                type="number"
                min="1"
                value={formData.maxUsesPerUser}
                onChange={(e) => setFormData({ ...formData, maxUsesPerUser: e.target.value })}
                placeholder="1 (empty = unlimited)"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>
          </div>

          {/* Expiry Date */}
          <div>
            <label className="block text-slate-700 font-bold mb-1">Expiry Date (optional)</label>
            <input
              type="date"
              value={formData.validUntil}
              onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
            />
            <p className="text-[10px] text-slate-400 mt-0.5">Leave blank for a permanent coupon with no expiry date.</p>
          </div>

          {/* Flags & Switches */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800">Active Status</span>
                <p className="text-[10px] text-slate-400">Coupon can be applied at checkout</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800">Public in App Coupon List</span>
                <p className="text-[10px] text-slate-400">If unchecked, customers must manually type the code</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={!formData.hidden}
                  onChange={(e) => setFormData({ ...formData, hidden: !e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800">Feature on Home Screen Banner</span>
                <p className="text-[10px] text-slate-400">Shows in the home screen carousel of the mobile app</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.showOnHome}
                  onChange={(e) => setFormData({ ...formData, showOnHome: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-sm cursor-pointer disabled:opacity-50"
            >
              {submitting ? "Saving..." : isNew ? "Create Coupon" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
