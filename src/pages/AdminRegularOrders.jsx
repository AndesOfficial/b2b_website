import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiMenu, FiInbox } from "react-icons/fi";
import AdminSidebar from "../components/Layout/AdminSidebar";
import AdminPageHeader from "../components/Layout/AdminPageHeader";
import AdminRegularTab from "../components/AdminRegularTab";
import { useHostelOrders } from "../context/HostelAuthContext";
import { useAdminDashboardData } from "../hooks/useAdminDashboardData";
import LoadingSpinner from "../components/Shared/LoadingSpinner";
import DashboardSkeleton from "../components/Shared/DashboardSkeleton";

import SectionErrorBoundary from "../components/Shared/SectionErrorBoundary";

export default function AdminRegularOrders() {
  const navigate = useNavigate();
  const { client, orders: baseOrders, logout, isDataLoaded, isViewer } = useHostelOrders();
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
    registeredUserIds,
  } = useAdminDashboardData({
    activeTab: "regular",
    baseOrders,
    dateFrom: null,
    dateTo: null,
  });

  const handleSidebarTabChange = useCallback((tab) => {
    setIsMobileMenuOpen(false);
    if (tab === "regular") return;
    if (tab === "b2b") { navigate("/admin/b2b-orders"); return; }
    if (tab === "investors") { navigate("/admin/investors"); return; }
    if (tab === "expenses") { navigate("/admin/expenses"); return; }
    if (tab === "salaries") { navigate("/admin/salaries"); return; }
    if (tab === "calculator") { navigate("/admin/calculator"); return; }
    if (tab === "dailyReport") { navigate("/admin/daily-report"); return; }
    if (tab === "services") { navigate("/admin/services"); return; }
    if (tab === "wallets") { navigate("/admin/wallets"); return; }
    if (tab === "dataExport") { navigate("/admin/data-export"); return; }
    if (tab === "metaleads") { navigate("/admin/meta-leads"); return; }
    if (tab === "coupons") { navigate("/admin/coupons"); return; }
    navigate("/admin", { state: { initialTab: tab } });
  }, [navigate]);

  if (loading) return <LoadingSpinner fullscreen />;

  return (
    <div className="flex min-h-screen bg-white" style={{ fontFamily: "DM Sans, sans-serif" }}>
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
        <AdminPageHeader
          title="B2C Orders"
          subtitle="Track consumer orders and delivery exceptions."
          onMenuClick={() => setIsMobileMenuOpen(true)}
        />

        <div className="px-4 pb-10 pt-6 lg:px-10">
          {!isDataLoaded ? (
            <DashboardSkeleton />
          ) : (
            <SectionErrorBoundary section="regular-orders" title="B2C Orders could not be displayed">
              <AdminRegularTab
                orders={baseOrders}
                baseOrders={baseOrders}
                registeredUserIds={registeredUserIds}
                onAddOrder={!isViewer ? handleAddOrder : undefined}
                onEditOrder={!isViewer ? handleEditOrder : undefined}
                onDeleteOrder={!isViewer ? handleDeleteData : undefined}
              />
            </SectionErrorBoundary>
          )}
        </div>
      </main>
    </div>
  );
}
