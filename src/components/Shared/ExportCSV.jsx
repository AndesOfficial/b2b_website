import { FiDownload } from "react-icons/fi";

export default function ExportCSV({ orders = [] }) {
    const handleExport = () => {
        if (!orders || orders.length === 0) return;

        const headers = ["Date", "Order ID", "Property", "Category", "Clothes", "Weight", "Students", "Amount", "Status", "Issue Type"];

        const rows = orders.map(o => {
            let dateStr = "—";
            if (o.date) {
                dateStr = o.date;
            } else if (o.timestamp) {
                const dateObj = new Date(o.timestamp.seconds ? o.timestamp.seconds * 1000 : o.timestamp);
                dateStr = dateObj.toLocaleDateString();
            } else if (o.month && o.day) {
                dateStr = `${new Date().getFullYear()}-${String(o.month).padStart(2, '0')}-${String(o.day).padStart(2, '0')}`;
            }

            return [
                dateStr,
                `"${o.id || "—"}"`,
                `"${o.property || o.tenant || "—"}"`,
                `"${o.category || "—"}"`,
                o.items ?? "",
                o.weight ?? "",
                o.studentCount ?? "",
                o.amount !== undefined ? o.amount.toString() : "0",
                o.status || "—",
                `"${o.issueType || ""}"`
            ].join(",");
        });

        const csvContent = [headers.join(","), ...rows].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        const dateStr = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
        link.href = url;
        link.setAttribute("download", `andes_orders_${dateStr}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <button
            onClick={handleExport}
            disabled={!orders || orders.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#E3F2FD] text-[#1976D2] border border-brand-200 font-semibold text-sm hover:bg-[#1976D2] hover:text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
            <FiDownload size={14} />
            Export CSV
        </button>
    );
}