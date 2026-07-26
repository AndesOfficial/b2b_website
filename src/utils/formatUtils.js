/**
 * Shared formatting utilities for Andes B2B Partner Portal.
 */

/**
 * Formats a numeric value as Indian currency (₹) with proper locale string and decimal precision.
 */
export function formatCurrency(value, options = {}) {
  const num = Number(value) || 0;
  const minDecimals = options.minDecimals !== undefined ? options.minDecimals : 0;
  const maxDecimals = options.maxDecimals !== undefined ? options.maxDecimals : 2;
  return `₹${num.toLocaleString("en-IN", { minimumFractionDigits: minDecimals, maximumFractionDigits: maxDecimals })}`;
}

/**
 * Humanizes raw service codes and fallback strings into clean title-case labels.
 * Examples:
 *   IRON_IRON -> Ironing
 *   Shirts_instant -> Shirts (Instant)
 *   WASH_FOLD -> Wash & Fold
 *   standard standard -> Standard
 */
export function humanizeServiceLabel(key) {
  if (!key) return "Standard";
  const str = String(key).trim();
  const lower = str.toLowerCase();
  
  if (lower === "iron_iron" || lower === "iron") return "Ironing";
  if (lower === "shirts_instant" || lower === "shirts instant") return "Shirts (Instant)";
  if (lower === "wash_fold" || lower === "washfold") return "Wash & Fold";
  if (lower === "wash_iron" || lower === "washiron") return "Wash & Iron";
  if (lower === "dry_clean" || lower === "dryclean") return "Dry Clean";
  if (lower === "standard standard" || lower === "standard") return "Standard";
  
  return str
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

/**
 * Formats a timestamp, Date object, or raw time slot string into a clean 12-hour time representation.
 * Properly handles 12:00 noon as PM and 00:00 midnight as AM, and replaces "standard standard" fallbacks.
 */
export function formatTimeSlot(raw) {
  if (raw === null || raw === undefined || raw === "" || raw === "—") return raw === "—" ? "—" : "";
  
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed.toLowerCase() === "standard standard" || trimmed.toLowerCase() === "standard") {
      return "Scheduled";
    }
    if (trimmed.startsWith("Timestamp(") || trimmed.includes("seconds=")) {
      const match = trimmed.match(/seconds=(\d+)/);
      if (match && match[1]) {
        const sec = parseInt(match[1], 10);
        if (!isNaN(sec)) {
          const d = new Date(sec * 1000);
          if (!isNaN(d.getTime())) {
            let hours = d.getHours();
            const minutes = String(d.getMinutes()).padStart(2, "0");
            const ampm = hours >= 12 ? "PM" : "AM";
            hours = hours % 12;
            if (hours === 0) hours = 12;
            return `${hours}:${minutes} ${ampm}`;
          }
        }
      }
      return "—";
    }
    if (trimmed === "[object Object]" || trimmed === "undefined" || trimmed === "null") {
      return "—";
    }
  }

  let d = null;
  if (typeof raw === "object" && raw !== null) {
    if (typeof raw.toDate === "function") {
      try {
        d = raw.toDate();
      } catch (e) {
        return "—";
      }
    } else if (raw instanceof Date) {
      d = raw;
    } else if (typeof raw.seconds === "number" || typeof raw._seconds === "number") {
      const sec = raw.seconds ?? raw._seconds;
      d = new Date(sec * 1000);
    } else {
      return "—";
    }
  } else if (typeof raw === "number") {
    d = new Date(raw < 100000000000 ? raw * 1000 : raw);
  } else if (typeof raw === "string" && !isNaN(Date.parse(raw))) {
    const parsed = new Date(raw);
    if (!isNaN(parsed.getTime())) d = parsed;
  }

  if (d && !isNaN(d.getTime())) {
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const seconds = d.getSeconds();
    if (hours === 0 && minutes === "00" && seconds === 0) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    if (hours === 0) hours = 12;
    return `${hours}:${minutes} ${ampm}`;
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    const timeMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
    if (timeMatch) {
      let h = parseInt(timeMatch[1], 10);
      const m = timeMatch[2];
      let ampm = timeMatch[4] ? timeMatch[4].toUpperCase() : (h >= 12 ? "PM" : "AM");
      if (!timeMatch[4]) {
        if (h === 12) ampm = "PM";
        else if (h === 0) { h = 12; ampm = "AM"; }
        else if (h > 12) { h = h - 12; ampm = "PM"; }
      }
      return `${h}:${m} ${ampm}`;
    }
    return trimmed;
  }

  return "—";
}
