import { useNavigate } from "react-router-dom";
import { useHostelAuth } from "../../context/HostelAuthContext";
import { FiLogOut, FiMapPin, FiShield } from "react-icons/fi";
import BrandLogo from "../Shared/BrandLogo";

export default function TopNav() {
    const { client: partner, isAdmin, logout } = useHostelAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    const handleLogoClick = () => {
        navigate(isAdmin ? "/admin" : "/client/dashboard");
    };

    return (
        <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                {/* Logo */}
                <div className="flex items-center gap-3 cursor-pointer" onClick={handleLogoClick}>
                    <BrandLogo className="w-10 h-10 text-[#16654e]" />
                    <div>
                        <span className="font-bold text-[#16654e] text-lg leading-none" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                            Andes
                        </span>
                        <span className="block text-[10px] text-gray-400 leading-none font-medium tracking-wider uppercase">
                            {isAdmin ? "Admin Portal" : "B2B Portal"}
                        </span>
                    </div>
                </div>

                {/* Partner Info */}
                <div className="hidden sm:flex flex-col items-center text-center">
                    <div className="flex items-center gap-1.5">
                        {isAdmin && (
                            <span className="inline-flex items-center gap-1 bg-[#E8EAF6] text-[#0b3d2f] text-[10px] font-bold px-2 py-0.5 rounded-full">
                                <FiShield size={10} /> Admin
                            </span>
                        )}
                        <span className="font-semibold text-gray-800 text-sm leading-tight" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                            {partner?.name}
                        </span>
                    </div>
                    {partner?.location && (
                        <span className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                            <FiMapPin size={10} />
                            {partner.location}
                        </span>
                    )}
                </div>

                {/* Sign Out */}
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#d9f1e3] text-[#16654e] border border-brand-200 font-semibold text-sm hover:bg-[#16654e] hover:text-white transition-all duration-200"
                    style={{ fontFamily: 'DM Sans, sans-serif' }}
                >
                    <FiLogOut size={15} />
                    <span className="hidden sm:inline">Sign Out</span>
                </button>
            </div>
        </nav>
    );
}
