export default function StatusBar({ label, value, total, color }) {
    const pct = total > 0 ? Math.round((value / total) * 100) : 0;
    const colorMap = {
        green: { bar: 'bg-green-500', text: 'text-green-500' },
        brand: { bar: 'bg-blue-500', text: 'text-blue-500' },
        orange: { bar: 'bg-orange-400', text: 'text-orange-400' },
    };
    const c = colorMap[color] || colorMap.brand;

    return (
        <div className="flex items-center gap-3" style={{ fontFamily: 'DM Sans, sans-serif' }}>
            <span className="w-24 text-xs font-medium text-gray-600 flex-shrink-0">{label}</span>
            <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                    className={`${c.bar} h-2 rounded-full transition-all duration-700`}
                    style={{ width: `${pct}%` }}
                />
            </div>
            <span className={`text-xs font-bold ${c.text} w-8 text-right`}>{pct}%</span>
            <span className="text-xs text-gray-400 w-6 text-right">{value}</span>
        </div>
    );
}
