import { useNavigate } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";

export default function PageHeader({ title, subtitle, backTo }) {
    const navigate = useNavigate();
    return (
        <div className="mb-8 flex flex-col gap-1" style={{ fontFamily: 'DM Sans, sans-serif' }}>
            {backTo !== undefined && (
                <button
                    onClick={() => backTo ? navigate(backTo) : navigate(-1)}
                    className="flex items-center gap-1.5 text-gray-400 hover:text-blue-600 text-xs font-bold uppercase tracking-wider mb-2 transition-colors w-fit"
                >
                    <FiArrowLeft size={14} />
                    Back
                </button>
            )}
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">{title}</h1>
            {subtitle && <p className="text-sm font-medium text-gray-500 mt-1">{subtitle}</p>}
        </div>
    );
}
