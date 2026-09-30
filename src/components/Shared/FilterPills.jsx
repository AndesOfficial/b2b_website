export default function FilterPills({ options, activeValue, onChange, className = "" }) {
  return (
    <div className={`flex bg-white/50 backdrop-blur-sm p-1.5 rounded-xl border border-gray-100 shadow-sm gap-1 ${className}`}>
      {options.map((option) => (
        <button
          key={option}
          onClick={() => onChange(option)}
          className={`px-4 py-2 rounded-lg text-[12px] font-bold tracking-tight transition-all duration-300 ${
            activeValue === option
              ? "bg-white text-blue-600 shadow-sm border border-gray-100"
              : "text-slate-500 hover:text-slate-900 hover:bg-white/40"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
