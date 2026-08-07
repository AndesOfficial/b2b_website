import { useMemo } from 'react';

/**
 * Extracts a local-date string (YYYY-MM-DD) from a raw timestamp field.
 * Handles Firestore Timestamps (.toDate()), JS Date objects, epoch numbers, and ISO strings.
 */
function toDateString(raw) {
  if (!raw) return null;
  let d;
  if (typeof raw === 'object' && typeof raw.toDate === 'function') {
    d = raw.toDate();
  } else if (raw instanceof Date) {
    d = raw;
  } else if (typeof raw === 'number') {
    d = new Date(raw);
  } else if (typeof raw === 'string') {
    d = new Date(raw);
  } else {
    return null;
  }
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Determines the service display string and weight/count for a B2C order.
 * Uses the serviceBreakdown array built during normalization.
 */
function getServiceInfo(order) {
  const breakdown = order.serviceBreakdown || [];

  if (breakdown.length > 0) {
    const names = breakdown.map(b => b.name).filter(Boolean);
    const totalWeight = breakdown.reduce((sum, b) => sum + (b.weight || 0), 0);
    const totalCount = breakdown.reduce((sum, b) => sum + (b.quantity || 0), 0);

    // Per-service weight display: "1.6 kg + 8.0 kg" for multi-service orders
    const perServiceWeights = breakdown
      .map(b => b.weight > 0 ? `${Number(b.weight).toFixed(1)} kg` : null)
      .filter(Boolean);
    const weightDisplay = perServiceWeights.length > 1
      ? perServiceWeights.join(' + ')
      : null; // single service uses normal weight display

    return {
      service: names.join(' + ') || order.service || 'Regular Service',
      weight: totalWeight || order.weight || 0,
      count: totalCount || order.items || 0,
      weightDisplay,
    };
  }

  return {
    service: order.service || 'Regular Service',
    weight: order.weight || 0,
    count: order.items || 0,
    weightDisplay: null,
  };
}

/**
 * Checks if a status string means the order was picked up (or beyond).
 */
const PICKED_UP_STATUSES = new Set([
  'Processing', 'Confirmed', 'Delivered', 'Pickup Done',
]);

function wasPickedUp(status) {
  return PICKED_UP_STATUSES.has(status)
    || String(status).toLowerCase().includes('picked up')
    || String(status).toLowerCase().includes('at laundry')
    || String(status).toLowerCase().includes('ready for delivery')
    || String(status).toLowerCase().includes('out for delivery')
    || String(status).toLowerCase() === 'completed';
}

const DELIVERED_STATUSES = new Set(['Delivered']);

function wasDelivered(status) {
  return DELIVERED_STATUSES.has(status) || String(status).toLowerCase() === 'completed';
}

const EXCLUDED_STATUSES = new Set(['Cancelled', 'Abandoned', 'cancelled', 'canceled']);

/**
 * useDailyOpsReport
 *
 * @param {Array} allOrders     – merged orders from HostelAuthContext (all types)
 * @param {Array} complaints    – raw documents from the `normal_complaint` collection
 * @param {string} selectedDate – YYYY-MM-DD string
 */
export function useDailyOpsReport(allOrders, complaints, selectedDate) {
  return useMemo(() => {
    // ──────────────────────────────────────────────────────────────────────────
    // B2C ORDERS  (source === 'cartdetails' | 'website' | admin type=regular)
    // ──────────────────────────────────────────────────────────────────────────
    const b2cOrders = allOrders.filter(
      o =>
        (o.source === 'cartdetails' || o.source === 'website' || (o.source === 'admin' && o.type === 'regular'))
        && !EXCLUDED_STATUSES.has(o.status)
        && o.type !== 'abandoned'
        && o.type !== 'rider_tracking'
    );

    // ── Pickup Detection ────────────────────────────────────────────────────
    // An order counts as "picked up on selectedDate" if:
    //   1. Its otpSentAt (pickup OTP timestamp) falls on selectedDate, OR
    //   2. Its createdAt/order date falls on selectedDate AND status >= "picked up"
    const pickupOrders = b2cOrders.filter(o => {
      // Primary: otpSentAt timestamp
      const otpDate = toDateString(o.otpSentAt);
      if (otpDate) {
        return otpDate === selectedDate && wasPickedUp(o.status);
      }

      // Fallback ONLY if otpSentAt is missing
      const orderDate = o.date || toDateString(o.createdAtRaw);
      return orderDate === selectedDate && wasPickedUp(o.status);
    });

    // ── Pending Orders ──────────────────────────────────────────────────────
    // Orders created on selectedDate that are not yet picked up or cancelled
    const pendingOrders = b2cOrders.filter(o => {
      const orderDate = o.date || toDateString(o.createdAtRaw);
      return orderDate === selectedDate && !wasPickedUp(o.status) && !wasDelivered(o.status);
    });

    // ── Delivery Detection ──────────────────────────────────────────────────
    // An order counts as "delivered on selectedDate" if:
    //   1. Its deliveryOtpVerifiedAt falls on selectedDate, OR
    //   2. Its updatedAt falls on selectedDate AND status is "completed"/"delivered"
    const deliveryOrders = b2cOrders.filter(o => {
      if (!wasDelivered(o.status)) return false;

      // Primary: deliveryOtpVerifiedAt
      const deliveryDate = toDateString(o.deliveryOtpVerifiedAt);
      if (deliveryDate) {
        return deliveryDate === selectedDate;
      }

      // Secondary: paymentRecordedAt (payment on delivery)
      const paymentDate = toDateString(o.paymentRecordedAt);
      if (paymentDate) {
        return paymentDate === selectedDate;
      }

      // Fallback: updatedAt
      const updatedDate = toDateString(o.updatedAtRaw);
      return updatedDate === selectedDate;
    });

    // ── Orders Received (new orders placed on this date) ────────────────────
    const ordersReceived = b2cOrders.filter(o => {
      const orderDate = o.date || toDateString(o.createdAtRaw);
      return orderDate === selectedDate;
    });

    // ── Delayed Orders ──────────────────────────────────────────────────────
    // Orders placed on or before selectedDate that should have been completed
    // by now but are still pending/processing
    const delayedOrders = b2cOrders.filter(o => {
      const orderDate = o.date || toDateString(o.createdAtRaw);
      if (!orderDate || orderDate > selectedDate) return false;
      // Only consider orders that were supposed to be handled by selectedDate
      if (orderDate !== selectedDate) return false;
      // Not yet completed
      return !wasDelivered(o.status) && o.status !== 'Cancelled' && wasPickedUp(o.status);
    });

    // ── B2C Revenue ─────────────────────────────────────────────────────────
    // Calculate revenue based on orders received today
    const b2cRevenue = ordersReceived.reduce((sum, o) => sum + (o.amount || 0), 0);

    // ── Payment Breakdown ───────────────────────────────────────────────────
    const allDayOrders = [...new Set([...ordersReceived, ...deliveryOrders])];
    const paymentBreakdown = { cod: 0, online: 0, pending: 0, completed: 0 };
    allDayOrders.forEach(o => {
      const method = String(o.paymentMethod || '').toLowerCase();
      if (method === 'cod' || method === 'cash') {
        paymentBreakdown.cod++;
      } else {
        paymentBreakdown.online++;
      }
      const pStatus = String(o.paymentStatus || '').toLowerCase();
      if (pStatus === 'completed' || pStatus === 'paid' || pStatus === 'success') {
        paymentBreakdown.completed++;
      } else {
        paymentBreakdown.pending++;
      }
    });

    // ── B2C Pickup Details Table ────────────────────────────────────────────
    const b2cPickupDetails = pickupOrders.map(o => {
      const info = getServiceInfo(o);
      return {
        id: o.id,
        customer: o.customerName || 'Unknown',
        service: info.service,
        weight: info.weight,
        weightDisplay: info.weightDisplay,
        count: info.count,
        status: o.status || 'Pending',
        isInstant: o.ultraFastDelivery || false,
      };
    });

    // ── B2C Pending Details Table ──────────────────────────────────────────
    const b2cPendingDetails = pendingOrders.map(o => ({
      id: o.id,
      customer: o.userName || o.customerName || 'Unknown',
      service: getServiceInfo(o).service,
      weightDisplay: getServiceInfo(o).weightDisplay,
      weight: o.weight,
      count: getServiceInfo(o).count,
      status: o.status || 'Pending',
    })).sort((a, b) => b.count - a.count);

    // ── B2C Delivery Details Table ──────────────────────────────────────────
    const b2cDeliveryDetails = deliveryOrders.map(o => {
      const info = getServiceInfo(o);
      return {
        id: o.id,
        customer: o.customerName || 'Unknown',
        service: info.service,
        weight: info.weight,
        weightDisplay: info.weightDisplay,
        count: info.count,
        status: o.status || 'Pending',
      };
    });

    // ── Customer Issues (from normal_complaint collection) ──────────────────
    const dayComplaints = (complaints || []).filter(c => {
      const cDate = toDateString(c.createdAt);
      return cDate === selectedDate;
    });

    const customerIssues = dayComplaints.map(c => ({
      id: c.id,
      userName: c.userName || 'Unknown',
      issue: c.issue || c.description || '',
      category: c.category || 'Other',
      status: c.status || 'open',
      orderId: c.orderId || null,
    }));

    // Also include orders flagged as issues
    const issueOrders = allOrders.filter(o => {
      const orderDate = o.date || toDateString(o.createdAtRaw);
      return orderDate === selectedDate && (o.category === 'ISSUES' || o.type === 'issue');
    });

    const allIssues = [
      ...customerIssues,
      ...issueOrders.map(o => ({
        id: o.id,
        userName: o.customerName || 'Unknown',
        issue: o.service || o.serviceBreakdownSummary || 'Issue reported',
        category: 'Order Issue',
        status: o.status || 'open',
        orderId: o.id,
      })),
    ];

    // ──────────────────────────────────────────────────────────────────────────
    // B2B ORDERS  (hostel orders — source === 'hostels')
    // ──────────────────────────────────────────────────────────────────────────
    const hostelOrders = allOrders.filter(o =>
      (o.source === 'hostels' || o.source === 'b2b' || o.source === 'admin') && o.type === 'student'
    );

    // Hostel deliveries on selectedDate
    const hostelDeliveries = hostelOrders.filter(o => {
      const orderDate = o.date || toDateString(o.createdAtRaw);
      return orderDate === selectedDate;
    });

    // Group by hostel property
    const hostelGroupMap = new Map();
    hostelDeliveries.forEach(o => {
      const hostel = o.property || 'Unknown Hostel';
      if (!hostelGroupMap.has(hostel)) {
        hostelGroupMap.set(hostel, { hostel, weight: 0, clothes: 0, students: 0 });
      }
      const group = hostelGroupMap.get(hostel);
      group.weight += (o.weight || 0);
      group.clothes += (o.items || 0);
      group.students += (o.studentCount || 0);
    });

    const hostelDeliveryDetails = [...hostelGroupMap.values()];
    const hostelsDeliveredNames = hostelDeliveryDetails.map(h => h.hostel);
    const b2bTotalWeight = hostelDeliveryDetails.reduce((sum, h) => sum + h.weight, 0);
    const B2B_RATE_PER_KG = 55;
    
    // Sum the actual amount from the hostel orders instead of deriving from weight
    const b2bRevenue = hostelDeliveries.reduce((sum, o) => sum + (o.amount || 0), 0);

    const b2bDelayed = hostelDeliveries.filter(o =>
      !wasDelivered(o.status) && o.status !== 'Cancelled'
    );

    // Individual student breakdown
    const hostelStudentDetails = hostelDeliveries.map(o => ({
      id: o.id,
      customer: o.userName || o.customerName || 'Unknown',
      room: o.room || '-',
      hostel: o.property || o.hostel || 'Unknown',
      clothes: o.items || o.clothes || 0,
      status: o.status || 'Pending',
    })).sort((a, b) => a.hostel.localeCompare(b.hostel));

    // ── Hostel Issues ───────────────────────────────────────────────────────
    // Orders from hostels flagged as issues or with problems on this date
    const hostelIssueOrders = allOrders.filter(o => {
      const orderDate = o.date || toDateString(o.createdAtRaw);
      return orderDate === selectedDate
        && (o.category === 'ISSUES' || o.type === 'issue')
        && o.source === 'hostels';
    });

    // Check for weight discrepancies (claimedItems vs verifiedItems)
    const weightDiscrepancies = hostelDeliveries.filter(o =>
      o.claimedItems && o.verifiedItems && o.claimedItems !== o.verifiedItems
    );

    const hostelIssuesList = [
      ...hostelIssueOrders.map(o => `${o.customerName || o.property} – ${o.service || 'Issue reported'}`),
      ...weightDiscrepancies.map(o => `${o.property} weight not counted (claimed: ${o.claimedItems}, verified: ${o.verifiedItems})`),
    ];

    // ──────────────────────────────────────────────────────────────────────────
    // B2C SUMMARY
    // ──────────────────────────────────────────────────────────────────────────
    const b2cSummary = {
      totalOrdersReceived: ordersReceived.length,
      totalOrdersDelivered: deliveryOrders.length,
      totalOrdersPickedUp: pickupOrders.filter(o => wasPickedUp(o.status)).length,
      delayedOrders: delayedOrders.length,
      totalRevenue: b2cRevenue,
      customerIssuesCount: allIssues.length,
      customerIssuesText: allIssues.length > 0
        ? allIssues.map(i => `${i.userName} – ${i.issue}`).join('; ')
        : 'None',
      paymentBreakdown,
    };

    // ──────────────────────────────────────────────────────────────────────────
    // B2B SUMMARY
    // ──────────────────────────────────────────────────────────────────────────
    const b2bSummary = {
      hostelsDelivered: hostelsDeliveredNames.length,
      hostelsDeliveredNames,
      totalRevenue: b2bRevenue,
      totalWeight: b2bTotalWeight,
      ratePerKg: B2B_RATE_PER_KG,
      delayedOrders: b2bDelayed.length,
      hostelIssues: hostelIssuesList,
    };

    // ──────────────────────────────────────────────────────────────────────────
    // OVERALL REMARKS (auto-generated)
    // ──────────────────────────────────────────────────────────────────────────
    const remarks = [];

    if (ordersReceived.length > 0 || deliveryOrders.length > 0) {
      remarks.push(
        `B2C operations completed with ${pickupOrders.length} pickup${pickupOrders.length !== 1 ? 's' : ''} and ${deliveryOrders.length} deliver${deliveryOrders.length !== 1 ? 'ies' : 'y'}.`
      );
    } else {
      remarks.push('No B2C orders recorded for this date.');
    }

    if (delayedOrders.length > 0) {
      remarks.push(`${delayedOrders.length} delayed order${delayedOrders.length !== 1 ? 's' : ''} recorded.`);
    }

    if (allIssues.length > 0) {
      remarks.push(`${allIssues.length} customer issue${allIssues.length !== 1 ? 's' : ''} reported.`);
    }

    if (hostelDeliveryDetails.length > 0) {
      remarks.push(
        `B2B deliveries completed for ${hostelsDeliveredNames.join(', ')}${b2bDelayed.length === 0 ? ' without delays' : ''}.`
      );
    } else {
      remarks.push('No B2B hostel deliveries recorded for this date.');
    }

    if (b2bDelayed.length > 0) {
      remarks.push(`${b2bDelayed.length} hostel order${b2bDelayed.length !== 1 ? 's' : ''} delayed.`);
    }

    return {
      b2cSummary,
      b2cPickupDetails,
      b2cPendingDetails,
      b2cDeliveryDetails,
      b2bSummary,
      hostelDeliveryDetails,
      hostelStudentDetails,
      customerIssues: allIssues,
      remarks,
      // Raw counts for KPI cards
      totalB2COrders: ordersReceived.length,
      totalB2BOrders: hostelDeliveries.length,
      combinedRevenue: b2cRevenue + b2bRevenue,
    };
  }, [allOrders, complaints, selectedDate]);
}
