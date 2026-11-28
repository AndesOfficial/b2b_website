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
        <div className="fixed inset-0 z-50 bg-[#10292188] backdrop-blur-sm lg:hidden" onClick={() => setIsMobileOpen?.(false)} />
      )}

      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-[218px] flex-col bg-[#112d25] text-[#e4eee9] transition-transform duration-300
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
        style={{ fontFamily: "DM Sans, sans-serif" }}
      >
        <div className="flex items-center gap-2.5 px-5 pb-5 pt-6">
          <span className="grid h-[33px] w-[33px] place-items-center rounded-[9px] bg-[#bceb90]">
            <img src="/andes-logo.png" alt="" className="h-[22px] w-[22px] object-contain" />
          </span>
          <span className="text-[28px] font-extrabold leading-none tracking-[-1.5px] text-white">andes</span>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {ADMIN_NAV_GROUPS.map((group) => (
            <div key={group.label} className="mb-2">
              <p className="px-2.5 pb-1.5 pt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-[#9dbab0]">{group.label}</p>
              {group.items.map(([key, label]) => {
                const active = activeTab === key;
                const launch = key === "analytics";
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => open(key)}
                    aria-current={active ? "page" : undefined}
                    className={`my-0.5 flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[14px] font-medium transition-colors ${
                      active
                        ? "bg-[#285143] text-white"
                        : launch
                          ? "border border-[#568577] text-[#d6f9b7] hover:bg-[#285143] hover:text-white"
                          : "text-[#e4eee9] hover:bg-[#285143] hover:text-white"
                    }`}
                  >
                    <span>{label}</span>
                    {launch && <span aria-hidden="true">↗</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 px-3 py-3">
          {user?.email && <p className="truncate px-2.5 pb-1 text-[11px] text-[#9dbab0]">{user.email}</p>}
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-[#e4eee9] hover:bg-[#285143] hover:text-white"
          >
            <FiLogOut size={15} /> Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
