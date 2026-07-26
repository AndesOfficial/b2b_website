import { ORDER_CATEGORIES, ORDER_CHANNELS, ORDER_STATUSES, ORDER_TYPES, normalizeOrderStatus } from "../constants/orders";
import { getCategoryForProperty } from "../data/hostelOrders";
import { getTodayString } from "./dateUtils";
import { ITEM_RATE_MAP, STUDENT_RATE_PER_KG } from "../config/orderRateCard";

// --- ADDED ALIASES HERE TO FIX CASE SENSITIVITY AND DUPLICATES ---
export const CANONICAL_PROPERTY_NAMES = {
  // Aakansha
  aakansha: "Aakansha",
  akansha: "Aakansha",
  "aakansha hostel": "Aakansha",
  "aakansha hostel kothurd": "Aakansha",
  "aakansha hostel kothrud": "Aakansha",

  // Adarsha
  adarsha: "Adarsha",
  adarsa: "Adarsha",
  "adarsha hostel": "Adarsha",
  "adarsa hostel": "Adarsha",
  "adarsha hostel bhavdan": "Adarsha",
  "adarsa hostel bhavdan": "Adarsha",
  "adarsha hostel bavdhan": "Adarsha",
  "adarsa hostel bavdhan": "Adarsha",

  // Aaradhana
  aardhana: "Aaradhana",
  ardhana: "Aaradhana",
  "aardhana hostel": "Aaradhana",
  aaradhana: "Aaradhana",
  "aaradhana hostel": "Aaradhana",
  "aaradhana hostel bhavdan": "Aaradhana",
  "aaradhana hostel bavdhan": "Aaradhana",
  "aardhana hostel bhavdan": "Aaradhana",

  // Curie
  curie: "Curie",
  "curie hostel": "Curie",
  "curie hostel sb road": "Curie",

  // Gurukul
  gurukul: "Gurukul",
  "gurukul hostel": "Gurukul",
  "gurukul hostel bhavdan": "Gurukul",
  "gurukul hostel bavdhan": "Gurukul",

  // Keerti
  kirti: "Keerti",
  "kirti hostel": "Keerti",
  keerti: "Keerti",
  "keerti hostel": "Keerti",
  "keerti hostel karve nagar": "Keerti",

  // Meera
  meera: "Meera",
  "meera hostel": "Meera",
  "meera hostel karve nagar": "Meera",

  // Plato
  plato: "Plato",
  "plato hostel": "Plato",
  "plato hostel viman nagar": "Plato",

  // Samriddhi
  samridhi: "Samriddhi",
  "samridhi hostel": "Samriddhi",
  samriddhi: "Samriddhi",
  "samriddhi hostel": "Samriddhi",

  // Samshrushti
  samshrushti: "Samshrushti",
  "samshrushti hostel": "Samshrushti",
  samshursti: "Samshrushti",
  "samshursti hostel": "Samshrushti",
  "samshursti hostel karve nagar": "Samshrushti",
  "samshrushti hostel karve nagar": "Samshrushti",
  samsrushti: "Samshrushti",
  "samsrushti hostel": "Samshrushti",

  // Tara
  tara: "Tara",
  "tara hostel": "Tara",
  "tara hostel kothurd": "Tara",
  "tara hostel kothrud": "Tara",

  // Tulsi
  tulsi: "Tulsi",
  "tulsi hostel": "Tulsi",
  "tulsi boys hostel": "Tulsi",
  "tulsi hostel bhavdan": "Tulsi",
  "tulsi hostel bavdhan": "Tulsi",

  // Other properties
  hostel99: "Hostel 99",
  "hostel 99": "Hostel 99",
  "hostel99 koregaon park": "Hostel99 koregaon park",
  "hostel99 yerwada 1": "Hostel99 Yerwada 1",
  "hostel99 yerwada 2": "Hostel99 Yerwada 2",
  "hostel 99 no-88": "Hostel 99 no-88",
  "hostel99 no. 88": "Hostel 99 no-88",
  "hostel99 no.88": "Hostel 99 no-88",
  "hostel99 no88": "Hostel 99 no-88",
  "hostel99 no 88": "Hostel 99 no-88",
  "hostel 99 no. 88": "Hostel 99 no-88",
  "hostel 99 no 88": "Hostel 99 no-88",
  "hostel 99 no88": "Hostel 99 no-88",
  "hostel 99 no-3": "Hostel 99 no-3",
  "hostel99 no. 3": "Hostel 99 no-3",
  "hostel99 no.3": "Hostel 99 no-3",
  "hostel99 no3": "Hostel 99 no-3",
  "hostel99 no 3": "Hostel 99 no-3",
  "hostel 99 no. 3": "Hostel 99 no-3",
  "hostel 99 no 3": "Hostel 99 no-3",
  "hostel 99 no3": "Hostel 99 no-3",
  "hostel 99 n0 3": "Hostel 99 no-3",
  "hostel 99 n03": "Hostel 99 no-3",
  "hostel99 n0 3": "Hostel 99 no-3",
  "hostel99 n03": "Hostel 99 no-3",
  "regular customers": "Regular Customers",
  issues: "Issues",
  "airbnb viman nagar": "Airbnb Viman Nagar",
  "airbnb viman nagar ": "Airbnb Viman Nagar",
  "airbnb viman nagar, pune": "Airbnb Viman Nagar",
  "treebo trend hotel": "Treebo Trend Hotel",
  "treebo trend hotel camp": "Treebo Trend Hotel",
};

