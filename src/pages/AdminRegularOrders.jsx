import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiMenu, FiInbox } from "react-icons/fi";
import AdminSidebar from "../components/Layout/AdminSidebar";
import AdminRegularTab from "../components/AdminRegularTab";
import { useHostelAuth } from "../context/HostelAuthContext";
import { useAdminDashboardData } from "../hooks/useAdminDashboardData";
import LoadingSpinner from "../components/Shared/LoadingSpinner";
import DashboardSkeleton from "../components/Shared/DashboardSkeleton";

export default function AdminRegularOrders() {
  const navigate = useNavigate();
  const { client, orders: baseOrders, logout, isDataLoaded, isViewer } = useHostelAuth();
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

  const {
    handleAddOrder,
    handleDeleteData,
    handleEditOrder,
    loading,
  } = useAdminDashboardData({
    activeTab: "regular",
    baseOrders,
    dateFrom: null,
    dateTo: null,
  });

  const handleSidebarTabChange = useCallback((tab) => {
    setIsMobileMenuOpen(false);
    if (tab === "regular") return;
    if (tab === "investors") { navigate("/admin/investors"); return; }
    if (tab === "expenses") { navigate("/admin/expenses"); return; }
    if (tab === "calculator") { navigate("/admin/calculator"); return; }
    if (tab === "dailyReport") { navigate("/admin/daily-report"); return; }
    if (tab === "metaleads") { navigate("/admin/meta-leads"); return; }
    navigate("/admin", { state: { initialTab: tab } });
  }, [navigate]);

  if (loading) return <LoadingSpinner fullscreen />;

  return (
    <div className="flex min-h-screen bg-[#F1F5F9]" style={{ fontFamily: "DM Sans, sans-serif" }}>
      <AdminSidebar
        activeTab="regular"
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
        {/* Clean page-level top bar — no global date picker, no expenses/calculator shortcuts */}
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
                  <FiInbox size={20} className="text-blue-500" />
                  Regular B2C Orders
                </h1>
              </div>
            </div>
          </div>
        </header>

        <div className="p-4 lg:p-8">
          {!isDataLoaded ? (
            <DashboardSkeleton />
          ) : (
            <AdminRegularTab
              orders={baseOrders}
              baseOrders={baseOrders}
              onAddOrder={!isViewer ? handleAddOrder : undefined}
              onEditOrder={!isViewer ? handleEditOrder : undefined}
              onDeleteOrder={!isViewer ? handleDeleteData : undefined}
            />
          )}
        </div>
      </main>
    </div>
  );
}
