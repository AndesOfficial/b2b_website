import { BiRupee } from "react-icons/bi";
export default function MonthCard({ month, count, revenue, onClick }) {
    const gradients = [
        'from-[#1976D2] to-[#1565C0]',
        'from-[#0891b2] to-[#0e7490]',
        'from-[#0284c7] to-[#0369a1]',
    ];
    const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    const monthShort = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const grad = gradients[(month - 1) % gradients.length];

    const isEmpty = count === 0;

    return (
        <div
            onClick={!isEmpty ? onClick : undefined}
            className={`group bg-gradient-to-br ${grad} rounded-2xl p-6 text-white
        transition-all duration-200 select-none ${isEmpty ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer shadow-md hover:shadow-xl hover:-translate-y-1 active:translate-y-0'}`}
            style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
            <div className="flex items-start justify-between mb-4">
                <div>
                    <p className="text-white/70 text-xs font-medium uppercase tracking-wider mb-1">Month</p>
                    <p className="text-2xl font-bold">{monthNames[month] || monthShort[month]}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-400 flex items-center justify-center">
                    <span className="font-bold text-white text-sm">{String(month).padStart(2, '0')}</span>
                </div>
            </div>
            <div className="flex items-end justify-between">
                <div>
                    <p className="text-white/70 text-xs">Total Orders</p>
                    <p className="text-3xl font-bold">{count}</p>
                </div>
                <div className="text-right">
                    <p className="text-white/70 text-xs">Revenue</p>
                    <div className="flex items-center justify-end gap-0.5 text-lg font-semibold">
                        <BiRupee size={16} className="mb-0.5" />
                        <span>{(revenue || 0).toLocaleString()}</span>
                    </div>
                </div>
            </div>

            {!isEmpty && (
                <div className="mt-4 pt-4 border-t border-white/20 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <span className="text-white/70 text-xs">Click to drill down</span>
                    <span className="text-white text-sm font-semibold transform transition-transform duration-300 group-hover:translate-x-1">→</span>
                </div>
            )}
        </div>
    );
}
