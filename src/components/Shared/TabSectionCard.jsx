export default function TabSectionCard({ title, subtitle, actions, children, className = "" }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden ${className}`}>
      {(title || subtitle || actions) && (
        <div className="p-4 sm:p-6 border-b border-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            {title && <h2 className="text-[15px] font-black text-[#0F172A] tracking-tight mb-0.5">{title}</h2>}
            {subtitle && <p className="text-[12px] font-medium text-slate-400">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}
