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

function normalizeDate(raw) {
  if (!raw) return getTodayString();
  if (typeof raw === "string") {
    // If it's a string like "2026-05-01T12:00:00", split and take the date part
    if (raw.includes("T")) return raw.split("T")[0];
    return raw;
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
  if (normalized.includes("map") || normalized.includes("tap") || normalized.includes("app")) return ORDER_CHANNELS.APP;
  if (normalized.includes("gps") || normalized.includes("auto")) return ORDER_CHANNELS.AUTO;
  if (normalized.includes("website")) return ORDER_CHANNELS.WEBSITE;
  if (normalized.includes("whatsapp")) return ORDER_CHANNELS.WHATSAPP;
  if (normalized.includes("call")) return ORDER_CHANNELS.CALL;
  if (normalized.includes("outlet")) return ORDER_CHANNELS.OUTLET;
  if (normalized.includes("student")) return ORDER_CHANNELS.STUDENT;
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
    const name = normalizeCartServiceName(key);
    breakdownMap.set(key, {
      id: key,
      name,
      quantity: normalizeNumber(detail.count ?? detail.items),
      weight: normalizeNumber(detail.weight),
      amount: normalizeNumber(detail.subtotal ?? detail.amount ?? 0),
    });
  });

  return [...breakdownMap.values()].filter((item) => item.name && (item.quantity || item.weight || item.amount));
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
    ...(rawOrder.createdAt !== undefined ? { createdAtRaw: rawOrder.createdAt } : {}),
    ...(rawOrder.updatedAt !== undefined ? { updatedAtRaw: rawOrder.updatedAt } : {}),
    date: normalizeDate(rawOrder.date || rawOrder.createdAt),
    amount: firstPositiveNumber(rawOrder.amount, rawOrder.totalPrice),
    items: normalizeNumber(rawOrder.items ?? rawOrder.clothes, itemsFromPartnerMap),
    weight: normalizeNumber(rawOrder.weight),
    studentCount: normalizeNumber(rawOrder.studentCount),
    category: rawOrder.category || inferredCategory,
    type: rawOrder.type || inferredType,
    status: normalizeOrderStatus(rawOrder.status || rawOrder.orderStatus),
    details: normalizeDetails(rawOrder),
    customerName: rawOrder.customerName || rawOrder.userName || "",
    customerNumber: rawOrder.customerNumber || rawOrder.userPhone || rawOrder.phoneNumber || rawOrder.customerPhone || "",
    channel: mapCartSelectionSource(rawOrder.selectionSource || rawOrder.location?.selectionSource || rawOrder.channel || (source === "website" ? "website" : "")),
    deliveryDate: rawOrder.deliveryDate || rawOrder.dropTime || "",
    service: rawOrder.service || "Order",
    source,
  };

  if (source === "website") {
    normalized.category = ORDER_CATEGORIES.B2C_RETAIL;
    normalized.type = ORDER_TYPES.REGULAR;
    normalized.property = "Regular Customers";
    normalized.channel = ORDER_CHANNELS.WEBSITE;
    normalized.customerName = rawOrder.userName || rawOrder.customerName || "Website Customer";
    normalized.customerNumber = rawOrder.userPhone || rawOrder.phoneNumber || rawOrder.customerPhone || "no contact";
    normalized.service = rawOrder.service || (Array.isArray(rawOrder.items) ? rawOrder.items.map((item) => item.name || item.title).filter(Boolean).join(", ") : "") || "Web Store Order";
    normalized.items = normalizeNumber(rawOrder.totalItems, Array.isArray(rawOrder.items) ? rawOrder.items.length : normalized.items);

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

    const cartCreatedDate = rawOrder.createdAt || (rawOrder.orderTimestamp ? Number(rawOrder.orderTimestamp) : undefined);

    normalized.category = ORDER_CATEGORIES.B2C_RETAIL;
    normalized.type = ORDER_TYPES.REGULAR;
    normalized.property = "Regular Customers";
    normalized.channel = mapCartSelectionSource(rawOrder.selectionSource || rawOrder.location?.selectionSource || rawOrder.channel);
    normalized.serviceBreakdown = breakdown;
    normalized.serviceBreakdownSummary = summaryParts.join(", ");
    const firstService = breakdown[0]?.name || "Regular Service";
    normalized.service = breakdown.length <= 1 ? firstService : `${firstService} + ${breakdown.length - 1} more`;
    normalized.amount = firstPositiveNumber(
      rawOrder.totalCost,
      rawOrder.totalWithFee,
      rawOrder.originalTotalCost,
      rawOrder.originalAmount,
      rawOrder.amount,
    );
    const itemsFromBreakdown = breakdown.reduce((sum, item) => sum + (item.quantity || 0), 0);
    normalized.items = normalizeNumber(rawOrder.totalItems ?? rawOrder.clothesCount ?? itemsFromBreakdown);
    normalized.weight = normalizeNumber(rawOrder.clothesWeightKg ?? normalized.weight);
    normalized.status = normalizeOrderStatus(rawOrder.status || rawOrder.orderStatus || rawOrder.paymentStatus);
    if (cartCreatedDate) {
      normalized.date = normalizeDate(cartCreatedDate);
    }
    normalized.customerName = (rawOrder.userName || rawOrder.customerName || "Regular Customer").trim();
    normalized.customerNumber = rawOrder.userMobile || rawOrder.customerPhone || rawOrder.userPhone || "";
    normalized.details = normalized.details || rawOrder.breakdown || {};
    const addressCandidate = rawOrder.userEnteredAddress || rawOrder.location?.address || rawOrder.address || rawOrder.userAddress || "";
    normalized.address = addressCandidate ? addressCandidate.trim() : "";
    normalized.deliveryDate = rawOrder.deliveryDate || rawOrder.dropTime || "";

    // Some cart records can be created for B2B hotel/hostel partners; if so, respect the provided property name.
    const cartProperty = getWebsitePropertyCandidate(rawOrder);
    if (cartProperty && String(cartProperty).trim()) {
      normalized.property = normalizePropertyName(cartProperty);
      normalized.category = inferCategoryFromProperty(normalized.property);
      normalized.type = getTypeForCategory(normalized.category);
    }
  }

  if (source === "b2b") {
    normalized.category = rawOrder.category || inferredCategory;
    normalized.type = rawOrder.type || inferredType;

    // Parse B2B specific fields (Student Laundry)
    if (rawOrder.hostelTotalClothes !== undefined) {
      normalized.items = normalizeNumber(rawOrder.hostelTotalClothes, normalized.items);
    }
    if (rawOrder.hostelTotalWeightKg !== undefined) {
      normalized.weight = normalizeNumber(rawOrder.hostelTotalWeightKg, normalized.weight);
    }
    if (rawOrder.hostelTotalStudents !== undefined) {
      normalized.studentCount = normalizeNumber(rawOrder.hostelTotalStudents, normalized.studentCount);
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
    normalized.category = ORDER_CATEGORIES.INDIVIDUAL_STUDENT;
    normalized.type = ORDER_TYPES.STUDENT;
    normalized.items = normalizeNumber(rawOrder.clothes, normalized.items);
    normalized.customerName = rawOrder.userName || normalized.customerName;
    normalized.customerNumber = rawOrder.userMobile || normalized.customerNumber;
    if (rawOrder.room) {
      normalized.service = `Room: ${rawOrder.room}`;
    }
  }

  if (normalized.category === ORDER_CATEGORIES.ISSUES) {
    normalized.type = ORDER_TYPES.ISSUE;
  }

  return normalized;
}
