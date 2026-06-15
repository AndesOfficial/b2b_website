import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import TopNav from "../components/Layout/TopNav";
import KpiCard from "../components/Shared/KpiCard";
import StatusBar from "../components/Shared/StatusBar";
import LoadingSpinner from "../components/Shared/LoadingSpinner";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { FiPackage, FiUsers, FiBarChart2, FiSearch, FiArrowRight } from "react-icons/fi";
import { BiRupee } from "react-icons/bi";

const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const AVATAR_COLORS = ['#1976D2', '#7C3AED', '#059669', '#DC2626', '#D97706'];

// 1. Timezone-Proof Date Extractor
export const parseOrderDate = (o) => {
    let year, month, day;

    if (o.date && typeof o.date === 'string') {
        const dateStr = o.date.split('T')[0];
        const parts = dateStr.split(/[-/]/);
        if (parts.length === 3) {
            if (parts[0].length === 4) { // Format: YYYY-MM-DD
                year = parseInt(parts[0], 10); month = parseInt(parts[1], 10); day = parseInt(parts[2], 10);
            } else { // Format: DD-MM-YYYY
                day = parseInt(parts[0], 10); month = parseInt(parts[1], 10); year = parseInt(parts[2], 10);
            }
        }
    }

    if (!year && o.timestamp) {
        const d = new Date(o.timestamp.seconds ? o.timestamp.seconds * 1000 : o.timestamp);
        year = d.getFullYear(); month = d.getMonth() + 1; day = d.getDate();
    }

    if (!year && o.month && o.day) {
        month = parseInt(o.month, 10); day = parseInt(o.day, 10);
        year = o.year ? parseInt(o.year, 10) : new Date().getFullYear();
    }

    if (isNaN(year) || !year) year = new Date().getFullYear();
    if (isNaN(month) || !month) month = new Date().getMonth() + 1;
    if (isNaN(day) || !day) day = 1;

    return { year, month, day, monthKey: `${year}-${String(month).padStart(2, '0')}` };
};

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white border-l-4 border-[#1976D2] shadow-lg rounded-xl p-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
                <p className="text-[#1976D2] font-semibold text-xs mb-1">{label}</p>
                <p className="text-gray-800 font-bold text-sm">{payload[0].value} orders</p>
            </div>
        );
    }
    return null;
};

