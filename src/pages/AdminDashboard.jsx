import { Component, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useHostelOrders } from "../context/HostelAuthContext";
import AdminSidebar from "../components/Layout/AdminSidebar";
import AdminPageHeader from "../components/Layout/AdminPageHeader";
import BusinessOverview from "../components/Overview/BusinessOverview";
import AdvancedKpis, { useKpiMonths } from "../components/Overview/AdvancedKpis";
import LoadingSpinner from "../components/Shared/LoadingSpinner";
import OpsRevenueDashboard from "../components/Overview/OpsRevenueDashboard";
import CustomerAcquisitionDashboard from "../components/Overview/CustomerAcquisitionDashboard";
import AdminIssuesTab from "../components/Issues/AdminIssuesTab";
import AdminExpensesTab from "../components/Expenses/AdminExpensesTab";
import InvoiceGeneratorModal from "../components/Shared/InvoiceGeneratorModal";
import AdminAddOrderModal from "../components/Shared/AdminAddOrderModal";
import AdminPageActions from "../components/Shared/AdminPageActions";
import OrderAcceptanceToggle from "../components/Shared/OrderAcceptanceToggle";
import { FiFileText } from "react-icons/fi";
import AdminDashboardKpis from "../components/Overview/AdminDashboardKpis";
import DashboardSkeleton from "../components/Shared/DashboardSkeleton";
import { getAdminTabConfig } from "../config/adminTabs";
import { getMonthStartString, getTodayString, useAdminDashboardData } from "../hooks/useAdminDashboardData";

