import React, { useMemo, useState } from "react";
import { FiMonitor, FiSearch, FiLayers, FiChevronDown, FiTrendingUp, FiUsers, FiShoppingBag, FiGlobe } from "react-icons/fi";
import { BiRupee } from "react-icons/bi";
import EmptyState from "./Shared/EmptyState";
import { getDaysInMonthForDate, isHostel99Property } from "../utils/orderNormalization";
import { HOSTEL_99_MONTHLY_REVENUE } from "../config/orderRateCard";

function matchServiceCategory(nameStr) {
    const service = String(nameStr || "").toLowerCase();
    if (service.includes("wash") && service.includes("fold") && service.includes("iron")) return "Wash & Iron";
    if (service.includes("wash") && service.includes("fold")) return "Wash & Fold";
    if (service.includes("wash") && service.includes("iron")) return "Wash & Iron";
    if (service.includes("iron") || service.includes("steam")) return "Iron Only";
    if (service.includes("dry")) return "Dry Cleaning";
    if (service.includes("bed") || service.includes("blanket") || service.includes("duvet") || service.includes("quilt")) return "Single Bedsheet/Blanket";
    if (service.includes("shoe") || service.includes("sneaker") || service.includes("sports") || service.includes("boot")) return "Sports Shoes Regular";
    if (service.includes("saree")) return "Saree Regular";
    if (service.includes("loafer")) return "Loafers/Sneakers";
    if (service.includes("kurta")) return "Kurta Pajama Regular";
    if (service.includes("trouser") || service.includes("jeans")) return "Trousers Regular";
    if (service.includes("shirt") || service.includes("pant")) return "Shirt & Pant";
    return "Other";
}