export default function Dashboard() {
    const { partner, orders, loading } = useAuth();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState("");

    const stats = useMemo(() => {
        // 2. Strict Deduplication Map (Kills the double revenue bug)
        const uniqueMap = new Map();
        orders.forEach(o => {
            const fingerprint = o.id || `${o.date}-${o.amount}-${o.customerName}-${o.tenant}`;
            uniqueMap.set(fingerprint, { ...o, ...parseOrderDate(o) });
        });
        const validOrders = Array.from(uniqueMap.values());

        const totalOrders = validOrders.length;
        const totalRevenue = validOrders.reduce((s, o) => s + (parseFloat(o.amount) || 0), 0);
        const tenants = [...new Set(validOrders.map(o => o.tenant))].filter(Boolean);
        const delivered = validOrders.filter(o => o.status === 'Delivered').length;
        const confirmed = validOrders.filter(o => o.status === 'Confirmed').length;
        const pending = validOrders.filter(o => o.status === 'Pending').length;

        const now = new Date();
        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

        const currOrdersData = validOrders.filter(o => o.monthKey === currentMonthKey);
        const prevOrdersData = validOrders.filter(o => o.monthKey === prevMonthKey);

        const diffOrders = currOrdersData.length - prevOrdersData.length;
        const ordersTrend = diffOrders > 0 ? { direction: 'up', text: `↑ +${diffOrders} this month` } : diffOrders < 0 ? { direction: 'down', text: `↓ ${diffOrders} this month` } : { direction: 'same', text: `— No change` };

        const currRev = currOrdersData.reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0);
        const prevRev = prevOrdersData.reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0);
        const diffRev = currRev - prevRev;
        const revTrend = diffRev > 0 ? { direction: 'up', text: `↑ +₹${diffRev.toLocaleString()} this month` } : diffRev < 0 ? { direction: 'down', text: `↓ -₹${Math.abs(diffRev).toLocaleString()} this month` } : { direction: 'same', text: `— No change` };

        const currTenants = new Set(currOrdersData.map(o => o.tenant).filter(Boolean)).size;
        const prevTenants = new Set(prevOrdersData.map(o => o.tenant).filter(Boolean)).size;
        const diffTenants = currTenants - prevTenants;
        const tenantsTrend = diffTenants > 0 ? { direction: 'up', text: `↑ +${diffTenants} this month` } : diffTenants < 0 ? { direction: 'down', text: `↓ ${diffTenants} this month` } : { direction: 'same', text: `— No change` };

        // 3. Flawless Chart Grouping by YYYY-MM
        const monthMap = {};
        validOrders.forEach(o => {
            if (!monthMap[o.monthKey]) {
                monthMap[o.monthKey] = {
                    key: o.monthKey,
                    label: `${MONTH_NAMES[o.month]} '${String(o.year).slice(2)}`,
                    orders: 0,
                    sortVal: o.year * 100 + o.month
                };
            }
            monthMap[o.monthKey].orders++;
        });

        const chartData = Object.values(monthMap).sort((a, b) => a.sortVal - b.sortVal).map(item => ({ month: item.label, orders: item.orders }));
        let dateRangeText = chartData.length > 0 ? `Showing data from ${chartData[0].month} to ${chartData[chartData.length - 1].month}` : "";

        const tenantMap = {};
        validOrders.forEach(o => {
            if (!o.tenant) return;
            if (!tenantMap[o.tenant]) tenantMap[o.tenant] = { count: 0, revenue: 0, lastOrder: null };
            tenantMap[o.tenant].count++;
            tenantMap[o.tenant].revenue += parseFloat(o.amount) || 0;
            const oDate = new Date(o.year, o.month - 1, o.day);
            if (!tenantMap[o.tenant].lastOrder || oDate > tenantMap[o.tenant].lastOrder) {
                tenantMap[o.tenant].lastOrder = oDate;
            }
        });

        const tenantRows = Object.entries(tenantMap).sort((a, b) => b[1].count - a[1].count).map(([name, data], i) => ({ rank: i + 1, name, ...data }));

        return { totalOrders, totalRevenue, tenants, delivered, confirmed, pending, chartData, dateRangeText, tenantRows, ordersTrend, revTrend, tenantsTrend };
    }, [orders]);

    const filteredTenants = stats.tenantRows.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()));
    const todayDateStr = new Intl.DateTimeFormat('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

    if (loading) return <LoadingSpinner fullscreen />;

    return (
        <div className="min-h-screen bg-[#F0F7FF]" style={{ fontFamily: 'Poppins, sans-serif' }}>
            <TopNav />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Greeting Banner */}
                <div className="bg-gradient-to-r from-[#1976D2] to-[#1565C0] rounded-2xl p-6 mb-8 text-white shadow-lg relative overflow-hidden">
                    <div className="absolute right-0 top-0 w-64 h-full pointer-events-none">
                        <div className="absolute right-[-20%] top-[-40%] w-64 h-64 bg-white opacity-10 rounded-full" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-white/80 text-sm font-medium mb-1">Good day,</p>
                        <h1 className="text-2xl font-bold mb-1">{partner?.name}</h1>
                        <p className="text-blue-100 text-sm font-light">{todayDateStr}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                    <KpiCard icon={FiPackage} value={stats.totalOrders} label="Total Orders" onClick={() => navigate('/orders/months')} color="brand" trend={stats.ordersTrend} />
                    <KpiCard icon={BiRupee} value={`₹${stats.totalRevenue.toLocaleString()}`} label="Total Revenue" color="orange" trend={stats.revTrend} />
                    <KpiCard icon={FiUsers} value={stats.tenants.length} label="Active Tenants" onClick={() => document.getElementById('tenant-leaderboard').scrollIntoView({ behavior: 'smooth' })} color="green" trend={stats.tenantsTrend} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                        <h2 className="text-base font-bold text-gray-900 mb-1">Monthly Orders Overview</h2>
                        <p className="text-xs text-gray-400 mb-5">{stats.dateRangeText || "Orders trend across months"}</p>
                        {stats.chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={stats.chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f5" vertical={false} />
                                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af', fontFamily: 'Poppins' }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af', fontFamily: 'Poppins' }} axisLine={false} tickLine={false} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F0F7FF' }} />
                                    <Bar dataKey="orders" fill="#1976D2" radius={[4, 4, 0, 0]} maxBarSize={50} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-48 flex flex-col items-center justify-center text-gray-400 text-sm">
                                <FiBarChart2 size={32} className="text-gray-300 mb-2" />No orders yet
                            </div>
                        )}
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col">
                        <div>
                            <h2 className="text-base font-bold text-gray-900 mb-1">Order Status</h2>
                            <p className="text-xs text-gray-400 mb-6">Breakdown by status</p>
                            <div className="space-y-5">
                                {stats.delivered > 0 && <StatusBar label="Delivered" value={stats.delivered} total={stats.totalOrders} color="green" />}
                                {stats.confirmed > 0 && <StatusBar label="Confirmed" value={stats.confirmed} total={stats.totalOrders} color="brand" />}
                                {stats.pending > 0 && <StatusBar label="Pending" value={stats.pending} total={stats.totalOrders} color="orange" />}
                            </div>
                        </div>
                    </div>
                </div>

                <div id="tenant-leaderboard" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                        <div>
                            <h2 className="text-base font-bold text-gray-900">Tenant Leaderboard</h2>
                            <p className="text-xs text-gray-400 mt-0.5">Ranked by order volume</p>
                        </div>
                        <div className="relative">
                            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                            <input type="text" placeholder="Search tenants..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="border border-gray-200 rounded-lg pl-9 pr-3 py-2 w-full sm:w-64 text-sm focus:border-blue-400 focus:outline-none transition-all" />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[650px]">
                            <thead>
                                <tr className="bg-[#F0F7FF] border-y border-blue-50">
                                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 rounded-tl-xl w-12">#</th>
                                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Tenant</th>
                                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Last Order</th>
                                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Orders</th>
                                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Revenue</th>
                                    <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3 rounded-tr-xl">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTenants.length === 0 ? (
                                    <tr><td colSpan={6} className="text-center py-8 text-gray-400 text-sm">No tenants found</td></tr>
                                ) : filteredTenants.map((row, idx) => {
                                    const initial = row.name ? row.name.charAt(0).toUpperCase() : '?';
                                    const orderDateStr = row.lastOrder ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(row.lastOrder) : '—';

                                    return (
                                        <tr key={row.name} className="border-b border-gray-50 hover:bg-[#F0F7FF]/50 transition-colors">
                                            <td className="px-4 py-3 text-xs font-bold text-gray-400">{row.rank}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ backgroundColor: AVATAR_COLORS[idx % AVATAR_COLORS.length] }}>{initial}</div>
                                                    <span className="text-sm font-medium text-gray-800">{row.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-500 font-medium">{orderDateStr}</td>
                                            <td className="px-4 py-3 text-sm text-gray-600 font-semibold">{row.count}</td>
                                            <td className="px-4 py-3 text-sm font-medium text-gray-800">₹{row.revenue.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-right">
                                                <button onClick={() => navigate(`/tenants/${encodeURIComponent(row.name)}/months`)} className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#E3F2FD] text-[#1976D2] text-xs font-semibold border border-blue-100 hover:bg-blue-100 transition-all">
                                                    View <FiArrowRight size={12} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}