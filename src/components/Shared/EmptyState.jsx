import { FiInbox } from "react-icons/fi";

export default function EmptyState({ 
    icon: Icon = FiInbox, 
    title = "No data found", 
    message = "Try adjusting your filters or search terms",
    action
}) {
    return (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center animate-fade-in">
            {/* Icon bubble with gradient background */}
            <div className="relative mb-6">
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-50 via-slate-50 to-indigo-50 border border-slate-100 shadow-sm flex items-center justify-center">
                    <Icon size={40} className="text-slate-300" />
                </div>
                {/* Decorative ring */}
                <div className="absolute -inset-2 rounded-[2rem] border border-slate-100/60 pointer-events-none" />
            </div>

            <h3 className="text-[17px] font-black text-[#0F172A] mb-2 tracking-tight">
                {title}
            </h3>
            <p className="text-slate-400 text-[13px] font-medium max-w-xs leading-relaxed">
                {message}
            </p>
            {action && (
                <div className="mt-8">
                    {action}
                </div>
            )}
        </div>
    );
}
