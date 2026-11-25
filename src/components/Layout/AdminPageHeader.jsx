import { FiMenu } from "react-icons/fi";

// Page heading used by the Workspace, Operations and Finance pages:
// "Andes / Admin" crumb, a large title and one line under it.
export default function AdminPageHeader({ title, subtitle, actions, onMenuClick }) {
  return (
    <header className="px-4 pt-5 lg:px-10 lg:pt-7" style={{ fontFamily: "DM Sans, sans-serif" }}>
      <div className="flex items-center justify-between gap-3 border-b border-[#e3eae8] pb-3 text-[13px] text-[#5f726f]">
        <div className="flex items-center gap-3">
          {onMenuClick && (
            <button
              type="button"
              onClick={onMenuClick}
              aria-label="Open menu"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#e3eae8] bg-white text-[#153a3f] lg:hidden"
            >
              <FiMenu size={18} />
            </button>
          )}
          <span>Andes / Admin</span>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <h1 className="mt-6 text-[30px] font-extrabold leading-tight tracking-tight text-[#10262b] lg:text-[38px]">{title}</h1>
      {subtitle && <p className="mt-1 text-[14px] text-[#5f726f]">{subtitle}</p>}
    </header>
  );
}
