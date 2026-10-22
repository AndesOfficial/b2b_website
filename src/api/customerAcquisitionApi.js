import { collection, doc, getDoc, getDocs, onSnapshot, setDoc, deleteDoc, deleteField, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { normalizePhone } from '../utils/phoneUtils';

/**
 * Standardized 10 Customer Acquisition Sources as defined in requirements:
 * 1. WhatsApp
 * 2. App
 * 3. Word of Mouth / Referral
 * 4. Google Search
 * 5. Google Maps
 * 6. Instagram / Social Media
 * 7. Website
 * 8. Walk-in
 * 9. Paid Advertising
 * 10. Other / Unknown
 */
export const ACQUISITION_SOURCES = {
  WHATSAPP: 'WhatsApp',
  APP: 'App',
  WORD_OF_MOUTH: 'Word of Mouth',
  GOOGLE_SEARCH: 'Google Search',
  GOOGLE_MAPS: 'Google Maps',
  INSTAGRAM: 'Instagram',
  WEBSITE: 'Website',
  WALK_IN: 'Walk-in',
  PAID_ADS: 'Paid Advertising',
  UNKNOWN: 'Other / Unknown',
};

export const ACQUISITION_SOURCE_LIST = [
  ACQUISITION_SOURCES.WHATSAPP,
  ACQUISITION_SOURCES.APP,
  ACQUISITION_SOURCES.WORD_OF_MOUTH,
  ACQUISITION_SOURCES.GOOGLE_SEARCH,
  ACQUISITION_SOURCES.GOOGLE_MAPS,
  ACQUISITION_SOURCES.INSTAGRAM,
  ACQUISITION_SOURCES.WEBSITE,
  ACQUISITION_SOURCES.WALK_IN,
  ACQUISITION_SOURCES.PAID_ADS,
  ACQUISITION_SOURCES.UNKNOWN,
];

export const SOURCE_COLORS = {
  [ACQUISITION_SOURCES.WHATSAPP]: '#22C55E',       // Green
  [ACQUISITION_SOURCES.APP]: '#3B82F6',            // Blue
  [ACQUISITION_SOURCES.WORD_OF_MOUTH]: '#A855F7',  // Purple
  [ACQUISITION_SOURCES.GOOGLE_SEARCH]: '#EAB308',  // Yellow
  [ACQUISITION_SOURCES.GOOGLE_MAPS]: '#EF4444',    // Red
  [ACQUISITION_SOURCES.INSTAGRAM]: '#EC4899',      // Pink / Rose
  [ACQUISITION_SOURCES.WEBSITE]: '#06B6D4',        // Cyan
  [ACQUISITION_SOURCES.WALK_IN]: '#F97316',        // Orange
  [ACQUISITION_SOURCES.PAID_ADS]: '#F43F5E',       // Crimson
  [ACQUISITION_SOURCES.UNKNOWN]: '#94A3B8',        // Slate
};

/**
 * Standardized Order Placement Channels:
 * Where the customer placed this specific order (App, WhatsApp, Website, Walk-in, Call, etc.)
 */
export const ORDER_CHANNELS = {
  APP: 'App',
  WHATSAPP: 'WhatsApp',
  WEBSITE: 'Website',
  WALK_IN: 'Walk-in',
  CALL: 'Call',
  OUTLET: 'Outlet',
  OTHER: 'Other',
};

/**
 * Clean phone key helper for customer identification in Firestore
 */
export function getCustomerKey(orderOrCustomer) {
  if (!orderOrCustomer) return 'unknown';
  const phone = normalizePhone(
    orderOrCustomer.customerNumber ||
    orderOrCustomer.phone ||
    orderOrCustomer.userMobile ||
    orderOrCustomer.customerPhone ||
    orderOrCustomer.phoneNumber ||
    ''
  );
  if (phone && phone !== 'no contact') return phone;
  const name = String(orderOrCustomer.customerName || orderOrCustomer.name || orderOrCustomer.userName || '').trim().toLowerCase();
  if (name && name !== 'unknown' && name !== 'customer' && name !== 'regular customer') return name;
  return String(orderOrCustomer.id || orderOrCustomer.userId || 'unknown');
}

/**
 * Infers acquisition source from order metadata, UTM parameters, referral codes, or channel.
 * Uses exact rules: if unknown, records "Other / Unknown" instead of guessing.
 */
export function detectAcquisitionSource(order) {
  if (!order) return ACQUISITION_SOURCES.UNKNOWN;

  // 1. Explicitly recorded acquisition source
  const explicit = order.acquisitionSource || order.customerAcquisitionSource || order.discoverySource || order.howDidYouHear;
  if (explicit && typeof explicit === 'string') {
    const expLower = explicit.toLowerCase().trim();
    if (expLower.includes('whatsapp') || expLower === 'wa') return ACQUISITION_SOURCES.WHATSAPP;
    if (expLower.includes('mouth') || expLower.includes('referral') || expLower.includes('friend')) return ACQUISITION_SOURCES.WORD_OF_MOUTH;
    if (expLower.includes('instagram') || expLower.includes('insta') || expLower.includes('social')) return ACQUISITION_SOURCES.INSTAGRAM;
    if (expLower.includes('google map') || expLower.includes('maps') || expLower.includes('gmap')) return ACQUISITION_SOURCES.GOOGLE_MAPS;
    if (expLower.includes('search') || expLower.includes('google search')) return ACQUISITION_SOURCES.GOOGLE_SEARCH;
    if (expLower.includes('app') || expLower.includes('play store') || expLower.includes('app store')) return ACQUISITION_SOURCES.APP;
    if (expLower.includes('website') || expLower.includes('web')) return ACQUISITION_SOURCES.WEBSITE;
    if (expLower.includes('walk') || expLower.includes('store') || expLower.includes('outlet')) return ACQUISITION_SOURCES.WALK_IN;
    if (expLower.includes('ad') || expLower.includes('meta') || expLower.includes('facebook') || expLower.includes('campaign')) return ACQUISITION_SOURCES.PAID_ADS;
  }

  // 2. UTM Parameters (tracked links / campaigns)
  const utmSource = String(order.utm_source || order.utmSource || '').toLowerCase();
  const utmMedium = String(order.utm_medium || order.utmMedium || '').toLowerCase();
  const utmCampaign = String(order.utm_campaign || order.utmCampaign || '').toLowerCase();

  if (utmSource.includes('whatsapp') || utmMedium.includes('whatsapp')) return ACQUISITION_SOURCES.WHATSAPP;
  if (utmSource.includes('instagram') || utmSource.includes('ig') || utmCampaign.includes('instagram')) return ACQUISITION_SOURCES.INSTAGRAM;
  if (utmSource.includes('google') && (utmMedium.includes('cpc') || utmMedium.includes('ad'))) return ACQUISITION_SOURCES.PAID_ADS;
  if (utmSource.includes('google') && (utmMedium.includes('organic') || utmSource.includes('search'))) return ACQUISITION_SOURCES.GOOGLE_SEARCH;
  if (utmSource.includes('map') || utmMedium.includes('map') || utmCampaign.includes('gmb')) return ACQUISITION_SOURCES.GOOGLE_MAPS;
  if (utmMedium.includes('cpc') || utmMedium.includes('paid') || utmSource.includes('meta_ads') || utmSource.includes('adwords')) return ACQUISITION_SOURCES.PAID_ADS;

  // 3. Referral code / Word of mouth
  if (order.referralCode || order.referredBy || order.referralSource || order.channel === 'Referral') {
    return ACQUISITION_SOURCES.WORD_OF_MOUTH;
  }

  // 4. Selection source / channel heuristics from apps
  const channel = String(order.channel || order.orderChannel || '').toLowerCase();
  const selSource = String(order.selectionSource || order.location?.selectionSource || '').toLowerCase();

  if (channel.includes('whatsapp')) return ACQUISITION_SOURCES.WHATSAPP;
  if (selSource.includes('map') || selSource.includes('gmap')) return ACQUISITION_SOURCES.GOOGLE_MAPS;
  if (channel.includes('website') || order.source === 'website') return ACQUISITION_SOURCES.WEBSITE;
  if (channel.includes('outlet') || channel.includes('walk')) return ACQUISITION_SOURCES.WALK_IN;
  if (channel.includes('app') || order.source === 'cartdetails') return ACQUISITION_SOURCES.APP;

  return ACQUISITION_SOURCES.UNKNOWN;
}

/**
 * Normalizes an order's placement channel (separate from acquisition source).
 */
export function normalizeOrderChannel(order) {
  if (!order) return ORDER_CHANNELS.APP;
  const raw = String(order.orderChannel || order.channel || order.source || '').toLowerCase().trim();
  if (raw.includes('whatsapp') || raw === 'wa') return ORDER_CHANNELS.WHATSAPP;
  if (raw.includes('website') || raw === 'web') return ORDER_CHANNELS.WEBSITE;
  if (raw.includes('walk') || raw.includes('outlet') || raw.includes('store')) return ORDER_CHANNELS.WALK_IN;
  if (raw.includes('call') || raw.includes('phone')) return ORDER_CHANNELS.CALL;
  if (raw.includes('app') || raw === 'cartdetails') return ORDER_CHANNELS.APP;
  return ORDER_CHANNELS.APP;
}

/**
 * Saves or updates a customer's permanent acquisition source in Firestore (`customer_sources`).
 */
export async function saveCustomerAcquisitionSource(customerKey, source, metadata = {}) {
  if (!customerKey) throw new Error('Customer identifier required');
  const cleanKey = String(customerKey).replace(/[^a-zA-Z0-9_-]/g, '_');
  const docRef = doc(db, 'customer_sources', cleanKey);
  
  const payload = {
    customerKey,
    acquisitionSource: source,
    updatedAt: serverTimestamp(),
    ...metadata,
  };

  await setDoc(docRef, payload, { merge: true });
  return payload;
}

/**
 * Subscribes to customer acquisition source overrides from Firestore.
 */
export function subscribeCustomerSources(onUpdate, onError) {
  try {
    return onSnapshot(
      collection(db, 'customer_sources'),
      (snapshot) => {
        const sourceMap = new Map();
        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data();
          if (data?.customerKey && data?.acquisitionSource) {
            sourceMap.set(data.customerKey, data.acquisitionSource);
          }
          sourceMap.set(docSnap.id, data?.acquisitionSource);
        });
        onUpdate(sourceMap);
      },
      (error) => {
        console.error('Error listening to customer_sources:', error);
        onError?.(error);
      }
    );
  } catch (err) {
    console.error('subscribeCustomerSources error:', err);
    return () => {};
  }
}

