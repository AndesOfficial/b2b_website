import { useState, useMemo } from 'react';
import { BiRupee } from 'react-icons/bi';
import { FiUsers } from 'react-icons/fi';
import EmptyState from '../EmptyState';

export default function CustomersDashboard({ analytics }) {
  const [activeSubTab, setActiveSubTab] = useState('New');

  const tabs = useMemo(() => [
    { id: 'New', label: `New Users (${analytics.newUsersCount})` },
    { id: 'Active', label: `Active Users (${analytics.activeUsersCount})` },
    { id: 'Retention', label: `Retention Users (${analytics.retentionUsersCount})` },
    { id: 'Lost', label: `Lost Users (${analytics.lostUsersCount})` },
  ], [analytics.newUsersCount, analytics.activeUsersCount, analytics.retentionUsersCount, analytics.lostUsersCount]);

  const data = useMemo(() => {
    switch (activeSubTab) {
      case 'New': return analytics.newUsers;
      case 'Active': return analytics.activeUsersList;
      case 'Retention': return analytics.retentionUsers;
      case 'Lost': return analytics.lostUsers;
      default: return [];
    }
  }, [activeSubTab, analytics.newUsers, analytics.activeUsersList, analytics.retentionUsers, analytics.lostUsers]);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
      <div className="p-6 border-b border-gray-100">
        <h3 className="text-[16px] font-black text-[#0F172A] tracking-tight mb-4">Customer Database</h3>
        
        <div className="flex gap-2 border-b border-gray-100 overflow-x-auto pb-[-1px]">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`px-4 py-2 text-[13px] font-bold transition-all border-b-2 whitespace-nowrap ${
                activeSubTab === tab.id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead className="bg-[#F8FAFC]">
            <tr>
              <th className="text-left text-[11px] font-black text-[#64748B] px-6 py-4 uppercase tracking-[0.1em]">Customer</th>
              <th className="text-left text-[11px] font-black text-[#64748B] px-6 py-4 uppercase tracking-[0.1em]">Contact</th>
              <th className="text-right text-[11px] font-black text-[#64748B] px-6 py-4 uppercase tracking-[0.1em]">Total Orders</th>
              <th className="text-right text-[11px] font-black text-[#64748B] px-6 py-4 uppercase tracking-[0.1em]">Revenue</th>
              <th className="text-right text-[11px] font-black text-[#64748B] px-6 py-4 uppercase tracking-[0.1em]">Last Order</th>
              {activeSubTab === 'New' && <th className="text-right text-[11px] font-black text-[#64748B] px-6 py-4 uppercase tracking-[0.1em]">First Order</th>}
              {activeSubTab === 'Lost' && <th className="text-right text-[11px] font-black text-[#64748B] px-6 py-4 uppercase tracking-[0.1em]">Days Since</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-12">
                  <EmptyState
                    icon={FiUsers}
                    title={`No ${activeSubTab} Users Found`}
                    message="Try adjusting the date range."
                  />
                </td>
              </tr>
            ) : data.map((user, i) => (
              <tr key={user.id || i} className="hover:bg-[#F8FAFC] transition-colors group">
                <td className="px-6 py-4">
                  <p className="text-[14px] font-black text-[#0F172A] tracking-tight">{user.name}</p>
                  {user.address && <p className="text-[10px] text-slate-400 truncate max-w-[200px] mt-0.5">{user.address}</p>}
                </td>
                <td className="px-6 py-4 text-[13px] font-bold text-slate-500">{user.phone}</td>
                <td className="px-6 py-4 text-right text-[13px] font-black text-slate-700">{user.totalOrders}</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-0.5 text-[14px] font-black text-emerald-600 tracking-tight">
                    <BiRupee size={14} />
                    <span>{user.totalRevenue.toLocaleString()}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-right text-[12px] font-bold text-slate-500">{user.lastOrderDate}</td>
                
                {activeSubTab === 'New' && (
                  <td className="px-6 py-4 text-right text-[12px] font-bold text-slate-500">{user.firstOrderDate}</td>
                )}
                {activeSubTab === 'Lost' && (
                  <td className="px-6 py-4 text-right text-[12px] font-bold text-slate-500">
                    <span className="bg-rose-50 text-rose-600 px-2 py-1 rounded-md">{user.daysSinceLastOrder} days</span>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
