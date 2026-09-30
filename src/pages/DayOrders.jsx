import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import TopNav from "../components/Layout/TopNav";
import PageHeader from "../components/Shared/PageHeader";
import OrderTable from "../components/Shared/OrderTable";
import { parseOrderDate } from "./Dashboard"; // Reusing our bulletproof date parser
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from "recharts";
import { FiCalendar, FiTrendingUp, FiActivity } from "react-icons/fi";

const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white border-l-4 border-[#1976D2] shadow-lg rounded-xl p-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
                <p className="text-[#1976D2] font-semibold text-xs mb-1">Day {label}</p>
                <p className="text-gray-800 font-bold text-sm">{payload[0].value} orders</p>
            </div>
        );
    }
    return null;
};

export default function DayOrders() {
    const { month } = useParams();
    const { orders } = useAuth();
    const [selectedDay, setSelectedDay] = useState(null);

    // Determines target year and month regardless of URL pattern ("/3" or "/2026-03")
    const targetYear = month.includes('-') ? parseInt(month.split('-')[0], 10) : new Date().getFullYear();
    const targetMonth = month.includes('-') ? parseInt(month.split('-')[1], 10) : parseInt(month, 10);

    const monthOrders = useMemo(() => {
        const uniqueMap = new Map();
        orders.forEach(o => uniqueMap.set(o.id || `${o.date}-${o.amount}-${o.tenant}`, { ...o, ...parseOrderDate(o) }));
        const validOrders = Array.from(uniqueMap.values());

        // STRICT constraint to the targeted month only
        return validOrders.filter(o => o.year === targetYear && o.month === targetMonth);
    }, [orders, targetYear, targetMonth]);

    const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();

    const dayData = useMemo(() => {
        const map = {};
        for (let i = 1; i <= daysInMonth; i++) map[i] = 0;

        monthOrders.forEach(o => {
            if (map[o.day] !== undefined) map[o.day]++;
        });

        return Object.entries(map).sort((a, b) => +a[0] - +b[0]).map(([d, count]) => ({ day: +d, count }));
    }, [monthOrders, daysInMonth]);

    const dayOrdersList = useMemo(() => selectedDay !== null ? monthOrders.filter(o => o.day === selectedDay) : [], [monthOrders, selectedDay]);

    const peakDayMap = [...dayData].sort((a, b) => b.count - a.count);
    const peakDay = peakDayMap[0]?.count > 0 ? `Day ${peakDayMap[0].day} with ${peakDayMap[0].count} orders` : 'None';
    const activeDays = dayData.filter(d => d.count > 0).length;

    return (
        <div className="min-h-screen bg-[#F0F7FF]" style={{ fontFamily: 'Poppins, sans-serif' }}>
            <TopNav />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <PageHeader
                    title={`${MONTH_NAMES[targetMonth]} ${targetYear} — Day-wise Orders`}
                    subtitle="Click a bar to see order details for that day"
                    backTo="/orders/months"
                />

                <div className="flex gap-6 mb-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1.5"><FiTrendingUp className="text-[#1976D2]" /> Peak day: <strong className="text-gray-900 font-bold">{peakDay}</strong></span>
                    <span className="flex items-center gap-1.5"><FiActivity className="text-[#1976D2]" /> Active days: <strong className="text-gray-900 font-bold">{activeDays} of {daysInMonth}</strong></span>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6 min-w-0">
                    <h2 className="text-base font-bold text-gray-900 mb-1">Orders Per Day</h2>
                    {selectedDay && <p className="text-xs text-[#FF6B35] font-medium mb-1">Showing orders for Day {selectedDay} — click another bar or same bar to toggle</p>}

                    <ResponsiveContainer width="100%" height={280} debounce={100}>
                        <BarChart data={dayData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }} barSize={16}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f5" vertical={false} />
                            <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9ca3af', fontFamily: 'Poppins' }} axisLine={false} tickLine={false} label={{ value: 'Day', position: 'insideBottomRight', offset: -5, fill: '#9ca3af', fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11, fill: '#9ca3af', fontFamily: 'Poppins' }} axisLine={false} tickLine={false} allowDecimals={false} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F0F7FF' }} />
                            <Bar dataKey="count" radius={[4, 4, 0, 0]} onClick={(data) => setSelectedDay(prev => prev === data.day ? null : data.day)} style={{ cursor: 'pointer' }}>
                                {dayData.map((entry) => (
                                    <Cell key={entry.day} fill={entry.day === selectedDay ? '#FF6B35' : '#1976D2'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h2 className="text-base font-bold text-gray-900 mb-1">{selectedDay ? `Orders on Day ${selectedDay}` : 'Order Details'}</h2>
                    {!selectedDay ? (
                        <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-blue-100 rounded-xl mt-4">
                            <FiCalendar size={40} className="text-blue-200 mb-3" />
                            <p className="font-semibold text-gray-700">Select a day from the chart above to view order details</p>
                        </div>
                    ) : (
                        <>
                            <p className="text-xs text-gray-400 mb-4">{dayOrdersList.length} orders found</p>
                            <OrderTable orders={dayOrdersList} showTenant={true} />
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}