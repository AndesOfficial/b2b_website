import { FiChevronLeft, FiLogOut, FiMenu } from "react-icons/fi";
import BrandLogo from "../Shared/BrandLogo";
import { ADMIN_SIDEBAR_TABS } from "../../config/adminTabs";

const SIDEBAR_ITEM_BASE_CLASS = "w-full flex items-center rounded-lg text-[13.5px] font-medium transition-all group";

export default function AdminSidebar({ activeTab, setActiveTab, issuesCount, user, onLogout, isCollapsed, setIsCollapsed, isMobileOpen, setIsMobileOpen }) {
  return (
    <>
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed left-0 top-0 h-screen bg-[#0F172A] text-white flex flex-col z-50 border-r border-[#1E293B] transition-all duration-300 ease-in-out
          ${isCollapsed ? "w-[80px]" : "w-[220px]"}
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
        style={{ fontFamily: "DM Sans, sans-serif" }}
      >
        <div className={`p-6 flex items-center justify-between ${isCollapsed ? "px-4" : "px-6"}`}>
          <div className="flex items-center gap-3 overflow-hidden">
            <BrandLogo className="h-9 w-9 text-blue-400 flex-shrink-0" />
            {!isCollapsed && (
              <div className="animate-fade-in whitespace-nowrap">
                <span className="font-extrabold text-white text-lg leading-tight tracking-tight">Andes</span>
                <span className="block text-[10px] text-[#64748B] font-bold tracking-[0.15em] uppercase mt-0.5">
                  Admin Portal
                </span>
              </div>
            )}
          </div>

          {!isCollapsed && (
            <button
              onClick={() => {
                if (window.innerWidth < 1024) setIsMobileOpen(false);
                else setIsCollapsed(true);
              }}
              aria-label="Collapse sidebar"
              className="p-1.5 rounded-lg hover:bg-[#1E293B] text-[#64748B] hover:text-white transition-colors"
            >
              <FiChevronLeft size={18} />
            </button>
          )}
        </div>

        {isCollapsed && (
          <div className="px-4 mb-4">
            <button
              onClick={() => setIsCollapsed(false)}
              aria-label="Expand sidebar"
              className="w-full flex items-center justify-center p-3 rounded-xl bg-[#1E293B] text-blue-400 hover:text-white transition-all shadow-lg"
            >
              <FiMenu size={20} />
            </button>
          </div>
        )}

        <nav className="flex-1 mt-4 space-y-1 px-3 overflow-y-auto scrollbar-hide">
          {ADMIN_SIDEBAR_TABS.map((item) => {
            const badge = item.badgeKey === "issuesCount" ? issuesCount : 0;

            return (
              <button
                key={item.key}
                onClick={() => setActiveTab(item.key)}
                title={isCollapsed ? item.navLabel : ""}
                className={`${SIDEBAR_ITEM_BASE_CLASS} ${isCollapsed ? "justify-center py-3.5" : "justify-between px-4 py-3"} ${
                  activeTab === item.key
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20"
                    : "text-[#94A3B8] hover:bg-[#1E293B] hover:text-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <item.navIcon size={20} className={activeTab === item.key ? "text-white" : "text-[#475569] group-hover:text-blue-400"} />
                  {!isCollapsed && <span className="animate-fade-in">{item.navLabel}</span>}
                </div>

                {!isCollapsed && badge > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center animate-fade-in">
                    {badge}
                  </span>
                )}

                {isCollapsed && badge > 0 && (
                  <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-[#0F172A]" />
                )}
              </button>
            );
          })}
        </nav>

        <div className={`p-4 border-t border-[#1E293B] bg-[#1E293B]/30 mb-2 transition-all flex-shrink-0 ${isCollapsed ? "px-2" : "px-4"}`}>
          <div className={`flex items-center gap-3 ${isCollapsed ? "justify-center" : "px-2"}`}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-black text-xs text-white shadow-lg flex-shrink-0">
              {user?.name?.charAt(0) || "A"}
            </div>

            {!isCollapsed && (
              <div className="flex-1 min-w-0 animate-fade-in">
                <p className="text-xs font-black text-white truncate uppercase tracking-tight">{user?.name}</p>
                <p className="text-[10px] text-[#64748B] uppercase font-black tracking-wider mt-0.5">Admin Role</p>
              </div>
            )}

            {!isCollapsed && (
              <button
                onClick={onLogout}
                title="Logout Session"
                aria-label="Logout Session"
                className="p-2 text-[#475569] hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
              >
                <FiLogOut size={18} />
              </button>
            )}
          </div>

          {isCollapsed && (
            <button
              onClick={onLogout}
              title="Logout Session"
              aria-label="Logout Session"
              className="mt-4 w-full flex items-center justify-center p-2 text-[#475569] hover:text-red-400 transition-all"
            >
              <FiLogOut size={20} />
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
