import { FiMenu } from "react-icons/fi";

// Page heading used by the Workspace, Operations and Finance pages:
// a white bar with the "Andes / Admin" crumb and page actions, then a small
// eyebrow, a large title and one line under it.
export default function AdminPageHeader({ title, subtitle, actions, onMenuClick, eyebrow }) {
  return (
    <header style={{ fontFamily: "DM Sans, sans-serif" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dfe8e2] bg-white px-4 py-3 lg:px-10">
        <div className="flex items-center gap-3">
          {onMenuClick && (
            <button
              type="button"
              onClick={onMenuClick}
              aria-label="Open menu"
              className="inline-flex h-9 w-9 items-center justify-center rounded-[9px] border border-[#dfe8e2] bg-white text-[#172c28] lg:hidden"
            >
              <FiMenu size={18} />
            </button>
          )}
          <strong className="text-[14px] font-bold text-[#172c28]">Andes / Admin</strong>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className="px-4 pt-7 lg:px-10">
        {eyebrow && <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#16654e]">{eyebrow}</div>}
        <h1 className="text-[clamp(29px,4vw,43px)] font-extrabold leading-[1.1] tracking-[-0.05em] text-[#172c28]">{title}</h1>
        {subtitle && <p className="mb-3 mt-2 text-[14px] leading-[1.55] text-[#58706a]">{subtitle}</p>}
      </div>
    </header>
  );
}
