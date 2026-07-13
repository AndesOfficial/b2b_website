const fs = require("fs");
// Mocking constants for orderNormalization
const ORDER_CATEGORIES = { B2C_RETAIL: "B2C_RETAIL" };
const ORDER_TYPES = { REGULAR: "regular" };
const ORDER_CHANNELS = { APP: "App", WEBSITE: "Website", AUTO: "Auto", WHATSAPP: "WhatsApp" };

function mapCartSelectionSource(source) {
  if (!source) return ORDER_CHANNELS.APP;
  const normalized = String(source).toLowerCase();
  if (normalized.includes("whatsapp") || normalized.includes("wa")) return ORDER_CHANNELS.WHATSAPP;
  if (normalized.includes("map") || normalized.includes("tap") || normalized.includes("app") || normalized.includes("search")) return ORDER_CHANNELS.APP;
  if (normalized.includes("gps") || normalized.includes("auto")) return ORDER_CHANNELS.AUTO;
  if (normalized.includes("website")) return ORDER_CHANNELS.WEBSITE;
  return ORDER_CHANNELS.APP;
}

function normalizeDate(raw) {
  if (!raw) return "";
  let d;
  if (raw?.toDate) { d = raw.toDate(); } 
  else if (typeof raw === "number") {
    if (raw < 10000000000) raw *= 1000;
    d = new Date(raw);
  } else if (typeof raw === "string") {
    let trimmed = raw.trim();
    if (trimmed.includes("T")) {
      d = new Date(trimmed);
    } else {
      const dmyMatch = trimmed.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})/);
      const ymdMatch = trimmed.match(/^(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})/);
      if (dmyMatch) { d = new Date(`${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`); } 
      else if (ymdMatch) { d = new Date(`${ymdMatch[1]}-${ymdMatch[2]}-${ymdMatch[3]}`); } 
      else { d = new Date(trimmed); }
    }
  } else if (raw instanceof Date) { d = raw; }
  
  if (!d || isNaN(d.getTime())) return typeof raw === "string" ? raw : "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const rawOrder = {
  createdAt: "July 9, 2026 at 8:14:43 PM UTC+5:30",
  orderTimestamp: 1783608282971,
  selectionSource: "website",
  totalCost: 10,
  totalItems: 2
};

const cartCreatedDate = rawOrder.orderTimestamp ? Number(rawOrder.orderTimestamp) : rawOrder.createdAt;
console.log("cartCreatedDate:", cartCreatedDate);
console.log("normalizedDate:", normalizeDate(cartCreatedDate));

const o = { date: normalizeDate(cartCreatedDate) };
let getOrderDate = (o) => {
    if (o.date) {
        let dateStr = o.date;
        const dmyMatch = dateStr.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})/);
        if (dmyMatch) {
            const [, day, month, year] = dmyMatch;
            dateStr = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
        }
        const d = new Date(dateStr);
        if (!isNaN(d)) return d;
    }
    return new Date(0);
};

console.log("getOrderDate returned:", getOrderDate(o).toString());
