import { FiInbox } from "react-icons/fi";

export default function EmptyState({ 
    icon: Icon = FiInbox, 
    title = "No data found", 
    message = "Try adjusting your filters or search terms",
    action
}) {
    return (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center animate-fade-in">
            <div className="bg-gray-50 p-6 rounded-full mb-6 border border-gray-100 shadow-sm">
                <Icon size={48} className="text-gray-300" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2 tracking-tight">
                {title}
            </h3>
            <p className="text-gray-500 text-sm max-w-xs leading-relaxed">
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
