import { FiCalendar, FiDownload, FiDollarSign, FiMenu } from "react-icons/fi";
import { BiRupee } from "react-icons/bi";
import ExportCSV from "../Shared/ExportCSV";
import { FaIndianRupeeSign, FaCalculator } from "react-icons/fa6";

export default function AdminTopBar({ title, dateFrom, setDateFrom, dateTo, setDateTo, onExpensesClick, onCalculatorClick, orders, onMenuClick }) {
    return (
        <header className="sticky top-0 z-40 bg-white border-b border-gray-200 h-16 lg:h-18 flex items-center justify-between px-4 lg:px-8 shadow-sm" style={{ fontFamily: 'DM Sans, sans-serif' }}>
            <div className="flex items-center gap-3">
                <button 
                    onClick={onMenuClick}
                    className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg lg:hidden"
                >
                    <FiMenu size={20} />
                </button>
                <h1 className="text-base lg:text-[18px] font-bold text-[#0F172A] truncate max-w-[120px] sm:max-w-none">{title}</h1>
            </div>

            <div className="flex items-center gap-4">

                {/* Date Picker - Compact on mobile */}
                <div className="flex items-center gap-1.5 sm:gap-3 bg-gray-50 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-200 shadow-sm">
                    <FiCalendar size={14} className="text-gray-400 hidden sm:block" />
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="bg-transparent text-[11px] sm:text-[13px] font-medium text-gray-700 outline-none border-none w-[90px] sm:w-[115px]"
                    />
                    <span className="text-gray-300 text-xs">—</span>
                    <input
                        type="date"
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
