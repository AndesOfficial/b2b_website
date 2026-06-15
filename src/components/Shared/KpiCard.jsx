import { LineChart, Line, ResponsiveContainer } from "recharts";

export default function KpiCard({
    icon: Icon,
    value,
    label,
    onClick,
    color = "blue",
    trend,
    sparklineData = []
}) {
    const isClickable = !!onClick;

    // Color mapping for top border and icon backgrounds
    const colorClasses = {
        blue: { border: "border-t-[3px] border-t-blue-500", icon: "bg-blue-50 text-blue-500", spark: "#3b82f6" },
        purple: { border: "border-t-[3px] border-t-purple-500", icon: "bg-purple-50 text-purple-500", spark: "#a855f7" },
        green: { border: "border-t-[3px] border-t-green-500", icon: "bg-green-50 text-green-500", spark: "#10b981" },
        amber: { border: "border-t-[3px] border-t-amber-500", icon: "bg-amber-50 text-amber-500", spark: "#f59e0b" },
        red: { border: "border-t-[3px] border-t-red-500", icon: "bg-red-50 text-red-500", spark: "#ef4444" },
    };

    const config = colorClasses[color] || colorClasses.blue;

    return (
        <div
            onClick={onClick}
            className={`bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5 flex flex-col relative overflow-visible transition-all duration-300
                ${isClickable ? 'cursor-pointer hover:shadow-lg hover:-translate-y-1' : ''}
                ${config.border}
            `}
            style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
            {/* Top Row: Icon & Label */}
            <div className="flex items-start justify-between mb-3 sm:mb-4">
                <div className="min-w-0 pr-2">
                    <div className="text-[10px] sm:text-[11.5px] font-bold text-[#94A3B8] uppercase tracking-wider mb-0.5 sm:mb-1 min-w-0">
                        {label}
                    </div>
                    <div className="text-xl sm:text-2xl font-extrabold text-[#0F172A] leading-tight tracking-tight">
                        {value}
                    </div>
                </div>
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${config.icon}`}>
                    {Icon && <Icon size={window?.innerWidth < 640 ? 16 : 18} />}
                </div>
            </div>

            {/* Bottom Row: Trend */}
            <div className="flex items-end justify-between mt-auto">
                {trend && (
                    <div className={`px-2 py-1 rounded-full text-[11px] font-bold flex items-center gap-1
                        ${trend.direction === 'up' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}
                    `}>
                         {trend.direction === 'up' ? '↑' : '↓'} {trend.text}
                    </div>
                )}
            </div>
        </div>
    );
}
