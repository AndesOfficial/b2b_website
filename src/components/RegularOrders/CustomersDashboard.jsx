import { useState, useMemo, useEffect } from 'react';
import { BiRupee } from 'react-icons/bi';
import { FiUsers, FiInfo, FiSearch, FiX, FiDatabase, FiCalendar, FiPackage, FiChevronRight, FiChevronDown, FiMapPin, FiClock, FiFileText, FiChevronLeft } from 'react-icons/fi';
import EmptyState from '../Shared/EmptyState';

/* ──────────────────────────────────────────────────────────────────────────────
 * CustomerHistoryModal
 * --------------------------------------------------------------------------
 * PURPOSE:  When a user clicks the "totalOrders" frequency badge in the table,
 *           this modal opens and renders a chronological timeline of every order
 *           that customer has ever placed.
 *
 * DATA:     It receives the `user.orders[]` array that was already attached to
 *           the user object by `useRegularAnalytics.js` — NO secondary database
 *           call is made. This is a pure in-memory render.
 *
 * WHY A MODAL (not expandable rows)?  Expandable rows squeeze horizontal space
 *           inside a table that already has 6+ columns. A modal gives us room
 *           for a proper timeline layout, status badges, and channel info.
 * ────────────────────────────────────────────────────────────────────────────── */
