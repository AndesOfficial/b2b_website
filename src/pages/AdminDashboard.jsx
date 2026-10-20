import { Component, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useHostelOrders } from "../context/HostelAuthContext";
import AdminSidebar from "../components/Layout/AdminSidebar";
import AdminTopBar from "../components/Layout/AdminTopBar";
import LoadingSpinner from "../components/Shared/LoadingSpinner";
import OpsRevenueDashboard from "../components/Overview/OpsRevenueDashboard";
import CustomerAcquisitionDashboard from "../components/Overview/CustomerAcquisitionDashboard";
import AdminIssuesTab from "../components/Issues/AdminIssuesTab";
import AdminExpensesTab from "../components/Expenses/AdminExpensesTab";
import AdminAnalyticsTab from "../components/AdminAnalyticsTab";
import InvoiceGeneratorModal from "../components/Shared/InvoiceGeneratorModal";
import AdminAddOrderModal from "../components/Shared/AdminAddOrderModal";
import AdminPageActions from "../components/Shared/AdminPageActions";
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

  useEffect(() => {
    if (location.state?.initialTab) {
      setActiveTab(location.state.initialTab);
    }
  }, [location.state?.initialTab]);

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

    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  }, [navigate]);

  useEffect(() => {
    if (!saveMessage) return undefined;
    const timeoutId = window.setTimeout(() => setSaveMessage(null), 4500);
    return () => window.clearTimeout(timeoutId);
  }, [saveMessage]);

  // A single registry keeps tab rendering in one place instead of scattering conditionals.
  const activeTabPanel = useMemo(() => {
    const panels = {
      overview: (
        <div className="space-y-4">
          {/* Subtle switcher between Acquisition Dashboard and Operations Ledger */}
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
            <div className="inline-flex items-center gap-1 bg-slate-200/70 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setOverviewSubView("acquisition")}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  overviewSubView === "acquisition"
                    ? "bg-white text-blue-600 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Customer Acquisition & Orders
              </button>
              <button
                type="button"
                onClick={() => setOverviewSubView("ops")}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  overviewSubView === "ops"
                    ? "bg-white text-blue-600 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Operations & Revenue Breakdown
              </button>
            </div>
          </div>

          {overviewSubView === "acquisition" ? (
            <CustomerAcquisitionDashboard orders={baseOrders} />
          ) : (
            <OpsRevenueDashboard orders={baseOrders} />
          )}
        </div>
      ),
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
      analytics: (
        <AdminAnalyticsTab
          orders={orders}
          screens={screenStats}
          searches={searchStats}
          totalUsers={totalUsers}
        />
      ),
    };

    return panels[activeTab] || null;
  }, [
    activeTab,
    baseOrders,
    handleAddIssue,
    handleDeleteData,
    handleEditIssue,
    orders,
    overviewSubView,
    screenStats,
    searchStats,
    totalUsers,
    isViewer
  ]);

  if (loading) return <LoadingSpinner fullscreen />;

  return (

    <div className="flex min-h-screen bg-[#F1F5F9]" style={{ fontFamily: "DM Sans, sans-serif" }}>
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
        <AdminTopBar
          title={activeTabConfig.title}
          dateFrom={dateFrom}
          setDateFrom={setDateFrom}
          dateTo={dateTo}
          setDateTo={setDateTo}
          onExpensesClick={() => navigate("/admin/expenses")}
          onCalculatorClick={() => navigate("/admin/calculator")}
          orders={orders}
          onMenuClick={() => setIsMobileMenuOpen(true)}
          hideDateFilter={activeTab === "overview"}
        />

        <div className="p-4 lg:p-8">
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