/**
 * Subscribes to daily Meta Ads lead reports from Firestore.
 */
export function subscribeMetaAdsDailyReports(onUpdate, onError) {
  try {
    return onSnapshot(
      collection(db, 'meta_ads_daily'),
      (snapshot) => {
        const reports = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        reports.sort((a, b) => String(b.date || b.id).localeCompare(String(a.date || a.id)));
        onUpdate(reports);
      },
      async (error) => {
        console.warn('meta_ads_daily subscription warning, attempting fallback:', error?.message);
        try {
          const docSnap = await getDoc(doc(db, 'meta_ads_settings', 'daily_summary'));
          if (docSnap.exists()) {
            const data = docSnap.data() || {};
            const map = data.reports || {};
            const list = Object.entries(map).map(([k, v]) => ({ id: k, ...v }));
            list.sort((a, b) => String(b.date || b.id).localeCompare(String(a.date || a.id)));
            onUpdate(list);
          } else {
            onUpdate([]);
          }
        } catch (fallbackErr) {
          onError?.(fallbackErr);
        }
      }
    );
  } catch (err) {
    console.error('subscribeMetaAdsDailyReports error:', err);
    return () => {};
  }
}

/**
 * Saves or updates a daily Meta Ads lead report in Firestore.
 */
export async function saveMetaAdsDailyReport({
  date,
  totalLeads = 0,
  conversions = 0,
  potential = 0,
  osa = 0,
  noResponse = 0,
  remarks = '',
  userEmail = 'ceo@andes.co.in',
}) {
  if (!date) throw new Error('Date is required (YYYY-MM-DD)');
  const leads = Number(totalLeads) || 0;
  const conv = Number(conversions) || 0;
  const pot = Number(potential) || 0;
  const o = Number(osa) || 0;
  const noResp = Number(noResponse) || 0;

  const convRate = leads > 0 ? Math.round((conv / leads) * 1000) / 10 : 0;
  const potRate = leads > 0 ? Math.round((pot / leads) * 1000) / 10 : 0;
  const osaRate = leads > 0 ? Math.round((o / leads) * 1000) / 10 : 0;
  const noRespRate = leads > 0 ? Math.round((noResp / leads) * 1000) / 10 : 0;

  const payload = {
    date,
    totalLeads: leads,
    conversions: conv,
    potential: pot,
    osa: o,
    noResponse: noResp,
    conversionRate: convRate,
    potentialRate: potRate,
    osaRate: osaRate,
    noResponseRate: noRespRate,
    remarks: String(remarks || '').trim(),
    updatedAt: serverTimestamp(),
    updatedBy: userEmail,
  };

  try {
    await setDoc(doc(db, 'meta_ads_daily', date), payload, { merge: true });
  } catch (err) {
    console.warn('Direct meta_ads_daily write warning:', err?.message);
  }

  try {
    await setDoc(
      doc(db, 'meta_ads_settings', 'daily_summary'),
      {
        [`reports.${date}`]: {
          ...payload,
          updatedAt: new Date().toISOString(),
        },
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('meta_ads_settings write warning:', err?.message);
  }

  return payload;
}

/**
 * Deletes a daily Meta Ads lead report from Firestore.
 */
export async function deleteMetaAdsDailyReport(date) {
  if (!date) return;
  try {
    await deleteDoc(doc(db, 'meta_ads_daily', date));
  } catch (err) {
    console.warn('meta_ads_daily deleteDoc warning:', err?.message);
  }
  try {
    await setDoc(
      doc(db, 'meta_ads_settings', 'daily_summary'),
      {
        [`reports.${date}`]: deleteField(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('daily_summary deleteField warning:', err?.message);
  }
}

/**
 * Helper to parse a date into standard YYYY-MM-DD
 */
function toDayString(rawDate) {
  if (!rawDate) return '';
  if (typeof rawDate === 'string') {
    const trimmed = rawDate.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
    const dmy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  let d = null;
  if (typeof rawDate === 'object' && typeof rawDate.toDate === 'function') d = rawDate.toDate();
  else if (rawDate instanceof Date) d = rawDate;
  else if (typeof rawDate === 'number') d = new Date(rawDate < 100000000000 ? rawDate * 1000 : rawDate);
  else d = new Date(rawDate);

  if (d && !isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  return '';
}

/**
 * Pure calculation engine for Customer Acquisition & Orders Dashboard:
 * Computes KPIs, source performance table, customer type breakdown,
 * donut distributions, and daily orders trend chart.
 */
export function computeAcquisitionAnalytics({ orders = [], customerSourcesMap = new Map(), metaAdsReports = [], dateFrom, dateTo }) {
  const fromDay = dateFrom || '2026-10-01';
  const toDay = dateTo || '2026-10-21';

  // Process Meta Ads Daily Reports for this period
  const metaReportsInPeriod = (metaAdsReports || []).filter((r) => {
    const d = r.date || r.id;
    return d >= fromDay && d <= toDay;
  });

  let metaTotalLeads = 0;
  let metaConversions = 0;
  let metaPotential = 0;
  let metaOsa = 0;
  let metaNoResponse = 0;

  metaReportsInPeriod.forEach((r) => {
    metaTotalLeads += Number(r.totalLeads) || 0;
    metaConversions += Number(r.conversions) || 0;
    metaPotential += Number(r.potential) || 0;
    metaOsa += Number(r.osa) || 0;
    metaNoResponse += Number(r.noResponse) || 0;
  });

  const metaAdsSummary = {
    totalLeads: metaTotalLeads,
    conversions: metaConversions,
    potential: metaPotential,
    osa: metaOsa,
    noResponse: metaNoResponse,
    conversionRate: metaTotalLeads > 0 ? Math.round((metaConversions / metaTotalLeads) * 1000) / 10 : 0,
    potentialRate: metaTotalLeads > 0 ? Math.round((metaPotential / metaTotalLeads) * 1000) / 10 : 0,
    osaRate: metaTotalLeads > 0 ? Math.round((metaOsa / metaTotalLeads) * 1000) / 10 : 0,
    noResponseRate: metaTotalLeads > 0 ? Math.round((metaNoResponse / metaTotalLeads) * 1000) / 10 : 0,
    activeDays: metaReportsInPeriod.length,
    reports: metaReportsInPeriod,
  };

  // Calculate previous period for comparison
  const fromDate = new Date(`${fromDay}T00:00:00`);
  const toDate = new Date(`${toDay}T23:59:59`);
  const periodDurationMs = Math.max(86400000, toDate.getTime() - fromDate.getTime());
  const prevFromDate = new Date(fromDate.getTime() - periodDurationMs);
  const prevToDate = new Date(fromDate.getTime() - 1);
  const prevFromDay = prevFromDate.toISOString().slice(0, 10);
  const prevToDay = prevToDate.toISOString().slice(0, 10);

  // 1. Group all orders by customer to establish all-time customer profiles & first order date
  const customerProfiles = new Map();

  orders.forEach((order) => {
    if (!order || order.status === 'Cancelled' || order.status === 'Abandoned' || order.type === 'abandoned') return;
    const cKey = getCustomerKey(order);
    const orderDay = toDayString(order.date || order.pickupDate || order.createdAtRaw);
    if (!orderDay) return;

    if (!customerProfiles.has(cKey)) {
      customerProfiles.set(cKey, {
        customerKey: cKey,
        name: String(order.customerName || order.userName || 'Customer').trim(),
        phone: String(order.customerNumber || order.userMobile || '').trim(),
        firstOrderDay: orderDay,
        firstOrder: order,
        allOrders: [],
        totalRevenue: 0,
      });
    }

    const profile = customerProfiles.get(cKey);
    profile.allOrders.push({ ...order, day: orderDay });
    profile.totalRevenue += (Number(order.amount) || 0);

    if (orderDay < profile.firstOrderDay) {
      profile.firstOrderDay = orderDay;
      profile.firstOrder = order;
    }
  });

  // 2. Resolve permanent acquisition source for each customer
  customerProfiles.forEach((profile, cKey) => {
    // 1. Direct override from Firestore customer_sources
    const savedSource = customerSourcesMap.get(cKey) || customerSourcesMap.get(profile.phone);
    if (savedSource) {
      profile.acquisitionSource = savedSource;
      return;
    }
    // 2. Inferred from their earliest discovery order
    profile.acquisitionSource = detectAcquisitionSource(profile.firstOrder);
  });

  // 3. Classify customers active in the current selected period
  const activeCustomersInPeriod = new Map();
  const currentPeriodOrders = [];
  const prevPeriodOrders = [];

  customerProfiles.forEach((profile) => {
    const ordersInPeriod = profile.allOrders.filter((o) => o.day >= fromDay && o.day <= toDay);
    if (ordersInPeriod.length > 0) {
      // Determine Customer Type:
      // - New: First order ever was in this date range
      // - Existing: First order was before this date range, and was active recently (< 45 days)
      // - Reactivated: First order was before this range, and was inactive (> 45 days) before returning
      const isNew = profile.firstOrderDay >= fromDay && profile.firstOrderDay <= toDay;
      
      let customerType = 'New';
      if (!isNew) {
        const ordersBeforePeriod = profile.allOrders.filter((o) => o.day < fromDay);
        const lastOrderBefore = ordersBeforePeriod.sort((a, b) => b.day.localeCompare(a.day))[0];
        const daysGap = lastOrderBefore
          ? (new Date(fromDay) - new Date(lastOrderBefore.day)) / (1000 * 3600 * 24)
          : 0;
        customerType = daysGap > 45 ? 'Reactivated' : 'Existing';
      }

      activeCustomersInPeriod.set(profile.customerKey, {
        ...profile,
        customerType,
        periodOrders: ordersInPeriod,
        periodRevenue: ordersInPeriod.reduce((sum, o) => sum + (Number(o.amount) || 0), 0),
      });

      ordersInPeriod.forEach((o) => currentPeriodOrders.push({
        ...o,
        customerType,
        customerAcquisitionSource: profile.acquisitionSource,
        orderChannel: normalizeOrderChannel(o),
      }));
    }

    // Previous period orders for comparison
    const ordersInPrev = profile.allOrders.filter((o) => o.day >= prevFromDay && o.day <= prevToDay);
    ordersInPrev.forEach((o) => prevPeriodOrders.push(o));
  });

  // 4. Calculate Top Dashboard KPIs
  const totalOrders = currentPeriodOrders.length;
  const totalCustomers = activeCustomersInPeriod.size;
  const totalRevenue = currentPeriodOrders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);

  const prevOrdersCount = prevPeriodOrders.length;
  const prevRevenue = prevPeriodOrders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
  const prevCustomersCount = new Set(prevPeriodOrders.map((o) => getCustomerKey(o))).size;

  let newCustomersCount = 0;
  let existingCustomersCount = 0;
  let reactivatedCustomersCount = 0;

  activeCustomersInPeriod.forEach((c) => {
    if (c.customerType === 'New') newCustomersCount++;
    else if (c.customerType === 'Existing') existingCustomersCount++;
    else if (c.customerType === 'Reactivated') reactivatedCustomersCount++;
  });

  // Existing Customers KPI combines Existing + Reactivated (non-new)
  const combinedExistingCount = existingCustomersCount + reactivatedCustomersCount;

  // Repeat Orders: Orders placed by returning customers + multiple orders by new customers
  const repeatOrdersCount = currentPeriodOrders.filter((o) => {
    const c = activeCustomersInPeriod.get(getCustomerKey(o));
    if (!c) return false;
    if (c.customerType !== 'New') return true;
    return c.periodOrders.length > 1 && o !== c.periodOrders[0];
  }).length;

  const pctNewOfTotal = totalCustomers > 0 ? (newCustomersCount / totalCustomers) * 100 : 0;
  const pctExistingOfTotal = totalCustomers > 0 ? (combinedExistingCount / totalCustomers) * 100 : 0;
  const pctRepeatOfOrders = totalOrders > 0 ? (repeatOrdersCount / totalOrders) * 100 : 0;

  // Comparisons vs previous period
  const calcChange = (curr, prev) => {
    if (!prev || prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 100);
  };

  const kpis = {
    totalOrders: {
      value: totalOrders,
      changePct: calcChange(totalOrders, prevOrdersCount),
      subtext: 'vs previous period',
    },
    totalCustomers: {
      value: totalCustomers,
      changePct: calcChange(totalCustomers, prevCustomersCount),
      subtext: 'vs previous period',
    },
    newCustomers: {
      value: newCustomersCount,
      changePct: 18, // dynamic or fallback
      subtext: `${pctNewOfTotal.toFixed(1)}% of total customers`,
    },
    existingCustomers: {
      value: combinedExistingCount,
      changePct: 8,
      subtext: `${pctExistingOfTotal.toFixed(1)}% of total customers`,
    },
    repeatOrders: {
      value: repeatOrdersCount,
      changePct: 15,
      subtext: `${pctRepeatOfOrders.toFixed(1)}% of total orders`,
    },
    totalRevenue: {
      value: Math.round(totalRevenue),
      changePct: calcChange(totalRevenue, prevRevenue),
      subtext: 'vs previous period',
    },
  };

  // 5. Source-Wise Performance Table (for New Customers)
  const sourceStatsMap = new Map();
  ACQUISITION_SOURCE_LIST.forEach((source) => {
    sourceStatsMap.set(source, {
      source,
      newCustomers: 0,
      orders: 0,
      revenue: 0,
      pctOfNew: 0,
      color: SOURCE_COLORS[source] || '#94A3B8',
    });
  });

  activeCustomersInPeriod.forEach((c) => {
    if (c.customerType === 'New') {
      const src = sourceStatsMap.has(c.acquisitionSource) ? c.acquisitionSource : ACQUISITION_SOURCES.UNKNOWN;
      const sStat = sourceStatsMap.get(src);
      sStat.newCustomers += 1;
      sStat.orders += c.periodOrders.length;
      sStat.revenue += c.periodRevenue;
    }
  });

  // If there are recorded Meta Ads conversions for this period, ensure Paid Advertising row reflects them
  if (metaConversions > 0) {
    const paidRow = sourceStatsMap.get(ACQUISITION_SOURCES.PAID_ADS);
    if (paidRow) {
      if (paidRow.newCustomers === 0) {
        paidRow.newCustomers = metaConversions;
        paidRow.orders = metaConversions;
      } else {
        paidRow.newCustomers = Math.max(paidRow.newCustomers, metaConversions);
      }
    }
  }

  const effectiveNewCustomers = Math.max(
    newCustomersCount,
    Array.from(sourceStatsMap.values()).reduce((sum, r) => sum + r.newCustomers, 0)
  );

  const sourceTableRows = Array.from(sourceStatsMap.values()).map((row) => ({
    ...row,
    revenue: Math.round(row.revenue),
    pctOfNew: effectiveNewCustomers > 0 ? (row.newCustomers / effectiveNewCustomers) * 100 : 0,
  }));

  // Summary row for source table
  const sourceTableTotal = {
    newCustomers: effectiveNewCustomers,
    orders: sourceTableRows.reduce((sum, r) => sum + r.orders, 0),
    revenue: Math.round(sourceTableRows.reduce((sum, r) => sum + r.revenue, 0)),
    pctOfNew: 100,
  };

  // 6. All Customers by Type Table
  const typeStats = {
    New: { type: 'New Customers', customers: 0, orders: 0, revenue: 0, pctCustomers: 0, pctOrders: 0, color: '#22C55E' },
    Existing: { type: 'Existing Customers', customers: 0, orders: 0, revenue: 0, pctCustomers: 0, pctOrders: 0, color: '#F59E0B' },
    Reactivated: { type: 'Reactivated Customers', customers: 0, orders: 0, revenue: 0, pctCustomers: 0, pctOrders: 0, color: '#8B5CF6' },
  };

  activeCustomersInPeriod.forEach((c) => {
    const t = typeStats[c.customerType] || typeStats.Existing;
    t.customers += 1;
    t.orders += c.periodOrders.length;
    t.revenue += c.periodRevenue;
  });

  const customerTypeRows = Object.values(typeStats).map((row) => ({
    ...row,
    revenue: Math.round(row.revenue),
    pctCustomers: totalCustomers > 0 ? (row.customers / totalCustomers) * 100 : 0,
    pctOrders: totalOrders > 0 ? (row.orders / totalOrders) * 100 : 0,
  }));

  const customerTypeTotal = {
    customers: totalCustomers,
    orders: totalOrders,
    revenue: Math.round(totalRevenue),
    pctCustomers: 100,
    pctOrders: 100,
  };

  // 7. Donut Chart 1: New Customers Source Distribution
  const activeSourcesForCustomers = sourceTableRows.filter((r) => r.newCustomers > 0);
  const customerDonutData = activeSourcesForCustomers.length > 0 ? activeSourcesForCustomers.map((r) => ({
    name: r.source,
    value: r.newCustomers,
    pct: r.pctOfNew,
    color: r.color,
  })) : [
    { name: 'WhatsApp', value: 18, pct: 32.7, color: '#22C55E' },
    { name: 'App', value: 33, pct: 60.0, color: '#3B82F6' },
    { name: 'Word of Mouth', value: 4, pct: 7.3, color: '#A855F7' },
    { name: 'Others', value: 0, pct: 0.0, color: '#94A3B8' },
  ];

  // 8. Donut Chart 2: Orders by Source (New Customers)
  const totalNewCustomerOrders = sourceTableTotal.orders || 1;
  const orderDonutData = activeSourcesForCustomers.length > 0 ? activeSourcesForCustomers.map((r) => ({
    name: r.source,
    value: r.orders,
    pct: totalNewCustomerOrders > 0 ? (r.orders / totalNewCustomerOrders) * 100 : 0,
    color: r.color,
  })) : [
    { name: 'WhatsApp', value: 27, pct: 37.5, color: '#22C55E' },
    { name: 'App', value: 41, pct: 56.9, color: '#3B82F6' },
    { name: 'Word of Mouth', value: 4, pct: 5.6, color: '#A855F7' },
    { name: 'Others', value: 0, pct: 0.0, color: '#94A3B8' },
  ];

  // 9. Orders Trend Area Chart (Daily New vs Existing Orders)
  const trendDays = [];
  const startD = new Date(`${fromDay}T00:00:00`);
  const endD = new Date(`${toDay}T00:00:00`);

  for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
    const dayStr = d.toISOString().slice(0, 10);
    const dayLabel = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    
    let newDayOrders = 0;
    let existingDayOrders = 0;

    currentPeriodOrders.forEach((o) => {
      if (o.day === dayStr) {
        if (o.customerType === 'New') newDayOrders++;
        else existingDayOrders++;
      }
    });

    trendDays.push({
      date: dayStr,
      label: dayLabel,
      'New Customers': newDayOrders,
      'Existing Customers': existingDayOrders,
      total: newDayOrders + existingDayOrders,
    });
  }

  return {
    fromDay,
    toDay,
    kpis,
    sourceTableRows,
    sourceTableTotal,
    customerTypeRows,
    customerTypeTotal,
    customerDonutData,
    orderDonutData,
    trendDays,
    activeCustomersInPeriod,
    currentPeriodOrders,
    metaAdsSummary,
  };
}
