import { FiFileText, FiPlus } from "react-icons/fi";

const ACTION_BUTTON_BASE_CLASS = "inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-all shadow-sm";

export default function AdminPageActions({ onGenerateInvoice, onLogOrder }) {
  return (
    <div className="flex justify-end mb-4 animate-fade-in gap-3">
      {/* Shared actions live in one place so the tab shell stays declarative. */}
      <button
        onClick={onLogOrder}
        className={`${ACTION_BUTTON_BASE_CLASS} text-white bg-blue-600 hover:bg-blue-700`}
      >
        <FiPlus size={18} /> Log New Order
      </button>

      <button
        onClick={onGenerateInvoice}
        className={`${ACTION_BUTTON_BASE_CLASS} text-white bg-indigo-600 hover:bg-indigo-700`}
      >
        <FiFileText size={18} /> Generate Invoice
      </button>
    </div>
  );
}
