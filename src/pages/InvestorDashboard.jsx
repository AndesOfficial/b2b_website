import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiDownload, FiMenu } from "react-icons/fi";
import AdminSidebar from "../components/Layout/AdminSidebar";
import AdminPageHeader from "../components/Layout/AdminPageHeader";
import InvestorMetrics from "../components/InvestorMetrics";
import { useHostelAuth } from "../context/HostelAuthContext";

export default function InvestorDashboard() {
  const navigate = useNavigate();
  const { client, logout } = useHostelAuth();
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
    if (tab === "investors") return;
    if (tab === "b2b") { navigate("/admin/b2b-orders"); return; }
    if (tab === "expenses") { navigate("/admin/expenses"); return; }
    if (tab === "salaries") { navigate("/admin/salaries"); return; }
    if (tab === "regular") { navigate("/admin/regular-orders"); return; }
    if (tab === "calculator") { navigate("/admin/calculator"); return; }
    if (tab === "dailyReport") { navigate("/admin/daily-report"); return; }
    if (tab === "services") { navigate("/admin/services"); return; }
    if (tab === "wallets") { navigate("/admin/wallets"); return; }
    if (tab === "dataExport") { navigate("/admin/data-export"); return; }
    if (tab === "metaleads") { navigate("/admin/meta-leads"); return; }
    navigate("/admin", { state: { initialTab: tab } });
  }, [navigate]);

  return (
    <div className="flex min-h-screen bg-[#f3f6f2]" style={{ fontFamily: "DM Sans, sans-serif" }}>
      <AdminSidebar
        activeTab="investors"
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
          isSidebarCollapsed ? "lg:ml-[80px]" : "lg:ml-[218px]"
        } ml-0`}
      >
        <AdminPageHeader
          title="Investor Relations"
          subtitle="Quarterly financial performance."
          onMenuClick={() => setIsMobileMenuOpen(true)}
          actions={(
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-lg border border-[#dfe8e2] bg-white px-3 py-1.5 text-xs font-semibold text-[#172c28] hover:bg-[#d9f1e3]"
            >
              <FiDownload size={14} /> Export report
            </button>
          )}
        />

        <div className="px-4 pb-10 pt-6 lg:px-10">
          <InvestorMetrics />
        </div>
      </main>
    </div>
  );
}
