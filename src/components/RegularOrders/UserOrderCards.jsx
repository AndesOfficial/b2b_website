import { FiActivity, FiAlertTriangle, FiClock, FiRepeat, FiShoppingBag, FiUserCheck, FiUserPlus, FiUsers, FiXCircle } from "react-icons/fi";

function Card({ title, value, hint, icon: Icon, color, bg, suffix }) {
  return (
    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-start hover:shadow-md transition-shadow">
      <div className={`p-2 rounded-lg ${bg} ${color} mb-3`}>
        <Icon size={18} />
      </div>
      <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
      <div className="flex items-center gap-1">
        <span className="text-xl font-black text-[#0F172A] tracking-tight">
          {typeof value === "number" ? value.toLocaleString("en-IN") : value}
        </span>
        {suffix && <span className="text-[11px] font-bold text-slate-400">{suffix}</span>}
      </div>
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

function Group({ title, children }) {
  return (
    <div>
      <h3 className="mb-3 text-[13px] font-black uppercase tracking-[0.15em] text-slate-500">{title}</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">{children}</div>
    </div>
  );
}

const oneDecimal = (n) => (Number.isFinite(n) ? n.toFixed(1) : "—");

export default function UserOrderCards({ analytics, registeredUserIds }) {
  const registered = registeredUserIds ? registeredUserIds.size : null;
  let activeRegistered = 0;
  if (registeredUserIds) {
    for (const id of analytics.activeAppUserIds) if (registeredUserIds.has(id)) activeRegistered += 1;
  }
  const dormant = registered === null ? null : registered - activeRegistered;

  const orders = analytics.totalOrdersCount; // non-cancelled orders in the period
  const totalKg = analytics.currentKg;
  const avgKgPerOrder = orders > 0 ? totalKg / orders : NaN;
  const avgKgPerUser = analytics.activeUsersCount > 0 ? totalKg / analytics.activeUsersCount : NaN;

  return (
    <div className="space-y-6">
      <Group title="Users">
        <Card title="Total Users" value={analytics.totalUsersCount} hint="Unique customers who have ordered at least once" icon={FiUsers} color="text-blue-600" bg="bg-blue-50" />
        <Card title="Registered Users" value={registered ?? "…"} hint="Registered on the Andes app" icon={FiUserPlus} color="text-purple-600" bg="bg-purple-50" />
        <Card title="Active Users" value={analytics.activeUsersCount} hint="Ordered in the selected period" icon={FiUserCheck} color="text-emerald-600" bg="bg-emerald-50" />
        <Card title="Dormant Users" value={dormant ?? "…"} hint="Registered, no order in the selected period" icon={FiAlertTriangle} color="text-orange-600" bg="bg-orange-50" />
      </Group>

      <Group title="Orders">
        <Card title="Total Orders" value={analytics.placedOrdersCount} hint="Placed in the period, incl. cancelled" icon={FiShoppingBag} color="text-amber-600" bg="bg-amber-50" />
        <Card title="Active Orders" value={analytics.overviewActiveCount} hint="Not yet delivered or cancelled" icon={FiClock} color="text-sky-600" bg="bg-sky-50" />
        <Card title="Rescheduled Orders" value={analytics.overviewRescheduledCount} icon={FiRepeat} color="text-indigo-600" bg="bg-indigo-50" />
        <Card title="Cancelled Orders" value={analytics.overviewCancelledCount} icon={FiXCircle} color="text-rose-600" bg="bg-rose-50" />
        <Card title="Total KG" value={oneDecimal(totalKg)} suffix=" KG" hint="Excludes cancelled orders" icon={FiActivity} color="text-cyan-600" bg="bg-cyan-50" />
        <Card title="Avg KG / Order" value={oneDecimal(avgKgPerOrder)} suffix=" KG" hint="Total KG ÷ non-cancelled orders" icon={FiActivity} color="text-cyan-600" bg="bg-cyan-50" />
        <Card title="Avg KG / User" value={oneDecimal(avgKgPerUser)} suffix=" KG" hint="Total KG ÷ active users" icon={FiUsers} color="text-cyan-600" bg="bg-cyan-50" />
      </Group>
    </div>
  );
}
