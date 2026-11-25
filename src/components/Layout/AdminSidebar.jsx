import { useNavigate } from "react-router-dom";
import { FiLogOut } from "react-icons/fi";
import { ADMIN_NAV_GROUPS, ADMIN_TAB_ROUTES } from "../../config/adminTabs";

// Andes Admin menu: four groups, text only. Pages with their own address are
// opened from here directly; the rest are tabs inside /admin.
export default function AdminSidebar({ activeTab, setActiveTab, user, onLogout, isMobileOpen, setIsMobileOpen }) {
  const navigate = useNavigate();

  const open = (key) => {
    setIsMobileOpen?.(false);
    const route = ADMIN_TAB_ROUTES[key];
    if (route) {
      navigate(route);
      return;
    }
    setActiveTab?.(key);
  };

  return (
    <>
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setIsMobileOpen?.(false)} />
      )}

      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-[220px] flex-col bg-[#153a3f] text-white transition-transform duration-300
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
        style={{ fontFamily: "DM Sans, sans-serif" }}
      >
        <div className="px-6 pb-5 pt-7">
          <span className="text-[26px] font-extrabold leading-none tracking-tight">
            andes<span className="text-[#5fd0b0]">.</span>
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {ADMIN_NAV_GROUPS.map((group) => (
            <div key={group.label} className="mb-5">
              <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8fb2ae]">{group.label}</p>
              {group.items.map(([key, label]) => {
                const active = activeTab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => open(key)}
                    className={`block w-full rounded-lg px-3 py-2 text-left text-[14px] font-medium transition-colors ${
                      active ? "bg-white/15 text-white" : "text-[#d6e6e3] hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 px-3 py-3">
          {user?.email && <p className="truncate px-3 pb-1 text-[11px] text-[#8fb2ae]">{user.email}</p>}
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-[#d6e6e3] hover:bg-white/10 hover:text-white"
          >
            <FiLogOut size={15} /> Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
