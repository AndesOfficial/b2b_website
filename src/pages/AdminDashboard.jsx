import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useHostelAuth } from "../context/HostelAuthContext";
import AdminSidebar from "../components/AdminSidebar";
import AdminTopBar from "../components/AdminTopBar";
import LoadingSpinner from "../components/LoadingSpinner";
import AdminOverviewTab from "../components/AdminOverviewTab";
import AdminHostelsTab from "../components/AdminHostelsTab";
import AdminHotelsTab from "../components/AdminHotelsTab";
import AdminRegularTab from "../components/AdminRegularTab";
import AdminIssuesTab from "../components/AdminIssuesTab";
import AdminExpensesTab from "../components/AdminExpensesTab";
import AdminAnalyticsTab from "../components/AdminAnalyticsTab";
import InvoiceGeneratorModal from "../components/InvoiceGeneratorModal";
import AdminAddOrderModal from "../components/AdminAddOrderModal";
import AdminPageActions from "../components/AdminPageActions";
import AdminDashboardKpis from "../components/AdminDashboardKpis";
import DashboardSkeleton from "../components/DashboardSkeleton";
import { getAdminTabConfig } from "../config/adminTabs";
import { getMonthStartString, getTodayString, useAdminDashboardData } from "../hooks/useAdminDashboardData";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { client, orders: baseOrders, logout, isDataLoaded } = useHostelAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showAddOrder, setShowAddOrder] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [dateFrom, setDateFrom] = useState(() => getMonthStartString());
  const [dateTo, setDateTo] = useState(() => getTodayString());
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

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
    daysInRange,
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
    if (tab === "investors") {
      setIsMobileMenuOpen(false);
      navigate("/admin/investors");
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
        <AdminOverviewTab
          orders={orders}
          daysInRange={daysInRange}
          onDeleteData={handleDeleteData}
        />
      ),
      hostels: <AdminHostelsTab orders={orders} daysInRange={daysInRange} />,
      hotels: <AdminHotelsTab orders={orders} />,
      regular: (
        <AdminRegularTab
          orders={orders}
          onAddOrder={handleAddOrder}
          onEditOrder={handleEditOrder}
          onDeleteOrder={handleDeleteData}
        />
      ),
      issues: (
        <AdminIssuesTab
          orders={orders}
          onAddIssue={handleAddIssue}
          onEditIssue={handleEditIssue}
          onDeleteIssue={handleDeleteData}
        />
      ),
      expenses: <AdminExpensesTab />,
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
    daysInRange,
    handleAddIssue,
    handleAddOrder,
    handleDeleteData,
    handleEditIssue,
    handleEditOrder,
    orders,
    screenStats,
    searchStats,
    totalUsers,
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
          onExpensesClick={() => handleTabChange(activeTab === "expenses" ? "overview" : "expenses")}
          isExpensesActive={activeTab === "expenses"}
          orders={orders}
          onMenuClick={() => setIsMobileMenuOpen(true)}
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
              {activeTabConfig.showHeaderActions && (
                <AdminPageActions
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

              <div className="animate-fade-in">{activeTabPanel}</div>
            </>
          )}
        </div>
      </main>

      <InvoiceGeneratorModal
        isOpen={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        orders={orders}
      />

      <AdminAddOrderModal
        isOpen={showAddOrder}
        onClose={() => setShowAddOrder(false)}
        onSuccess={({ loggedType, orderDate, propertyName }) => {
          const isVisibleInCurrentFilter = isCurrentFilterShowingDate(orderDate);
          setSaveMessage(
            isVisibleInCurrentFilter
              ? `Order saved for ${propertyName} on ${orderDate}.`
              : `Order saved for ${propertyName} on ${orderDate}. It may be hidden by the current date filter.`
          );

          if (loggedType === "hostel") {
            handleTabChange("hostels");
          } else if (loggedType === "hotel") {
            handleTabChange("hotels");
          }
        }}
      />

    </div>
  );
}
