import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMenu, FiFileText, FiChevronLeft, FiChevronRight, FiCalendar } from 'react-icons/fi';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import AdminSidebar from '../components/Layout/AdminSidebar';
import { useHostelAuth } from '../context/HostelAuthContext';
import LoadingSpinner from '../components/Shared/LoadingSpinner';
import DashboardSkeleton from '../components/Shared/DashboardSkeleton';
import DailyOpsReportView from '../components/DailyReport/DailyOpsReportView';
import { useDailyOpsReport } from '../hooks/useDailyOpsReport';
import { getTodayString } from '../utils/dateUtils';

export default function AdminDailyReport() {
  const navigate = useNavigate();
  const { client, orders: baseOrders, logout, isDataLoaded, isViewer } = useHostelAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => getTodayString());
  const [complaints, setComplaints] = useState([]);
  const [complaintsLoaded, setComplaintsLoaded] = useState(false);

  // Fetch normal_complaint collection
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'normal_complaint'),
      (snapshot) => {
        setComplaints(
          snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          }))
        );
        setComplaintsLoaded(true);
      },
      (error) => {
        console.error('normal_complaint sync error:', error.message);
        setComplaintsLoaded(true);
      }
    );
    return () => unsub();
  }, []);

  // Responsive sidebar
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 1024;
      setIsSidebarCollapsed(isMobile);
      if (!isMobile) setIsMobileMenuOpen(false);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const report = useDailyOpsReport(baseOrders, complaints, selectedDate);

  const handleSidebarTabChange = useCallback((tab) => {
    setIsMobileMenuOpen(false);
    if (tab === 'dailyReport') return;
    if (tab === 'regular') { navigate('/admin/regular-orders'); return; }
    if (tab === 'investors') { navigate('/admin/investors'); return; }
    if (tab === 'expenses') { navigate('/admin/expenses'); return; }
    if (tab === 'calculator') { navigate('/admin/calculator'); return; }
    if (tab === 'metaleads') { navigate('/admin/meta-leads'); return; }
    navigate('/admin');
  }, [navigate]);

  const goToPreviousDay = () => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    setSelectedDate(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    );
  };

  const goToNextDay = () => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (d <= today) {
      setSelectedDate(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      );
    }
  };

  const goToToday = () => setSelectedDate(getTodayString());

  const isToday = selectedDate === getTodayString();

  const loading = !isDataLoaded || !complaintsLoaded;

  if (loading) return <LoadingSpinner fullscreen />;

  return (
    <div className="flex min-h-screen bg-[#F1F5F9]" style={{ fontFamily: 'DM Sans, sans-serif' }}>
      <AdminSidebar
        activeTab="dailyReport"
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
          isSidebarCollapsed ? 'lg:ml-[80px]' : 'lg:ml-[220px]'
        } ml-0`}
      >
        {/* Header */}
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
                  <FiFileText size={20} className="text-blue-500" />
                  Daily Operations Report
                </h1>
              </div>
            </div>

            {/* Date Navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={goToPreviousDay}
                className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm"
                title="Previous day"
              >
                <FiChevronLeft size={18} />
              </button>

              <div className="relative">
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm">
                  <FiCalendar size={16} className="text-blue-500" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    max={getTodayString()}
                    className="bg-transparent text-[14px] font-bold text-slate-800 outline-none cursor-pointer"
                  />
                </div>
              </div>

              <button
                onClick={goToNextDay}
                disabled={isToday}
                className={`p-2.5 rounded-xl border border-slate-200 bg-white shadow-sm transition-all ${
                  isToday
                    ? 'text-slate-300 cursor-not-allowed'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
                title="Next day"
              >
                <FiChevronRight size={18} />
              </button>

              {!isToday && (
                <button
                  onClick={goToToday}
                  className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-[13px] font-bold shadow-md hover:bg-blue-700 transition-all"
                >
                  Today
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Report Content */}
        <div className="p-4 lg:p-8">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KpiCard
              label="B2C Orders"
              value={report.totalB2COrders}
              sublabel="received today"
              color="blue"
            />
            <KpiCard
              label="B2C Delivered"
              value={report.b2cSummary.totalOrdersDelivered}
              sublabel="deliveries"
              color="emerald"
            />
            <KpiCard
              label="B2B Orders"
              value={report.totalB2BOrders}
              sublabel="hostel orders"
              color="violet"
            />
            <KpiCard
              label="Total Revenue"
              value={`₹${Number(report.combinedRevenue || 0).toLocaleString('en-IN')}`}
              sublabel="combined"
              color="amber"
            />
          </div>

          <DailyOpsReportView report={report} selectedDate={selectedDate} />
        </div>
      </main>
    </div>
  );
}

function KpiCard({ label, value, sublabel, color }) {
  const colorMap = {
    blue: 'from-blue-500 to-blue-600 shadow-blue-500/20',
    emerald: 'from-emerald-500 to-emerald-600 shadow-emerald-500/20',
    violet: 'from-violet-500 to-violet-600 shadow-violet-500/20',
    amber: 'from-amber-500 to-amber-600 shadow-amber-500/20',
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-all">
      <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400 mb-1">{label}</p>
      <p className="text-2xl font-black text-slate-900 tracking-tight">{value}</p>
      <div className="flex items-center gap-2 mt-2">
        <div className={`h-1.5 w-8 rounded-full bg-gradient-to-r ${colorMap[color] || colorMap.blue}`} />
        <span className="text-[11px] font-semibold text-slate-400">{sublabel}</span>
      </div>
    </div>
  );
}