// Re-using the card style for the main stats
const StatCard = ({ label, value, icon, color, subValue }) => (
    <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all group">
        <div className="flex items-center justify-between mb-4">
            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center transition-colors ${
                color === 'indigo' ? 'bg-indigo-50 text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white' :
                color === 'emerald' ? 'bg-emerald-50 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white' :
                color === 'amber' ? 'bg-amber-50 text-amber-500 group-hover:bg-amber-500 group-hover:text-white' :
                'bg-gray-50 text-gray-500 group-hover:bg-gray-500 group-hover:text-white'
            }`}>
                {React.cloneElement(icon, { size: 20, className: 'sm:w-6 sm:h-6' })}
            </div>
            <p className="text-[10px] sm:text-[12px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md uppercase tracking-tight">Real-time</p>
        </div>
        <p className="text-[13px] sm:text-[14px] font-bold text-gray-500 mb-1">{label}</p>
        <p className="text-2xl sm:text-3xl font-black text-gray-900 mb-1">{value}</p>
        <p className="text-[11px] sm:text-[12px] font-bold text-gray-400">{subValue}</p>
    </div>
);

const ScreenItem = ({ name, visits }) => (
    <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-100/50 shadow-sm hover:shadow-md transition-all group">
        <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                <FiMonitor size={18} />
            </div>
            <div>
                <p className="text-[14px] font-bold text-gray-900">{name}</p>
                <p className="text-[12px] font-medium text-gray-400">{visits} visits</p>
            </div>
        </div>
        <FiChevronDown size={18} className="text-gray-300 group-hover:text-indigo-400 transition-colors" />
    </div>
);

const SearchItem = ({ query, count }) => (
    <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-100/50 shadow-sm hover:shadow-md transition-all group">
        <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-500 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                <FiSearch size={18} />
            </div>
            <div>
                <p className="text-[14px] font-bold text-gray-900">{query}</p>
                <p className="text-[12px] font-medium text-gray-400">{count} searches</p>
            </div>
        </div>
        <FiChevronDown size={18} className="text-gray-300 group-hover:text-purple-400 transition-colors" />
    </div>
);

const ServiceCard = ({ label, count }) => (
    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all">
        <p className="text-[14px] font-bold text-gray-900 mb-1">{label}</p>
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">Orders</p>
        <p className="text-3xl font-black text-gray-900 leading-none">{count}</p>
    </div>
);

export default function AdminAnalyticsTab({ orders = [], screens = [], searches = [], totalUsers = 0 }) {
    const [subTab, setSubTab] = useState("stats");

    // Filter to exclude issues and cancelled orders (consistent with Overview dashboard)
    const activeOrders = useMemo(() => (Array.isArray(orders) ? orders : []).filter(o =>
        o && o.category !== "ISSUES" && o.type !== "issue" && o.status !== "Cancelled"
    ), [orders]);

    // Calculate real data from orders for "Services Ordered" (inspecting breakdowns when present)
    const serviceStats = useMemo(() => {
        const stats = {
            "Wash & Fold": 0,
            "Wash & Iron": 0,
            "Iron Only": 0,
            "Dry Cleaning": 0,
            "Single Bedsheet/Blanket": 0,
            "Sports Shoes Regular": 0,
            "Saree Regular": 0,
            "Loafers/Sneakers": 0,
            "Kurta Pajama Regular": 0,
            "Trousers Regular": 0,
            "Shirt & Pant": 0,
            "Other": 0
        };

        activeOrders.forEach(o => {
            const bd = Array.isArray(o.serviceBreakdown) && o.serviceBreakdown.length > 0 ? o.serviceBreakdown : null;
            if (bd) {
                bd.forEach(item => {
                    const cat = matchServiceCategory(item.name || item.service || o.service);
                    stats[cat] = (stats[cat] || 0) + (Number(item.quantity) || 1);
                });
            } else {
                const cat = matchServiceCategory(o.service);
                stats[cat] = (stats[cat] || 0) + 1;
            }
        });

        return Object.entries(stats)
            .filter(([_, count]) => count > 0)
            .sort((a, b) => b[1] - a[1]);
    }, [activeOrders]);

    const b2cRevenue = useMemo(() => {
        return activeOrders
            .filter(o => o.type === "regular" || o.category === "B2C_RETAIL" || o.source === "cartdetails")
            .reduce((acc, o) => acc + (Number.isFinite(parseFloat(o.amount)) ? parseFloat(o.amount) : 0), 0);
    }, [activeOrders]);

    const b2bRevenue = useMemo(() => {
        const h99Dates = new Set();
        let nonH99 = 0;
        activeOrders.forEach(o => {
            const isB2B = o.type === "student" || o.type === "linen" || o.type === "airbnb" || o.category === "STUDENT_LAUNDRY" || o.category === "LINEN" || o.category === "AIRBNB";
            if (!isB2B) return;
            if (isHostel99Property(o.property)) {
                if (o.date) h99Dates.add(o.date);
            } else {
                nonH99 += (Number.isFinite(parseFloat(o.amount)) ? parseFloat(o.amount) : 0);
            }
        });
        const h99Rev = Array.from(h99Dates).reduce((sum, d) => sum + (HOSTEL_99_MONTHLY_REVENUE / getDaysInMonthForDate(d)), 0);
        return nonH99 + h99Rev;
    }, [activeOrders]);

    const totalCombinedRevenue = b2cRevenue + b2bRevenue;

    return (
        <div className="space-y-6" style={{ fontFamily: 'DM Sans, sans-serif' }}>
            {/* Sub-navigation Tabs */}
            <div className="flex items-center gap-4 sm:gap-8 border-b border-gray-200 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
                <button 
                    onClick={() => setSubTab("stats")}
                    className={`pb-4 text-sm font-bold transition-all relative whitespace-nowrap ${subTab === 'stats' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    <div className="flex items-center gap-2">
                        <FiGlobe size={18} />
                        Stats
                    </div>
                    {subTab === 'stats' && <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-600 rounded-t-full" />}
                </button>
                <button 
                    onClick={() => setSubTab("screens")}
                    className={`pb-4 text-sm font-bold transition-all relative whitespace-nowrap ${subTab === 'screens' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    <div className="flex items-center gap-2">
                        <FiMonitor size={18} />
                        Screens
                    </div>
                    {subTab === 'screens' && <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-600 rounded-t-full" />}
                </button>
                <button 
                    onClick={() => setSubTab("searches")}
                    className={`pb-4 text-sm font-bold transition-all relative whitespace-nowrap ${subTab === 'searches' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    <div className="flex items-center gap-2">
                        <FiSearch size={18} />
                        Searches
                    </div>
                    {subTab === 'searches' && <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-600 rounded-t-full" />}
                </button>
                <button 
                    onClick={() => setSubTab("services")}
                    className={`pb-4 text-sm font-bold transition-all relative whitespace-nowrap ${subTab === 'services' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    <div className="flex items-center gap-2">
                        <FiLayers size={18} />
                        Services
                    </div>
                    {subTab === 'services' && <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-600 rounded-t-full" />}
                </button>
            </div>

            <div className="animate-fade-in py-4">
                {subTab === "stats" && (
                    <div className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <StatCard 
                                label="Total Orders" 
                                value={activeOrders.length} 
                                icon={<FiShoppingBag />} 
                                color="indigo"
                                subValue="Selected Period"
                            />
                            <StatCard 
                                label="Total Users" 
                                value={totalUsers} 
                                icon={<FiUsers />} 
                                color="emerald"
                                subValue="Registered App Users"
                            />
                            <StatCard 
                                label="Services" 
                                value={serviceStats.length} 
                                icon={<FiLayers />} 
                                color="amber"
                                subValue="Active Service Types"
                            />
                            <StatCard 
                                label="Total Revenue" 
                                value={`₹${Math.round(totalCombinedRevenue).toLocaleString("en-IN")}`} 
                                icon={<BiRupee />} 
                                color="indigo"
                                subValue={`B2C: ₹${Math.round(b2cRevenue).toLocaleString("en-IN")} · B2B: ₹${Math.round(b2bRevenue).toLocaleString("en-IN")}`}
                            />
                        </div>
                    </div>
                )}

                {subTab === "screens" && (
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xl font-black text-[#0F172A]">Application Usage</h3>
                            <p className="text-[12px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md uppercase">Live Stats</p>
                        </div>
                        {screens.length > 0 ? (
                            screens.map(s => <ScreenItem key={s.id} name={String(s.screenName ?? s.id)} visits={Number(s.visitCount) || 0} />)
                        ) : (
                            <EmptyState 
                                icon={FiMonitor} 
                                title="No screen data available" 
                                message="Waiting for Firebase analytics sync." 
                            />
                        )}
                    </div>
                )}

                {subTab === "searches" && (
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xl font-black text-[#0F172A]">Popular Queries</h3>
                            <p className="text-[12px] font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded-md uppercase">Search Activity</p>
                        </div>
                        {searches.length > 0 ? (
                            searches.map(s => <SearchItem key={s.id} query={String(s.query ?? "")} count={Number(s.count) || 0} />)
                        ) : (
                            <EmptyState 
                                icon={FiSearch} 
                                title="No search queries recorded" 
                                message="Waiting for Firebase analytics sync." 
                            />
                        )}
                    </div>
                )}

                {subTab === "services" && (
                    <div>
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-black text-[#0F172A]">Service Performance</h3>
                            <div className="flex items-center gap-1.5 text-green-600 bg-green-50 px-2 py-1 rounded-md text-[10px] font-bold uppercase">
                                <FiTrendingUp size={12} />
                                Category Breakdown
                            </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {serviceStats.map(([label, count]) => (
                                <ServiceCard key={label} label={label} count={count} />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
