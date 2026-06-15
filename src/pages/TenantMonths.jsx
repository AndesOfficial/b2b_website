import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import TopNav from "../components/Layout/TopNav";
import MonthCard from "../components/Shared/MonthCard";
import PageHeader from "../components/Shared/PageHeader";
import { parseOrderDate } from "./Dashboard";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from "recharts";

const MONTH_SHORT = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-white border-l-4 border-[#1976D2] shadow-lg rounded-xl p-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
                <p className="text-[#1976D2] font-semibold text-xs mb-1">{label}</p>
                <p className="text-gray-800 font-bold text-sm">{data.count} orders</p>
                <p className="text-green-600 font-bold text-sm">₹{data.revenue?.toLocaleString() || 0}</p>
            </div>
        );
    }
    return null;
};

export default function TenantMonths() {
    const { tenantName } = useParams();
    const { orders } = useAuth();
    const navigate = useNavigate();
    const decoded = decodeURIComponent(tenantName);

    const monthData = useMemo(() => {
        const uniqueMap = new Map();
        orders.forEach(o => uniqueMap.set(o.id || `${o.date}-${o.amount}-${o.tenant}`, { ...o, ...parseOrderDate(o) }));
        const validOrders = Array.from(uniqueMap.values());

        const tenantOrders = validOrders.filter(o => o.tenant === decoded);

        const map = {};
        tenantOrders.forEach(o => {
            if (!map[o.monthKey]) {
                map[o.monthKey] = {
                    key: o.monthKey,
                    label: `${MONTH_SHORT[o.month]} '${String(o.year).slice(2)}`,
                    sortVal: o.year * 100 + o.month,
                    count: 0,
                    revenue: 0
                };
            }
            map[o.monthKey].count++;
            map[o.monthKey].revenue += parseFloat(o.amount) || 0;
        });

        return Object.values(map).sort((a, b) => a.sortVal - b.sortVal);
    }, [orders, decoded]);

    return (
        <div className="min-h-screen bg-[#F0F7FF]" style={{ fontFamily: 'Poppins, sans-serif' }}>
            <TopNav />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <PageHeader
                    title={decoded}
                    subtitle={`Click a month to see daily breakdown`}
                    backTo="/dashboard"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                    {monthData.length === 0 ? (
                        <p className="text-gray-400 text-sm col-span-3">No orders found for this tenant.</p>
                    ) : monthData.map(m => (
                        <MonthCard
                            key={m.key}
                            month={m.label}
                            count={m.count}
                            revenue={m.revenue}
                            onClick={() => navigate(`/tenants/${encodeURIComponent(decoded)}/months/${m.key}`)}
                        />
                    ))}
                </div>

                {monthData.length > 0 && (
                    <div className="bg-white rounded-2xl border border-brand-100 shadow-sm p-6">
                        <h2 className="text-base font-bold text-gray-900 mb-1">Monthly Orders — {decoded}</h2>
                        <p className="text-xs text-gray-400 mb-5">Orders per month for this tenant</p>
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={monthData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }} barSize={40}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f5" vertical={false} />
                                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#9ca3af', fontFamily: 'Poppins' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 11, fill: '#9ca3af', fontFamily: 'Poppins' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F0F7FF' }} />
                                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                                    {monthData.map((_, i) => <Cell key={i} fill="#1976D2" />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        </div>
    );
}