// getTodayString imported from ./dateUtils

export function normalizeDate(raw) {
  if (!raw) return getTodayString();
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    // Check for DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (dmyMatch) {
      const [, day, month, year] = dmyMatch;
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
    // Check for YYYY-MM-DD or YYYY-MM-DD...
    const ymdMatch = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
    if (ymdMatch) {
      const [, year, month, day] = ymdMatch;
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
    if (trimmed.includes("T")) return trimmed.split("T")[0];
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
    return trimmed;
  }
  
  let d;
  if (raw?.toDate) {
    d = raw.toDate();
  } else if (raw instanceof Date) {
    d = raw;
  } else if (typeof raw === "number") {
    d = new Date(raw);
  } else {
    return getTodayString();
  }

  // Use local time, not UTC
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function firstPositiveNumber(...values) {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return 0;
}

export function normalizePropertyName(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "Unknown Property";

  // This converts whatever the user typed to lowercase (e.g. "Tulsi Hostel" -> "tulsi hostel")
  const collapsed = trimmed.replace(/\s+/g, " ").toLowerCase();
  const alphanumeric = collapsed.replace(/[^a-z0-9 ]/g, "").trim();

  // If "tulsi hostel" is found in our dictionary above, it returns exactly "Tulsi"
  return CANONICAL_PROPERTY_NAMES[collapsed]
    || CANONICAL_PROPERTY_NAMES[alphanumeric]
    || trimmed.split(" ").map((part) => part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : part).join(" ");
}

function normalizeDetails(rawOrder) {
  if (rawOrder.details && typeof rawOrder.details === "object" && !Array.isArray(rawOrder.details)) {
    return rawOrder.details;
  }

  if (rawOrder.partnerItems && typeof rawOrder.partnerItems === "object") {
    return rawOrder.partnerItems;
  }

  return {};
}

function inferCategoryFromProperty(property) {
  const normalizedProperty = String(property || "").trim().toLowerCase();

  if (!normalizedProperty) return ORDER_CATEGORIES.STUDENT_LAUNDRY;
  if (normalizedProperty === "regular customers") return ORDER_CATEGORIES.B2C_RETAIL;
  if (normalizedProperty === "issues") return ORDER_CATEGORIES.ISSUES;
  if (normalizedProperty.includes("airbnb") || normalizedProperty.includes("hotel")) return ORDER_CATEGORIES.AIRBNB;

  return getCategoryForProperty(property)?.key || ORDER_CATEGORIES.STUDENT_LAUNDRY;
}

function getTypeForCategory(category) {
  if (category === ORDER_CATEGORIES.LINEN) return ORDER_TYPES.LINEN;
  if (category === ORDER_CATEGORIES.B2C_RETAIL) return ORDER_TYPES.REGULAR;
  if (category === ORDER_CATEGORIES.AIRBNB) return ORDER_TYPES.AIRBNB;
  if (category === ORDER_CATEGORIES.ISSUES) return ORDER_TYPES.ISSUE;
  return ORDER_TYPES.STUDENT;
}

function getWebsitePropertyCandidate(rawOrder) {
  return (
    rawOrder.property
    || rawOrder.propertyName
    || rawOrder.partner
    || rawOrder.partnerName
    || rawOrder.partnername
    || rawOrder.hostel
    || rawOrder.hostelName
    || rawOrder.hotelName
  );
}

const CART_SERVICE_ALIASES = {
  "Wash & Fold_regular": "Wash & Fold",
  "Loafers/Sneakers_regular": "Loafers/Sneakers",
};

function normalizeCartServiceName(rawName) {
  if (!rawName) return "Regular Service";
  const alias = CART_SERVICE_ALIASES[rawName];
  if (alias) return alias;
  return rawName.replace(/_regular$/i, "").trim();
}

function mapCartSelectionSource(source) {
  if (!source) return ORDER_CHANNELS.APP;
  const normalized = String(source).toLowerCase();
  if (normalized.includes("whatsapp") || normalized.includes("wa")) return ORDER_CHANNELS.WHATSAPP;

  // App sources
  if (
    normalized.includes("map") || 
    normalized.includes("tap") || 
    normalized.includes("app") || 
    normalized.includes("search") // catches "search_result"
  ) return ORDER_CHANNELS.APP;
  
  if (normalized.includes("gps") || normalized.includes("auto")) return ORDER_CHANNELS.AUTO;
  if (normalized.includes("website")) return ORDER_CHANNELS.WEBSITE;
  if (normalized.includes("call")) return ORDER_CHANNELS.CALL;
  if (normalized.includes("outlet")) return ORDER_CHANNELS.OUTLET;
  if (normalized.includes("student")) return ORDER_CHANNELS.STUDENT;
  
  // Default fallback
  return ORDER_CHANNELS.APP;
}

function buildCartServiceBreakdown(rawOrder) {
  const services = rawOrder.services || {};
  const perKgDetails = rawOrder.perKgDetails || rawOrder.perKg || {};
  const breakdownMap = new Map();

  Object.entries(services).forEach(([key, value]) => {
    const name = normalizeCartServiceName(key);
    const detail = perKgDetails[key] || perKgDetails[name] || {};
    breakdownMap.set(key, {
      id: key,
      name,
      quantity: normalizeNumber(value),
      weight: normalizeNumber(detail.weight),
      amount: normalizeNumber(detail.subtotal ?? detail.amount ?? 0),
    });
  });

  Object.entries(perKgDetails).forEach(([key, detail]) => {
    if (breakdownMap.has(key)) return;
    if (key === "items" && Array.isArray(detail)) return; // Skip new schema items array
    const name = normalizeCartServiceName(key);
    breakdownMap.set(key, {
      id: key,
      name,
      quantity: normalizeNumber(detail.count ?? detail.items),
      weight: normalizeNumber(detail.weight),
      amount: normalizeNumber(detail.subtotal ?? detail.amount ?? 0),
    });
  });

  // Support for final 'orders' collection schema
  const perPieceItems = rawOrder.perPiece?.items || [];
  const perKgItems = rawOrder.perKg?.items || [];

  perPieceItems.forEach(item => {
    const name = normalizeCartServiceName(item.name);
    if (!name) return;
    if (breakdownMap.has(name)) {
       const existing = breakdownMap.get(name);
       existing.quantity += normalizeNumber(item.quantity);
       existing.amount += normalizeNumber(item.subtotal);
    } else {
       breakdownMap.set(name, {
         id: name,
         name,
         quantity: normalizeNumber(item.quantity),
         weight: 0,
         amount: normalizeNumber(item.subtotal)
       });
    }
  });

  perKgItems.forEach(item => {
    const name = normalizeCartServiceName(item.name);
    if (!name) return;
    if (breakdownMap.has(name)) {
       const existing = breakdownMap.get(name);
       existing.quantity += normalizeNumber(item.quantity);
       existing.weight += normalizeNumber(item.weight);
       existing.amount += normalizeNumber(item.subtotal);
    } else {
       breakdownMap.set(name, {
         id: name,
         name,
         quantity: normalizeNumber(item.quantity),
         weight: normalizeNumber(item.weight),
         amount: normalizeNumber(item.subtotal)
       });
    }
  });

  return [...breakdownMap.values()].filter((item) => item.name && (item.quantity || item.weight || item.amount));
}

function normalizeSlot(val) {
  if (val === null || val === undefined || val === "") return "";
  if (typeof val === "object") {
    if (typeof val.toDate === "function") {
      try {
        const d = val.toDate();
        if (!isNaN(d.getTime())) return normalizeDate(d);
      } catch (e) {
        return "—";
      }
    } else if (typeof val.seconds === "number" || typeof val._seconds === "number") {
      const sec = val.seconds ?? val._seconds;
      const d = new Date(sec * 1000);
      if (!isNaN(d.getTime())) return normalizeDate(d);
    } else if (val instanceof Date && !isNaN(val.getTime())) {
      return normalizeDate(val);
    }
    return "—";
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (trimmed.startsWith("Timestamp(") || trimmed.includes("seconds=")) {
      const match = trimmed.match(/seconds=(\d+)/);
      if (match && match[1]) {
        const sec = parseInt(match[1], 10);
        if (!isNaN(sec)) {
          const d = new Date(sec * 1000);
          if (!isNaN(d.getTime())) return normalizeDate(d);
        }
      }
      return "—";
    }
    if (trimmed === "[object Object]" || trimmed === "undefined" || trimmed === "null") {
      return "—";
    }
    return trimmed;
  }
  return "—";
}

export function normalizeOrder(rawOrder = {}, source = "unknown") {
  const propertyCandidate = rawOrder.property ||
    rawOrder.propertyName ||
    rawOrder.partnerName ||
    rawOrder.partnername ||
    rawOrder.hostel ||
    rawOrder.hostelName ||
    rawOrder.hotelName ||
    rawOrder.location ||
    rawOrder.userName ||
    rawOrder.customerName ||
    "Unknown Property";
    
  const property = normalizePropertyName(propertyCandidate);
  const inferredCategory = inferCategoryFromProperty(property);
  const inferredType = getTypeForCategory(inferredCategory);

  const itemsFromPartnerMap = rawOrder.partnerItems
    ? Object.values(rawOrder.partnerItems).reduce((sum, value) => sum + normalizeNumber(value), 0)
    : 0;

  const normalized = {
    id: String(rawOrder.id || rawOrder.orderId || `${source}-${Date.now()}`),
    ...rawOrder,
    property,
    createdAtRaw: rawOrder.createdAt || rawOrder.orderTimestamp || rawOrder.orderDate || rawOrder.date || null,
    updatedAtRaw: rawOrder.updatedAt || rawOrder.lastModified || null,
    date: normalizeDate(rawOrder.orderTimestamp ? Number(rawOrder.orderTimestamp) : (rawOrder.date || rawOrder.createdAt)),
    amount: firstPositiveNumber(rawOrder.amount, rawOrder.totalPrice),
    items: normalizeNumber(rawOrder.items ?? rawOrder.clothes, itemsFromPartnerMap),
    weight: normalizeNumber(rawOrder.weight),
    studentCount: normalizeNumber(rawOrder.studentCount),
    category: typeof rawOrder.category === 'string' ? rawOrder.category : (typeof inferredCategory === 'string' ? inferredCategory : ""),
    type: typeof rawOrder.type === 'string' ? rawOrder.type : (typeof inferredType === 'string' ? inferredType : ""),
    status: normalizeOrderStatus(rawOrder.status || rawOrder.orderStatus),
    details: normalizeDetails(rawOrder),
    customerName: String(rawOrder.customerName || rawOrder.userName || "").trim(),
    customerNumber: String(rawOrder.userMobile || rawOrder.customerNumber || rawOrder.userPhone || rawOrder.phoneNumber || rawOrder.customerPhone || "").trim(),
    channel: mapCartSelectionSource(rawOrder.selectionSource || rawOrder.location?.selectionSource || rawOrder.channel || (source === "website" ? "website" : "")),
    deliveryDate: normalizeSlot(rawOrder.deliveryDate || rawOrder.dropTime || ""),
    pickupDate: normalizeSlot(rawOrder.pickupDate || rawOrder.pickupTime || rawOrder.pickupSlot || rawOrder.pickup || rawOrder.date || ""),
    service: typeof rawOrder.service === 'string' ? rawOrder.service : "Order",
    source,
  };

  if (source === "website") {
    normalized.category = ORDER_CATEGORIES.B2C_RETAIL;
    normalized.type = ORDER_TYPES.REGULAR;
    normalized.property = "Regular Customers";
    normalized.channel = ORDER_CHANNELS.WEBSITE;
    normalized.customerName = String(rawOrder.userName || rawOrder.customerName || "Website Customer").trim();
    normalized.customerNumber = String(rawOrder.userMobile || rawOrder.customerNumber || rawOrder.userPhone || rawOrder.phoneNumber || rawOrder.customerPhone || "no contact").trim();
    normalized.service = (typeof rawOrder.service === 'string' && rawOrder.service) ? rawOrder.service : ((Array.isArray(rawOrder.items) ? rawOrder.items.map((item) => item.name || item.title).filter(Boolean).join(", ") : "") || "Web Store Order");
    normalized.items = normalizeNumber(rawOrder.totalItems, Array.isArray(rawOrder.items) ? rawOrder.items.length : normalized.items);
    if (!normalized.items || normalized.items === 0) {
      normalized.items = normalizeNumber(rawOrder.clothesCount, normalized.items);
    }

    // If the website order includes a business property/hotel name, use it so B2B clients can filter their own orders.
    const websiteProperty = getWebsitePropertyCandidate(rawOrder);
    if (websiteProperty && String(websiteProperty).trim()) {
      normalized.property = normalizePropertyName(websiteProperty);
      normalized.category = inferCategoryFromProperty(normalized.property);
      normalized.type = getTypeForCategory(normalized.category);
    }
  }

  if (source === "cartdetails") {
    const breakdown = buildCartServiceBreakdown(rawOrder);
    const summaryParts = breakdown.map((item) => {
      const metrics = [
        item.quantity > 0 ? `${item.quantity} pcs` : "",
        item.weight > 0 ? `${item.weight} kg` : "",
      ].filter(Boolean).join(" • ");
      return `${item.name}${metrics ? ` (${metrics})` : ""}`;
    }).filter(Boolean);

    const cartCreatedDate = rawOrder.orderTimestamp ? Number(rawOrder.orderTimestamp) : rawOrder.createdAt;

    normalized.category = ORDER_CATEGORIES.B2C_RETAIL;
    normalized.type = ORDER_TYPES.REGULAR;
    normalized.property = "Regular Customers";
    normalized.channel = mapCartSelectionSource(rawOrder.selectionSource || rawOrder.location?.selectionSource || rawOrder.channel);
    normalized.serviceBreakdown = breakdown;
    normalized.serviceBreakdownSummary = summaryParts.join(", ");
    const firstService = breakdown[0]?.name || "Regular Service";
    normalized.service = breakdown.length <= 1 ? firstService : `${firstService} + ${breakdown.length - 1} more`;
    const amountFromBreakdown = breakdown.reduce((sum, item) => sum + (item.amount || 0), 0);

    // ── Context-aware Amount Resolution ──────────────────────────────────────
    // Two distinct schemas exist in cartdetails:
    //
    //  WEIGHED order (service items confirmed):
    //    breakdown.perKg.items or perPiece.items have entries with amounts.
    //    → totalCost = actual service cost (most reliable)
    //
    //  UNWEIGHED order (rider hasn't collected/weighed yet):
    //    breakdown.perKg.items AND perPiece.items are BOTH empty arrays.
    //    → totalCost = delivery surcharge placeholder ONLY (e.g. ₹10 distance fee)
    //    → paymentData.totalWithFee = the customer-agreed estimated price (₹99)
    //
    // Sujal example: totalCost=10 (delivery only), paymentData.totalWithFee=99 → show ₹99
    // Atharv example: totalCost=0 (wallet), paymentData.totalWithFee=0, originalAmount=79 → show ₹79
    const rawBdPerKgItems   = rawOrder.breakdown?.perKg?.items;
    const rawBdPerPieceItems = rawOrder.breakdown?.perPiece?.items;
    const hasBreakdownServiceItems =
      (Array.isArray(rawBdPerKgItems)   && rawBdPerKgItems.length   > 0) ||
      (Array.isArray(rawBdPerPieceItems) && rawBdPerPieceItems.length > 0);

    const bdTotal        = normalizeNumber(rawOrder.breakdown?.total);
    const chargesSubtotal = normalizeNumber(rawOrder.breakdown?.fees?.chargesSubtotal);

    if (hasBreakdownServiceItems) {
      // Clothes have been weighed/counted — totalCost is the confirmed service cost.
      normalized.amount = firstPositiveNumber(
        rawOrder.totalCost,
        rawOrder.originalTotalCost,
        bdTotal,
        rawOrder.amount,
        rawOrder.paymentData?.totalWithFee,
        rawOrder.paymentData?.originalAmount,
        rawOrder.totalWithFee,
        rawOrder.originalAmount,
        rawOrder.total,
        amountFromBreakdown > 0 ? amountFromBreakdown : chargesSubtotal
      );
    } else {
      // Clothes NOT yet weighed — totalCost is only the delivery surcharge.
      // Customer-agreed price is in paymentData.totalWithFee (or originalAmount for wallet orders).
      normalized.amount = firstPositiveNumber(
        rawOrder.paymentData?.totalWithFee,
        rawOrder.paymentData?.originalAmount,
        rawOrder.totalCost,
        rawOrder.originalTotalCost,
        bdTotal,
        rawOrder.amount,
        rawOrder.totalWithFee,
        rawOrder.originalAmount,
        rawOrder.total,
        amountFromBreakdown > 0 ? amountFromBreakdown : chargesSubtotal
      );
    }

    const itemsFromBreakdown = breakdown.reduce((sum, item) => sum + (item.quantity || 0), 0);
    normalized.items = normalizeNumber(rawOrder.totalItems ?? rawOrder.clothesCount ?? itemsFromBreakdown);
    if (!normalized.items || normalized.items === 0) {
      normalized.items = normalizeNumber(Array.isArray(rawOrder.items) ? rawOrder.items.length : 0);
    }
    const weightFromBreakdown = breakdown.reduce((sum, item) => sum + (item.weight || 0), 0);
    normalized.weight = firstPositiveNumber(rawOrder.clothesWeightKg, rawOrder.weight, weightFromBreakdown);
    normalized.status = normalizeOrderStatus(rawOrder.status || rawOrder.orderStatus || rawOrder.paymentStatus);
    
    if (cartCreatedDate) {
      normalized.date = normalizeDate(cartCreatedDate);
      if (!normalized.createdAtRaw) {
        normalized.createdAtRaw = cartCreatedDate;
      }
    }
    
    normalized.customerName = String(rawOrder.userName || rawOrder.customerName || "Regular Customer").trim();
    normalized.customerNumber = String(rawOrder.userMobile || rawOrder.customerNumber || rawOrder.userPhone || rawOrder.phoneNumber || rawOrder.customerPhone || "").trim();
    
    // ── Rider Tracking Record Detection ──────────────────────────────────────
    // The `cartdetails` collection contains two types of documents:
    //   1. Real customer orders: have `breakdown`, `paymentData`, `totalCost` / `originalTotalCost`
    //   2. Rider tracking records: created by riders during pickup, have NONE of the above.
    //      Their `services` map only contains `{ servicesConfirmed: false }` (a boolean flag).
    // Rider records must NOT count as B2C orders in any metric.
    const hasCustomerPaymentData = !!(rawOrder.breakdown || rawOrder.paymentData ||
      rawOrder.totalCost || rawOrder.originalTotalCost);
    const hasNumericServices = rawOrder.services &&
      !Array.isArray(rawOrder.services) &&
      Object.entries(rawOrder.services).some(([, v]) => typeof v === 'number' && v > 0);

    if (!hasCustomerPaymentData && !hasNumericServices) {
      // This is a rider tracking / ops record — not a customer order.
      normalized.category = "RIDER_TRACKING";
      normalized.type = "rider_tracking";
      normalized.status = rawOrder.status || "Tracking";
      return normalized; // Skip all further B2C processing
    }

    // ── Flag genuinely empty/abandoned carts ─────────────────────────────────
    // Check ALL available quantity/weight signals to avoid mis-classifying
    // wallet-covered (totalCost=0) or coupon-zeroed orders.
    const hasAnyItems =
      normalized.items > 0 ||
      normalized.weight > 0 ||
      normalizeNumber(rawOrder.totalItems) > 0 ||
      normalizeNumber(rawOrder.clothesWeightKg) > 0 ||
      normalizeNumber(rawOrder.clothesCount) > 0 ||
      hasNumericServices; // Only counts keys with numeric values > 0
    // Protect valid 0-item pickup requests (where the customer checked out but skipped adding specific items)
    const isCheckoutComplete = !!(
      rawOrder.pickupTime ||
      rawOrder.paymentMethod ||
      rawOrder.whatsappConfirmationSent ||
      rawOrder.paymentStatus
    );

    if (normalized.amount === 0 && !hasAnyItems && !isCheckoutComplete) {
      normalized.category = "ABANDONED_CART";
      normalized.type = "abandoned";
      normalized.status = "Abandoned";
    }
    
    normalized.details = normalized.details || rawOrder.breakdown || {};
    
    const addressCandidate = rawOrder.userEnteredAddress || rawOrder.location?.address || rawOrder.address || rawOrder.userAddress || "";
    normalized.address = addressCandidate ? addressCandidate.trim() : "";
    const dDate = rawOrder.deliveryDate || rawOrder.dropTime;
    normalized.deliveryDate = normalizeSlot(dDate);

    // Some cart/website records can be created for B2B hotel/hostel partners; if so, respect the provided property name.
    const propertyCandidate = getWebsitePropertyCandidate(rawOrder);
    if (propertyCandidate && String(propertyCandidate).trim()) {
      normalized.property = normalizePropertyName(propertyCandidate);
      normalized.category = inferCategoryFromProperty(normalized.property);
      normalized.type = getTypeForCategory(normalized.category);
    }
  }

  if (source === "b2b") {
    normalized.category = rawOrder.category || inferredCategory;
    normalized.type = rawOrder.type || inferredType;

    // Parse B2B specific fields (Student Laundry)
    if (rawOrder.details && Array.isArray(rawOrder.details.studentServices)) {
      const services = rawOrder.details.studentServices;
      const computedWeight = services.reduce((sum, s) => sum + (Number(s.weight) || 0), 0);
      const computedItems = services.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
      const computedAmount = services.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);

      normalized.weight = firstPositiveNumber(rawOrder.weight, rawOrder.hostelTotalWeightKg, computedWeight);
      normalized.items = firstPositiveNumber(rawOrder.items, rawOrder.hostelTotalClothes, computedItems);
      normalized.amount = firstPositiveNumber(rawOrder.amount, computedAmount);

      if (rawOrder.details.entryMode === "student" && !normalized.studentCount) {
        normalized.studentCount = 1;
      }
    } else {
      if (rawOrder.hostelTotalClothes !== undefined) {
        normalized.items = normalizeNumber(rawOrder.hostelTotalClothes, normalized.items);
      }
      if (rawOrder.hostelTotalWeightKg !== undefined) {
        normalized.weight = normalizeNumber(rawOrder.hostelTotalWeightKg, normalized.weight);
      }
      if (rawOrder.hostelTotalStudents !== undefined) {
        normalized.studentCount = normalizeNumber(rawOrder.hostelTotalStudents, normalized.studentCount);
      }
    }

    // Parse B2B specific fields (Linen)
    // The UI expects `details` to be an object of key-value pairs for linen items
    if (rawOrder.partnerItems && typeof rawOrder.partnerItems === "object") {
      normalized.details = rawOrder.partnerItems;
    } else if (rawOrder.details && typeof rawOrder.details === "string") {
      normalized.serviceBreakdownSummary = rawOrder.details;
    }

    // Dynamic Revenue Calculation (if missing)
    if (!normalized.amount) {
      if (normalized.type === "student") {
        normalized.amount = (normalized.weight || 0) * STUDENT_RATE_PER_KG;
      } else if ((normalized.type === "linen" || normalized.type === "airbnb") && normalized.details && typeof normalized.details === "object") {
        let linenTotal = 0;
        Object.entries(normalized.details).forEach(([item, quantity]) => {
          const rate = ITEM_RATE_MAP[item] || 0;
          linenTotal += ((parseFloat(quantity) || 0) * rate);
        });
        normalized.amount = linenTotal;
      }
    }
  }

  if (source === "hostels") {
    normalized.category = ORDER_CATEGORIES.STUDENT_LAUNDRY;
    normalized.type = ORDER_TYPES.STUDENT;
    
    // Extract both claimed and verified counts to show discrepancy
    normalized.claimedItems = normalizeNumber(rawOrder.clothes);
    normalized.verifiedItems = normalizeNumber(rawOrder.clothesCount);
    
    // Fallback logic: verified first, then claimed, then items
    normalized.items = firstPositiveNumber(normalized.verifiedItems, normalized.claimedItems, normalized.items);
    
    normalized.weight = firstPositiveNumber(rawOrder.clothesWeightKg, rawOrder.weight, normalized.weight);
    normalized.customerName = String(rawOrder.userName || normalized.customerName).trim();
    normalized.customerNumber = String(rawOrder.userMobile || normalized.customerNumber).trim();
    normalized.studentCount = 1; // Each individual hostel order represents 1 student
    if (rawOrder.room) {
      normalized.service = `Room: ${rawOrder.room}`;
    }
  }

  if (source === "complaint") {
    normalized.category = ORDER_CATEGORIES.ISSUES;
    normalized.type = "issue";
    normalized.issueType = rawOrder.category || "Other";
    normalized.service = rawOrder.issue || "App Complaint";
    normalized.date = normalizeDate(rawOrder.createdAt);
    normalized.reportedBy = rawOrder.userName || "Customer";
    normalized.linkedHostel = rawOrder.location?.address || "";
    normalized.resolveStatus = (rawOrder.status === "resolved" || rawOrder.status === "closed") ? "Resolved" : "Unresolved";
    normalized.severity = "pending";
    normalized.customerNumber = rawOrder.userMobile || "";
    normalized.customerName = rawOrder.userName || "Customer";
    normalized.id = rawOrder.id;
    return normalized;
  }

  if (normalized.category === ORDER_CATEGORIES.ISSUES) {
    normalized.type = ORDER_TYPES.ISSUE;
  }

  // FORCE merge any legacy "Student Direct Orders" into "Student Laundry (B2B)"
  if (normalized.category === ORDER_CATEGORIES.INDIVIDUAL_STUDENT) {
    normalized.category = ORDER_CATEGORIES.STUDENT_LAUNDRY;
    normalized.type = ORDER_TYPES.STUDENT;
  }

  return normalized;
}