function CustomerHistoryModal({ user, onClose }) {
  const [expandedOrderId, setExpandedOrderId] = useState(null);

  if (!user) return null;

  // Sort orders newest → oldest so the most recent activity is always at the top
  const sortedOrders = useMemo(() => {
    if (!user.orders) return [];
    return [...user.orders].sort((a, b) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      return dateB.localeCompare(dateA);
    });
  }, [user.orders]);

  // Group by month for visual separation (e.g., "August 2026", "July 2026")
  const groupedByMonth = useMemo(() => {
    const groups = {};
    sortedOrders.forEach(order => {
      const d = order.date ? new Date(order.date) : null;
      const key = d && !isNaN(d) 
        ? d.toLocaleString('en-US', { month: 'long', year: 'numeric' }) 
        : 'Unknown Date';
      if (!groups[key]) groups[key] = [];
      groups[key].push(order);
    });
    return Object.entries(groups);
  }, [sortedOrders]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-[#0F172A]/50 backdrop-blur-sm" />
      <div 
        className="relative w-full max-w-lg max-h-[85vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[18px] font-black text-[#0F172A] tracking-tight">{user.name}</h2>
              <p className="text-[13px] font-bold text-slate-400 mt-0.5">{user.phone}</p>
            </div>
            <button 
              onClick={onClose} 
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
            >
              <FiX size={20} />
            </button>
          </div>

          {/* Summary KPIs */}
          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-xl">
              <FiPackage size={14} className="text-blue-500" />
              <span className="text-[12px] font-black text-blue-700">{user.totalOrders} Orders</span>
            </div>
            <div className="flex items-center gap-1 px-3 py-2 bg-emerald-50 rounded-xl">
              <BiRupee size={14} className="text-emerald-500" />
              <span className="text-[12px] font-black text-emerald-700">₹{(user.totalRevenue || 0).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl">
              <FiCalendar size={14} className="text-slate-400" />
              <span className="text-[12px] font-black text-slate-600">Since {user.firstOrderDate || '—'}</span>
            </div>
          </div>
        </div>

        {/* Order Timeline — scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          {groupedByMonth.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-300">
              <FiPackage size={32} />
              <p className="text-[13px] font-bold mt-3">No orders found</p>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedByMonth.map(([monthLabel, orders]) => (
                <div key={monthLabel}>
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] mb-3">{monthLabel}</h4>
                  <div className="space-y-2">
                    {orders.map((order, idx) => {
                      const orderKey = order.id || idx;
                      const isExpanded = expandedOrderId === orderKey;
                      
                      return (
                        <div key={orderKey} className="bg-slate-50/70 rounded-xl border border-slate-100 hover:border-blue-200 transition-all overflow-hidden group">
                          <div 
                            onClick={() => setExpandedOrderId(isExpanded ? null : orderKey)}
                            className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-blue-50/30 transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {/* Timeline dot */}
                              <div className="w-2 h-2 rounded-full bg-blue-400 shrink-0 group-hover:bg-blue-600 transition-colors" />
                              <div className="min-w-0">
                                <p className="text-[13px] font-bold text-slate-700">{order.date || 'No date'}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {order.channel && (
                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                      {order.channel}
                                    </span>
                                  )}
                                  {order.status && (
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                      order.status === 'Delivered' || order.status === 'Pickup Done'
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : order.status === 'Cancelled'
                                        ? 'bg-red-100 text-red-700'
                                        : 'bg-amber-100 text-amber-700'
                                    }`}>
                                      {order.status}
                                    </span>
                                  )}
                                  {order.weight > 0 && (
                                    <span className="text-[10px] font-bold text-slate-400">
                                      {order.weight} kg
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 shrink-0">
                              <div className="flex items-center gap-0.5 text-[14px] font-black text-slate-800">
                                <BiRupee size={14} />
                                <span>{(order.amount || 0).toLocaleString('en-IN')}</span>
                              </div>
                              <FiChevronDown 
                                size={16} 
                                className={`text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-blue-500' : 'group-hover:text-blue-400'}`} 
                              />
                            </div>
                          </div>
                          
                          {/* Expanded Details */}
                          {isExpanded && (
                            <div className="px-4 py-3 border-t border-slate-100 bg-white/50 text-[12px] space-y-3">
                              {order.address && (
                                <div className="flex gap-2 text-slate-600">
                                  <FiMapPin size={14} className="mt-0.5 text-slate-400 shrink-0" />
                                  <span>{order.address}</span>
                                </div>
                              )}
                              
                              <div className="grid grid-cols-2 gap-3">
                                {(order.pickupDate || order.deliveryDate) && (
                                  <div className="flex gap-2 text-slate-600">
                                    <FiClock size={14} className="mt-0.5 text-slate-400 shrink-0" />
                                    <div>
                                      {order.pickupDate && <p><span className="text-slate-400">Pickup:</span> {order.pickupDate}</p>}
                                      {order.deliveryDate && <p><span className="text-slate-400">Delivery:</span> {order.deliveryDate}</p>}
                                    </div>
                                  </div>
                                )}
                                
                                {order.service && (
                                  <div className="flex gap-2 text-slate-600">
                                    <FiFileText size={14} className="mt-0.5 text-slate-400 shrink-0" />
                                    <div>
                                      <p className="text-slate-400">Service / Items:</p>
                                      <p className="font-medium text-slate-700">{order.service}</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                              
                              {/* Service Breakdown (if available) */}
                              {order.details && order.details.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-slate-100 border-dashed">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Breakdown</p>
                                  <div className="space-y-1">
                                    {order.details.map((item, i) => (
                                      <div key={i} className="flex justify-between text-slate-600">
                                        <span>{item.name} {item.quantity ? `(x${item.quantity})` : ''} {item.weight ? `(${item.weight}kg)` : ''}</span>
                                        <span className="font-medium">₹{item.amount}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-100 text-[10px] text-slate-400">
                                <span>ID: {order.id || 'N/A'}</span>
                                {order.category && <span>{order.category}</span>}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


/* ──────────────────────────────────────────────────────────────────────────────
 * CustomersDashboard
 * --------------------------------------------------------------------------
 * CHANGES (this update):
 *   1. Added "All Database" tab using analytics.allTimeUsersList
 *   2. Made totalOrders cell a clickable badge that opens CustomerHistoryModal
 *   3. Kept all existing functionality (search, cohort tabs, banners) intact
 * ────────────────────────────────────────────────────────────────────────────── */
export default function CustomersDashboard({ analytics, lookbackLabel }) {
  const [activeSubTab, setActiveSubTab] = useState('New');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState(null); // For the history modal
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const tabs = useMemo(() => [
    { id: 'New',       label: `New Users (${analytics.newUsersCount})` },
    { id: 'Active',    label: `Active Users (${analytics.activeUsersCount})` },
    { id: 'Retention', label: `Retention Users (${analytics.retentionUsersCount})` },
    { id: 'Lost',      label: `Lost Users (${analytics.lostUsersCount})` },
    { id: 'AllDB',     label: `All Database (${analytics.allTimeUsersList?.length || analytics.totalUsersCount || 0})` },
  ], [analytics.newUsersCount, analytics.activeUsersCount, analytics.retentionUsersCount, analytics.lostUsersCount, analytics.allTimeUsersList, analytics.totalUsersCount]);

  const rawData = useMemo(() => {
    switch (activeSubTab) {
      case 'New':       return analytics.newUsers;
      case 'Active':    return analytics.activeUsersList;
      case 'Retention': return analytics.retentionUsers;
      case 'Lost':      return analytics.lostUsers;
      case 'AllDB':     return analytics.allTimeUsersList || [];
      default:          return [];
    }
  }, [activeSubTab, analytics.newUsers, analytics.activeUsersList, analytics.retentionUsers, analytics.lostUsers, analytics.allTimeUsersList]);

  // Apply search filter (name or phone)
  const data = useMemo(() => {
    if (!searchQuery.trim()) return rawData;
    const q = searchQuery.toLowerCase().trim();
    return rawData.filter(user =>
      (user.name || '').toLowerCase().includes(q) ||
      (user.phone || '').toLowerCase().includes(q)
    );
  }, [rawData, searchQuery]);

  // Reset page when data length changes significantly or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeSubTab]);

  const totalPages = Math.ceil(data.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return data.slice(startIndex, startIndex + itemsPerPage);
  }, [data, currentPage]);

  // Clear search when switching tabs
  const handleTabChange = (tabId) => {
    setActiveSubTab(tabId);
    setSearchQuery('');
    setCurrentPage(1);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[16px] font-black text-[#0F172A] tracking-tight">Customer Database</h3>
          {/* Search box */}
          <div className="relative w-56">
            <FiSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search name or phone…"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-8 pr-8 py-2 text-[12px] font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
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
              className={`px-4 py-2 text-[13px] font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
                activeSubTab === tab.id
                  ? tab.id === 'AllDB' 
                    ? "border-violet-600 text-violet-600"
                    : "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.id === 'AllDB' && <FiDatabase size={13} />}
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
        {activeSubTab === 'AllDB' && (
          <div className="mt-3 flex items-start gap-2 bg-violet-50 border border-violet-200 rounded-xl px-4 py-3">
            <FiDatabase size={15} className="text-violet-500 mt-0.5 shrink-0" />
            <p className="text-[12px] text-violet-700 leading-relaxed">
              <span className="font-bold">All Database</span> — Every customer who has ever placed an order, regardless of date filter.
              Use the search bar to find anyone by name or phone number. Click any row to see full order history.
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
              {activeSubTab === 'AllDB' && <th className="text-right text-[11px] font-black text-[#64748B] px-6 py-4 uppercase tracking-[0.1em]">First Order</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-12">
                  <EmptyState
                    icon={FiUsers}
                    title={searchQuery ? `No results for "${searchQuery}"` : `No ${activeSubTab === 'AllDB' ? '' : activeSubTab} Users Found`}
                    message={
                      searchQuery
                        ? 'Try a different name or phone number.'
                        : activeSubTab === 'Lost'
                          ? `No customers who ordered in the ${lookbackLabel || 'lookback window'} were absent this period. Great retention!`
                          : activeSubTab === 'AllDB'
                            ? 'No customers in the database yet.'
                            : 'Try adjusting the date range.'
                    }
                  />
                </td>
              </tr>
            ) : paginatedData.map((user, i) => (
              <tr 
                key={user.id || i} 
                onClick={() => setSelectedUser(user)}
                className="hover:bg-blue-50/60 transition-colors group cursor-pointer"
              >
                <td className="px-6 py-4">
                  <p className="text-[14px] font-black text-[#0F172A] tracking-tight group-hover:text-blue-700 transition-colors">{user.name}</p>
                  {user.address && <p className="text-[10px] text-slate-400 truncate max-w-[200px] mt-0.5">{user.address}</p>}
                </td>
                <td className="px-6 py-4 text-[13px] font-bold text-slate-500">{user.phone}</td>
                {/* ── Frequency badge (visual indicator, row click handles action) ── */}
                <td className="px-6 py-4 text-right">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 text-[13px] font-black border border-blue-100 group-hover:bg-blue-100 group-hover:border-blue-200 transition-all">
                    {user.totalOrders}
                    <FiChevronRight size={12} className="text-blue-400 group-hover:text-blue-600 transition-colors" />
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-0.5 text-[14px] font-black text-emerald-600 tracking-tight">
                    <BiRupee size={14} />
                    <span>{(user.totalRevenue || 0).toLocaleString()}</span>
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
                {activeSubTab === 'AllDB' && (
                  <td className="px-6 py-4 text-right text-[12px] font-bold text-slate-500">{user.firstOrderDate}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
            <p className="text-[12px] font-bold text-slate-500">
              Showing <span className="text-slate-700">{((currentPage - 1) * itemsPerPage) + 1}</span> to <span className="text-slate-700">{Math.min(currentPage * itemsPerPage, data.length)}</span> of <span className="text-slate-700">{data.length}</span> entries
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-white hover:text-blue-600 disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-slate-500 transition-colors"
              >
                <FiChevronLeft size={16} />
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  // Show pages around current page
                  let pageNum = currentPage;
                  if (totalPages <= 5) pageNum = i + 1;
                  else if (currentPage <= 3) pageNum = i + 1;
                  else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                  else pageNum = currentPage - 2 + i;

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-[12px] font-black transition-colors ${
                        currentPage === pageNum 
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                          : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-blue-600'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-white hover:text-blue-600 disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-slate-500 transition-colors"
              >
                <FiChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Customer History Modal — rendered when a user's frequency badge is clicked */}
      {selectedUser && (
        <CustomerHistoryModal user={selectedUser} onClose={() => setSelectedUser(null)} />
      )}
    </div>
  );
}
