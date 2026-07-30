import { FiCalendar, FiMenu } from "react-icons/fi";
import ExportCSV from "../Shared/ExportCSV";
import { useState, useEffect } from "react";

function getDateStr(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function AdminTopBar({ title, dateFrom, setDateFrom, dateTo, setDateTo, onExpensesClick, onCalculatorClick, orders, onMenuClick }) {
    const [activePreset, setActivePreset] = useState(null);

    // Detect which preset matches the current date range
    useEffect(() => {
        const now = new Date();
        const todayStr = getDateStr(now);

        const monthStart = getDateStr(new Date(now.getFullYear(), now.getMonth(), 1));

        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(now.getDate() - 6);
        const sevenDaysStr = getDateStr(sevenDaysAgo);

        if (dateFrom === todayStr && dateTo === todayStr) {
            setActivePreset("today");
        } else if (dateFrom === sevenDaysStr && dateTo === todayStr) {
            setActivePreset("7days");
        } else if (dateFrom === monthStart && dateTo === todayStr) {
            setActivePreset("month");
        } else {
            setActivePreset(null);
        }
    }, [dateFrom, dateTo]);

    const applyPreset = (preset) => {
        const now = new Date();
        const todayStr = getDateStr(now);
        if (preset === "today") {
            setDateFrom(todayStr);
            setDateTo(todayStr);
        } else if (preset === "7days") {
            const ago = new Date(now);
            ago.setDate(now.getDate() - 6);
            setDateFrom(getDateStr(ago));
            setDateTo(todayStr);
        } else if (preset === "month") {
            setDateFrom(getDateStr(new Date(now.getFullYear(), now.getMonth(), 1)));
            setDateTo(todayStr);
        }
    };

    const presets = [
        { key: "today", label: "Today" },
        { key: "7days", label: "7 Days" },
        { key: "month", label: "This Month" },
    ];

    return (
        <header className="sticky top-0 z-40 bg-white border-b border-gray-200 h-16 lg:h-18 flex items-center justify-between px-4 lg:px-8 shadow-sm" style={{ fontFamily: 'DM Sans, sans-serif' }}>
            <div className="flex items-center gap-3">
                <button 
                    onClick={onMenuClick}
                    aria-label="Open mobile navigation menu"
                    className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg lg:hidden"
                >
                    <FiMenu size={20} />
                </button>
                <h1 className="text-base lg:text-[18px] font-bold text-[#0F172A] truncate max-w-[120px] sm:max-w-none">{title}</h1>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
                {/* Quick Presets */}
                <div className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                    {presets.map(({ key, label }) => (
                        <button
                            key={key}
                            onClick={() => applyPreset(key)}
                            className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all duration-150 ${
                                activePreset === key
                                    ? "bg-white text-blue-600 shadow-sm"
                                    : "text-slate-500 hover:text-slate-800 hover:bg-white/60"
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {/* Date Picker */}
                <div className="flex items-center gap-1.5 sm:gap-3 bg-gray-50 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-200 shadow-sm">
                    <FiCalendar size={14} className="text-gray-400 hidden sm:block" />
                    <input
                        type="date"
                        aria-label="Filter from date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="bg-transparent text-[11px] sm:text-[13px] font-medium text-gray-700 outline-none border-none w-[90px] sm:w-[115px]"
                    />
                    <span className="text-gray-300 text-xs">—</span>
                    <input
                        type="date"
                        aria-label="Filter to date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="bg-transparent text-[11px] sm:text-[13px] font-medium text-gray-700 outline-none border-none w-[90px] sm:w-[115px]"
                    />
                </div>

                {/* Export Orders CSV */}
                <div className="hidden sm:block">
                    <ExportCSV orders={orders} className="!bg-blue-600 !text-white !p-2 !rounded-lg hover:!bg-blue-700 transition-colors shadow-sm" />
                </div>
            </div>
        </header>
    );
}