// Keeps one broken tab from taking down the whole dashboard, and shows the error.
class TabErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error(`Admin tab "${this.props.tab}" failed to render:`, error, errorInfo);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.tab !== this.props.tab && this.state.error) this.setState({ error: null });
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-bold">This section failed to load.</p>
          <pre className="mt-2 whitespace-pre-wrap text-xs">{String(this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const longDate = () => new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const PAGE_HEADINGS = {
  overview: { title: "Business overview", subtitle: () => `${longDate()} · Today so far` },
  analytics: { title: "Analytics", subtitle: () => `Detailed reports · ${longDate()}` },
  kpis: {
    title: "Advanced KPIs",
    subtitle: ({ kpiMonths }) => `${MONTH_NAME(kpiMonths.lastMonth)} compared with ${MONTH_NAME(kpiMonths.before)} · Monthly review`,
  },
  issues: { title: "Issues", subtitle: "Resolve the highest-priority open issues first." },
};
const MONTH_NAME = (d) => d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

export default function AdminDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { client, orders: baseOrders, logout, isDataLoaded, isViewer } = useHostelOrders();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showAddOrder, setShowAddOrder] = useState(false);
  const [activeTab, setActiveTab] = useState(() => location.state?.initialTab || "overview");
  const [dateFrom, setDateFrom] = useState(() => getMonthStartString());
  const [dateTo, setDateTo] = useState(() => getTodayString());
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [overviewSubView, setOverviewSubView] = useState("acquisition");
  const kpiMonths = useKpiMonths();

  useEffect(() => {
    if (location.state?.initialTab) {
      if (location.state.initialTab === "coupons") {
        navigate("/admin/coupons", { replace: true });
        return;
      }
      if (location.state.initialTab === "dataExport") {
        navigate("/admin/data-export", { replace: true });
        return;
      }
      if (location.state.initialTab === "wallets") {
        navigate("/admin/wallets", { replace: true });
        return;
      }
      setActiveTab(location.state.initialTab);
    }
  }, [location.state?.initialTab, navigate]);

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
    handleAddIssue,
    handleAddOrder,
    handleDeleteData,
    handleEditIssue,
    handleEditOrder,
    loading,
    orders,
    screenStats,
    searchStats,
    stats,
    totalUsers,
  } = useAdminDashboardData({
    activeTab,
    baseOrders,
    dateFrom,
    dateTo,
  });

  const activeTabConfig = getAdminTabConfig(activeTab);
  const isCurrentFilterShowingDate = useCallback((targetDate) => {
    if (!targetDate) return true;
    if (dateFrom && targetDate < dateFrom) return false;
    if (dateTo && targetDate > dateTo) return false;
    return true;
  }, [dateFrom, dateTo]);

  const handleTabChange = useCallback((tab) => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (tab === "b2b") {
      setIsMobileMenuOpen(false);
      navigate("/admin/b2b-orders");
      return;
    }
    if (tab === "regular") {
      setIsMobileMenuOpen(false);
      navigate("/admin/regular-orders");
      return;
    }
    if (tab === "investors") {
      setIsMobileMenuOpen(false);
      navigate("/admin/investors");
      return;
    }
    if (tab === "expenses") {
      setIsMobileMenuOpen(false);
      navigate("/admin/expenses");
      return;
    }
    if (tab === "salaries") {
      setIsMobileMenuOpen(false);
      navigate("/admin/salaries");
      return;
    }
    if (tab === "calculator") {
      setIsMobileMenuOpen(false);
      navigate("/admin/calculator");
      return;
    }
    if (tab === "metaleads") {
      setIsMobileMenuOpen(false);
      navigate("/admin/meta-leads");
      return;
    }
    if (tab === "dailyReport") {
      setIsMobileMenuOpen(false);
      navigate("/admin/daily-report");
      return;
    }
    if (tab === "services") {
      setIsMobileMenuOpen(false);
      navigate("/admin/services");
      return;
    }
    if (tab === "coupons") {
      setIsMobileMenuOpen(false);
      navigate("/admin/coupons");
      return;
    }
    if (tab === "dataExport") {
      setIsMobileMenuOpen(false);
      navigate("/admin/data-export");
      return;
    }
    if (tab === "wallets") {
      setIsMobileMenuOpen(false);
      navigate("/admin/wallets");
      return;
    }

    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  }, [navigate]);

  // From the Overview links: open a tab, optionally on one analytics report.
  const goTo = useCallback((tab, sub) => {
    if (sub) setOverviewSubView(sub);
    handleTabChange(tab);
  }, [handleTabChange]);

  useEffect(() => {
    if (!saveMessage) return undefined;
    const timeoutId = window.setTimeout(() => setSaveMessage(null), 4500);
    return () => window.clearTimeout(timeoutId);
  }, [saveMessage]);

  // A single registry keeps tab rendering in one place instead of scattering conditionals.
  const activeTabPanel = useMemo(() => {
    const panels = {
      overview: <BusinessOverview orders={baseOrders} onGo={goTo} />,
      analytics: (
        <div className="space-y-5 px-4 pb-10 pt-6 lg:px-10">
          <div className="flex gap-6 border-b border-[#e3eae8]">
            {[["acquisition", "Customer acquisition & orders"], ["ops", "Operations & revenue breakdown"]].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setOverviewSubView(key)}
                className={`-mb-px border-b-2 pb-3 text-[14px] font-semibold ${
                  overviewSubView === key ? "border-[#1b6b58] text-[#1b6b58]" : "border-transparent text-[#5f726f] hover:text-[#10262b]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {overviewSubView === "acquisition" ? (
            <CustomerAcquisitionDashboard orders={baseOrders} />
          ) : (
            <OpsRevenueDashboard orders={baseOrders} />
          )}
        </div>
      ),
      kpis: <AdvancedKpis orders={baseOrders} />,
      regular: null, // Handled by dedicated /admin/regular-orders route
      issues: (
        <AdminIssuesTab
          orders={baseOrders}
          onAddIssue={!isViewer ? handleAddIssue : undefined}
          onEditIssue={!isViewer ? handleEditIssue : undefined}
          onDeleteIssue={!isViewer ? handleDeleteData : undefined}
        />
      ),
      expenses: null, // Handled by dedicated /admin/expenses route
    };

    return panels[activeTab] || null;
  }, [
    activeTab,
    baseOrders,
    dateFrom,
    dateTo,
    handleAddIssue,
    handleDeleteData,
    handleEditIssue,
    goTo,
    overviewSubView,
    isViewer
  ]);

  if (loading) return <LoadingSpinner fullscreen />;

  return (

    <div className="flex min-h-screen bg-white" style={{ fontFamily: "DM Sans, sans-serif" }}>
      <AdminSidebar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        issuesCount={stats.openIssuesCount}
        user={client}
        onLogout={logout}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        isMobileOpen={isMobileMenuOpen}
        setIsMobileOpen={setIsMobileMenuOpen}
      />

      <main className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${isSidebarCollapsed ? "lg:ml-[80px]" : "lg:ml-[220px]"} ml-0`}>
        <AdminPageHeader
          title={PAGE_HEADINGS[activeTab]?.title || activeTabConfig.title}
          subtitle={typeof PAGE_HEADINGS[activeTab]?.subtitle === "function" ? PAGE_HEADINGS[activeTab].subtitle({ kpiMonths }) : PAGE_HEADINGS[activeTab]?.subtitle}
          onMenuClick={() => setIsMobileMenuOpen(true)}
          actions={activeTab === "overview" && !isViewer ? (
            <>
              <OrderAcceptanceToggle />
              <button
                type="button"
                onClick={() => setShowInvoiceModal(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-[#d5e0dd] bg-white px-3 py-1.5 text-xs font-semibold text-[#153a3f] hover:bg-[#f2f7f6]"
              >
                <FiFileText size={14} /> Generate invoice
              </button>
            </>
          ) : null}
        />

        <div className={activeTab === "issues" ? "px-4 pb-10 pt-6 lg:px-10" : ""}>
          {saveMessage && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 shadow-sm">
              {saveMessage}
            </div>
          )}

          {/* Show Skeleton Loader while Firebase initial sync is happening */}
          {!isDataLoaded ? (
            <DashboardSkeleton />
          ) : (
            <>
              {activeTabConfig.showHeaderActions && !isViewer && (
                <AdminPageActions
                  activeTab={activeTab}
                  onGenerateInvoice={() => setShowInvoiceModal(true)}
                  onLogOrder={() => setShowAddOrder(true)}
                />
              )}

              {activeTabConfig.showKpis && (
                <AdminDashboardKpis
                  activeTab={activeTab}
                  columnsClass={activeTabConfig.kpiColumnsClass}
                  onTabChange={handleTabChange}
                  stats={stats}
                />
              )}

              <div className="animate-fade-in"><TabErrorBoundary tab={activeTab}>{activeTabPanel}</TabErrorBoundary></div>
            </>
          )}
        </div>
      </main>

      <InvoiceGeneratorModal
        isOpen={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        orders={baseOrders}
      />

      <AdminAddOrderModal
        isOpen={showAddOrder}
        onClose={() => setShowAddOrder(false)}
        onSuccess={({ orderDate, propertyName }) => {
          const isVisibleInCurrentFilter = isCurrentFilterShowingDate(orderDate);
          setSaveMessage(
            isVisibleInCurrentFilter
              ? `Order saved for ${propertyName} on ${orderDate}.`
              : `Order saved for ${propertyName} on ${orderDate}. It may be hidden by the current date filter.`
          );
        }}
      />

    </div>
  );
}
