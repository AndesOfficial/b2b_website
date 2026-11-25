import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiMenu, FiBriefcase } from "react-icons/fi";
import AdminSidebar from "../components/Layout/AdminSidebar";
import AdminPageHeader from "../components/Layout/AdminPageHeader";
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
    if (tab === "wallets") { navigate("/admin/wallets"); return; }
    if (tab === "dataExport") { navigate("/admin/data-export"); return; }
    if (tab === "metaleads") { navigate("/admin/meta-leads"); return; }
    navigate("/admin", { state: { initialTab: tab } });
  }, [navigate]);

  return (
    <div className="flex min-h-screen bg-white" style={{ fontFamily: "DM Sans, sans-serif" }}>
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
        <AdminPageHeader
          title="B2B Orders"
          subtitle="Track institutional batches from pickup to delivery."
          onMenuClick={() => setIsMobileMenuOpen(true)}
        />

        <div className="px-4 pb-10 pt-6 lg:px-10">
          <SectionErrorBoundary section="b2b-orders" title="B2B Orders & Batches could not be displayed">
            <AdminB2BTab />
          </SectionErrorBoundary>
        </div>
      </main>
    </div>
  );
}
