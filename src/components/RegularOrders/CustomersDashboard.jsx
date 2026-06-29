import { useState, useMemo } from 'react';
import { BiRupee } from 'react-icons/bi';
import { FiUsers, FiInfo, FiSearch, FiX } from 'react-icons/fi';
import EmptyState from '../Shared/EmptyState';

export default function CustomersDashboard({ analytics, lookbackLabel }) {
  const [activeSubTab, setActiveSubTab] = useState('New');
  // Fix #9 — search filter across all customer tabs
  const [searchQuery, setSearchQuery] = useState('');

  const tabs = useMemo(() => [
    { id: 'New',       label: `New Users (${analytics.newUsersCount})` },
    { id: 'Active',    label: `Active Users (${analytics.activeUsersCount})` },
    { id: 'Retention', label: `Retention Users (${analytics.retentionUsersCount})` },
    { id: 'Lost',      label: `Lost Users (${analytics.lostUsersCount})` },
  ], [analytics.newUsersCount, analytics.activeUsersCount, analytics.retentionUsersCount, analytics.lostUsersCount]);

  const rawData = useMemo(() => {
    switch (activeSubTab) {
      case 'New':       return analytics.newUsers;
      case 'Active':    return analytics.activeUsersList;
      case 'Retention': return analytics.retentionUsers;
      case 'Lost':      return analytics.lostUsers;
      default:          return [];
    }
  }, [activeSubTab, analytics.newUsers, analytics.activeUsersList, analytics.retentionUsers, analytics.lostUsers]);

  // Apply search filter (name or phone)
  const data = useMemo(() => {
    if (!searchQuery.trim()) return rawData;
    const q = searchQuery.toLowerCase().trim();
    return rawData.filter(user =>
      (user.name || '').toLowerCase().includes(q) ||
      (user.phone || '').toLowerCase().includes(q)
    );
  }, [rawData, searchQuery]);

  // Clear search when switching tabs
  const handleTabChange = (tabId) => {
    setActiveSubTab(tabId);
    setSearchQuery('');
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[16px] font-black text-[#0F172A] tracking-tight">Customer Database</h3>
          {/* Fix #9 — search box */}
          <div className="relative w-56">
            <FiSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search name or phone…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-8 py-2 text-[12px] font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                <FiX size={12} />
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-2 border-b border-gray-100 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
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

        {/* Contextual info banners */}
        {activeSubTab === 'Lost' && (
          <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <FiInfo size={15} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-[12px] text-amber-700 leading-relaxed">
              <span className="font-bold">Lost customers</span> ordered within the{' '}
              <span className="font-bold">{lookbackLabel || 'recent lookback window'}</span> before this
              period, but placed no orders during the selected period.
              Adjust the date range to see a different cohort.
            </p>
          </div>
        )}
        {activeSubTab === 'New' && (
          <div className="mt-3 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <FiInfo size={15} className="text-blue-500 mt-0.5 shrink-0" />
            <p className="text-[12px] text-blue-700 leading-relaxed">
              <span className="font-bold">New customers</span> placed their first ever order during the selected period.
            </p>
          </div>
        )}
        {activeSubTab === 'Retention' && (
          <div className="mt-3 flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
            <FiInfo size={15} className="text-emerald-500 mt-0.5 shrink-0" />
            <p className="text-[12px] text-emerald-700 leading-relaxed">
              <span className="font-bold">Retention customers</span> ordered in both the previous period and the current period — they came back.
            </p>
          </div>
        )}

        {/* Search result count */}
        {searchQuery && (
          <p className="mt-2 text-[11px] font-bold text-slate-400">
            {data.length} result{data.length !== 1 ? 's' : ''} for "{searchQuery}"
          </p>
        )}
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
              {activeSubTab === 'New'  && <th className="text-right text-[11px] font-black text-[#64748B] px-6 py-4 uppercase tracking-[0.1em]">First Order</th>}
              {activeSubTab === 'Lost' && <th className="text-right text-[11px] font-black text-[#64748B] px-6 py-4 uppercase tracking-[0.1em]">Days Since</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-12">
                  <EmptyState
                    icon={FiUsers}
                    title={searchQuery ? `No results for "${searchQuery}"` : `No ${activeSubTab} Users Found`}
                    message={
                      searchQuery
                        ? 'Try a different name or phone number.'
                        : activeSubTab === 'Lost'
                          ? `No customers who ordered in the ${lookbackLabel || 'lookback window'} were absent this period. Great retention!`
                          : 'Try adjusting the date range.'
                    }
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
                  <td className="px-6 py-4 text-right">
                    <span className={`px-2 py-1 rounded-md text-[12px] font-bold ${
                      user.daysSinceLastOrder > 60 ? 'bg-rose-100 text-rose-700' :
                      user.daysSinceLastOrder > 30 ? 'bg-amber-50 text-amber-700' :
                      'bg-orange-50 text-orange-700'
                    }`}>
                      {user.daysSinceLastOrder} days
                    </span>
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
