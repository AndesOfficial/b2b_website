import { useNavigate } from "react-router-dom";
import { FiHome, FiAlertCircle } from "react-icons/fi";
import BrandLogo from "../components/Shared/BrandLogo";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center p-6 text-white text-center" style={{ fontFamily: "DM Sans, sans-serif" }}>
      <div className="mb-8 animate-fade-in flex flex-col items-center">
        <BrandLogo className="h-16 w-16 text-blue-400 mb-4" />
        <span className="text-[11px] font-black tracking-[0.2em] uppercase text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
          Error 404
        </span>
      </div>

      <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-3">
        Page Not Found
      </h1>
      <p className="text-slate-400 max-w-md text-sm sm:text-base font-medium mb-8 leading-relaxed">
        The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
      </p>

      <div className="flex flex-wrap gap-4 justify-center">
        <button
          onClick={() => navigate(-1)}
          className="px-6 py-3 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-slate-200 font-bold text-sm transition-all flex items-center gap-2 border border-[#334155]"
        >
          Go Back
        </button>
        <button
          onClick={() => navigate("/login")}
          className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-all flex items-center gap-2 shadow-lg shadow-blue-600/30"
        >
          <FiHome size={16} />
          Go to Portal
        </button>
      </div>
    </div>
  );
}
