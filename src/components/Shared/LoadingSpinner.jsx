export default function LoadingSpinner({ fullscreen = false, message = "Loading data..." }) {
    if (fullscreen) {
        return (
            <div className="fixed inset-0 bg-slate-50/80 backdrop-blur-sm z-[9999] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                        <div className="w-12 h-12 border-4 border-blue-100 rounded-full" />
                        <div className="absolute top-0 w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                    <p className="text-gray-500 font-medium text-sm animate-pulse tracking-wide">
                        {message}
                    </p>
                </div>
            </div>
        );
    }
    return (
        <div className="flex flex-col items-center justify-center py-16 w-full">
            <div className="relative mb-4">
                <div className="w-10 h-10 border-4 border-gray-100 rounded-full" />
                <div className="absolute top-0 w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-gray-400 font-medium text-sm tracking-wide">
                {message}
            </p>
        </div>
    );
}
