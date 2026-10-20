import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiMenu, FiBriefcase } from "react-icons/fi";
import AdminSidebar from "../components/Layout/AdminSidebar";
import AdminB2BTab from "../components/B2B/AdminB2BTab";
import SectionErrorBoundary from "../components/Shared/SectionErrorBoundary";
import { useHostelOrders } from "../context/HostelAuthContext";

export default function AdminB2BOrders() {
  const navigate = useNavigate();
  const { client, logout } = useHostelOrders();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  const handleSidebarTabChange = useCallback((tab) => {
    setIsMobileMenuOpen(false);
    if (tab === "b2b") return;
    if (tab === "regular") { navigate("/admin/regular-orders"); return; }
    if (tab === "investors") { navigate("/admin/investors"); return; }
    if (tab === "expenses") { navigate("/admin/expenses"); return; }
    if (tab === "salaries") { navigate("/admin/salaries"); return; }
    if (tab === "calculator") { navigate("/admin/calculator"); return; }
    if (tab === "dailyReport") { navigate("/admin/daily-report"); return; }
    if (tab === "services") { navigate("/admin/services"); return; }
    if (tab === "metaleads") { navigate("/admin/meta-leads"); return; }
    navigate("/admin", { state: { initialTab: tab } });
  }, [navigate]);

  return (
    <div className="flex min-h-screen bg-[#F1F5F9]" style={{ fontFamily: "DM Sans, sans-serif" }}>
      <AdminSidebar
        activeTab="b2b"
        setActiveTab={handleSidebarTabChange}
        user={client}
        onLogout={logout}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        isMobileOpen={isMobileMenuOpen}
        setIsMobileOpen={setIsMobileMenuOpen}
      />

      <main
        className={`flex min-h-screen flex-1 flex-col transition-all duration-300 ${
          isSidebarCollapsed ? "lg:ml-[80px]" : "lg:ml-[220px]"
        } ml-0`}
      >
        {/* Top Header */}
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur shadow-sm">
          <div className="flex items-center justify-between gap-4 px-4 py-4 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden"
                aria-label="Open sidebar"
              >
                <FiMenu size={20} />
              </button>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Admin Portal</p>
                <h1 className="text-xl font-extrabold tracking-tight text-slate-950 flex items-center gap-2">
                  <FiBriefcase size={20} className="text-blue-500" />
                  B2B Orders & Batches
                </h1>
              </div>
            </div>
          </div>
        </header>

        <div className="p-4 lg:p-8">
          <SectionErrorBoundary section="b2b-orders" title="B2B Orders & Batches could not be displayed">
            <AdminB2BTab />
          </SectionErrorBoundary>
        </div>
      </main>
    </div>
  );
}
