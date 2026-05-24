import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiMenu, FiArrowLeft } from "react-icons/fi";
import AdminSidebar from "../components/AdminSidebar";
import { useHostelAuth } from "../context/HostelAuthContext";

export default function Calculator() {
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
    if (tab === "investors") {
      navigate("/admin/investors");
    } else {
      navigate("/admin");
    }
  }, [navigate]);

  return (
    <div className="flex min-h-screen bg-[#F1F5F9]" style={{ fontFamily: "DM Sans, sans-serif" }}>
      <AdminSidebar
        activeTab="calculator"
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
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-[#F1F5F9]/95 backdrop-blur">
          <div className="flex items-center justify-between gap-4 px-4 py-4 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(true)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden"
                aria-label="Open sidebar"
              >
                <FiMenu size={20} />
              </button>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Admin Portal</p>
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-950">Calculator</h1>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate("/admin")}
              className="inline-flex items-center gap-2 rounded-2xl bg-white border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <FiArrowLeft size={16} />
              Back to Dashboard
            </button>
          </div>
        </header>

        <div className="flex-1 p-4 lg:p-8">
          {/* Main content is left blank for now */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-8 shadow-sm min-h-[400px] flex items-center justify-center text-slate-400">
            Calculator functionality coming soon...
          </div>
        </div>
      </main>
    </div>
  );
}
