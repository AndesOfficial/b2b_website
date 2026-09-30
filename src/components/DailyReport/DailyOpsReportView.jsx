import { FiAlertCircle } from 'react-icons/fi';

const SECTION_TITLE_CLASS = 'text-[15px] font-bold text-blue-400 tracking-wide mb-3';
const TABLE_HEADER_CLASS = 'px-4 py-2.5 text-left text-[12px] font-bold text-slate-400 uppercase tracking-wider';
const TABLE_CELL_CLASS = 'px-4 py-3 text-[13px] text-slate-200';
const TABLE_ROW_CLASS = 'border-b border-slate-700/40 hover:bg-slate-700/20 transition-colors';

function formatCurrency(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN')}`;
}

function formatWeight(kg) {
  if (!kg || kg === 0) return '-';
  return `${Number(kg).toFixed(1)} kg`;
}

function formatWeightWithBreakdown(row) {
  if (row.weightDisplay) return row.weightDisplay;
  return formatWeight(row.weight);
}

function formatCount(count) {
  if (!count || count === 0) return '-';
  return String(count);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).replace(/\//g, '-');
}

/** Summary table: key-value pairs like the screenshot */
function SummaryTable({ rows }) {
  return (
    <table className="w-full mb-6">
      <thead>
        <tr className="border-b border-slate-600/50">
          <th className={TABLE_HEADER_CLASS} style={{ width: '45%' }}>Metric</th>
          <th className={TABLE_HEADER_CLASS}>Details</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className={TABLE_ROW_CLASS}>
            <td className={`${TABLE_CELL_CLASS} font-medium text-slate-300`}>{row.metric}</td>
            <td className={TABLE_CELL_CLASS}>{row.detail}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Detail table with columns */
function DetailTable({ columns, rows, emptyMessage }) {
  if (!rows || rows.length === 0) {
    return (
      <div className="flex items-center gap-2 text-slate-500 text-[13px] py-4 px-4 mb-6">
        <FiAlertCircle size={16} />
        <span>{emptyMessage || 'No data for this date.'}</span>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto mb-6">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-600/50">
            {columns.map((col, i) => (
              <th key={i} className={TABLE_HEADER_CLASS}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id || i} className={TABLE_ROW_CLASS}>
              {columns.map((col, j) => (
                <td key={j} className={TABLE_CELL_CLASS}>
                  {col.render ? col.render(row) : (row[col.key] ?? '-')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Status badge */
function StatusBadge({ status }) {
  const normalized = String(status || '').toLowerCase();
  let colorClass = 'bg-slate-600 text-slate-200';
  if (normalized === 'completed' || normalized === 'delivered') {
    colorClass = 'bg-emerald-900/60 text-emerald-300';
  } else if (normalized === 'pending') {
    colorClass = 'bg-amber-900/60 text-amber-300';
  } else if (normalized === 'processing' || normalized.includes('picked')) {
    colorClass = 'bg-blue-900/60 text-blue-300';
  } else if (normalized === 'cancelled') {
    colorClass = 'bg-red-900/60 text-red-300';
  }

  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold ${colorClass}`}>
      {status}
    </span>
  );
}

const B2C_PICKUP_COLUMNS = [
  { key: 'customer', label: 'Customer' },
  { key: 'service', label: 'Service' },
  { key: 'weight', label: 'Weight', render: (r) => formatWeightWithBreakdown(r) },
  { key: 'count', label: 'Count', render: (r) => r.count > 0 ? String(r.count) : '-' },
  { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
];

const B2C_DELIVERY_COLUMNS = [
  { key: 'customer', label: 'Customer' },
  { key: 'service', label: 'Service' },
  { key: 'weight', label: 'Weight', render: (r) => formatWeightWithBreakdown(r) },
  { key: 'count', label: 'Count', render: (r) => r.count > 0 ? String(r.count) : '-' },
  { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
];

const B2B_DELIVERY_COLUMNS = [
  { key: 'hostel', label: 'Hostel' },
  { key: 'weight', label: 'Weight', render: (r) => formatWeight(r.weight) },
  { key: 'clothes', label: 'Clothes', render: (r) => formatCount(r.clothes) },
  { key: 'students', label: 'Students', render: (r) => formatCount(r.students) },
];

const B2B_STUDENT_COLUMNS = [
  { key: 'customer', label: 'Student Name' },
  { key: 'room', label: 'Room' },
  { key: 'hostel', label: 'Hostel' },
  { key: 'clothes', label: 'Clothes', render: (r) => formatCount(r.clothes) },
  { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
];

export default function DailyOpsReportView({ report, selectedDate }) {
  if (!report) return null;

  const { b2cSummary, b2cPickupDetails, b2cPendingDetails, b2cDeliveryDetails, b2bSummary, hostelDeliveryDetails, hostelStudentDetails, customerIssues, remarks } = report;

  const pb = b2cSummary.paymentBreakdown || {};
  const b2cSummaryRows = [
    { metric: 'Total Orders Received', detail: `${b2cSummary.totalOrdersReceived} pickups` },
    { metric: 'Total Orders Delivered', detail: `${b2cSummary.totalOrdersDelivered} deliveries` },
    { metric: 'Total Orders Picked Up', detail: String(b2cSummary.totalOrdersPickedUp) },
    { metric: 'Delayed Orders', detail: String(b2cSummary.delayedOrders) },
    { metric: 'Total Revenue', detail: formatCurrency(b2cSummary.totalRevenue) },
    { metric: 'Payment Split', detail: `COD: ${pb.cod || 0} · Online: ${pb.online || 0} | Completed: ${pb.completed || 0} · Pending: ${pb.pending || 0}` },
    { metric: 'Customer Issues', detail: b2cSummary.customerIssuesText },
  ];

  const b2bSummaryRows = [
    {
      metric: 'Hostels Delivered',
      detail: b2bSummary.hostelsDelivered > 0
        ? `${b2bSummary.hostelsDelivered} (${b2bSummary.hostelsDeliveredNames.join(', ')})`
        : '0',
    },
    {
      metric: 'Total Revenue',
      detail: formatCurrency(b2bSummary.totalRevenue),
    },
    { metric: 'Delayed Orders', detail: b2bSummary.delayedOrders > 0 ? String(b2bSummary.delayedOrders) : 'None' },
    {
      metric: 'Hostel Issues',
      detail: b2bSummary.hostelIssues && b2bSummary.hostelIssues.length > 0
        ? b2bSummary.hostelIssues.join('; ')
        : 'None',
    },
  ];

  return (
    <div className="bg-[#0F172A] rounded-2xl border border-slate-700/50 shadow-2xl overflow-hidden">
      {/* Report Header */}
      <div className="px-6 py-5 border-b border-slate-700/50">
        <h2 className="text-[18px] font-extrabold text-white tracking-tight">
          Andes Laundry Daily Operations Report
        </h2>
        <p className="text-[13px] font-bold text-slate-400 mt-1">
          Date: {formatDate(selectedDate)}
        </p>
      </div>

      <div className="px-6 py-5 space-y-2">
        {/* ── B2C Summary ──────────────────────────────────────────── */}
        <h3 className={SECTION_TITLE_CLASS}>B2C Summary</h3>
        <SummaryTable rows={b2cSummaryRows} />

        <h3 className={SECTION_TITLE_CLASS}>B2C Completed Pickups</h3>
        <DetailTable
          columns={B2C_PICKUP_COLUMNS}
          rows={b2cPickupDetails}
          emptyMessage="No pickups completed for this date."
        />

        <h3 className="mb-4 mt-6 text-sm font-bold text-blue-400">B2C Pending Pickups</h3>
        <DetailTable
          columns={B2C_PICKUP_COLUMNS}
          rows={b2cPendingDetails}
          emptyMessage="No pending orders recorded for this date."
        />

        {/* ── B2C Delivery Details ─────────────────────────────────── */}
        <h3 className={SECTION_TITLE_CLASS}>B2C Delivery Details</h3>
        <DetailTable
          columns={B2C_DELIVERY_COLUMNS}
          rows={b2cDeliveryDetails}
          emptyMessage="No deliveries recorded for this date."
        />

        {/* ── B2B Summary ──────────────────────────────────────────── */}
        <h3 className={SECTION_TITLE_CLASS}>B2B Summary</h3>
        <SummaryTable rows={b2bSummaryRows} />

        {/* ── Hostel Delivery Details ──────────────────────────────── */}
        <h3 className={SECTION_TITLE_CLASS}>Hostel Delivery Details</h3>
        <DetailTable
          columns={B2B_DELIVERY_COLUMNS}
          rows={hostelDeliveryDetails}
          emptyMessage="No hostel deliveries recorded for this date."
        />

        <h3 className="mb-4 mt-6 text-sm font-bold text-blue-400">Hostel Student Breakdown</h3>
        <DetailTable
          columns={B2B_STUDENT_COLUMNS}
          rows={hostelStudentDetails}
          emptyMessage="No student orders recorded for this date."
        />

        {/* ── Overall Remarks ──────────────────────────────────────── */}
        <h3 className={SECTION_TITLE_CLASS}>Overall Remarks</h3>
        <div className="bg-slate-800/50 rounded-xl px-5 py-4 border border-slate-700/30">
          {remarks && remarks.length > 0 ? (
            <ul className="space-y-1.5">
              {remarks.map((remark, i) => (
                <li key={i} className="text-[13px] text-slate-300 flex items-start gap-2">
                  <span className="text-slate-500 mt-0.5">–</span>
                  <span>{remark}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-slate-500">No remarks for this date.</p>
          )}
        </div>
      </div>
    </div>
  );
}
