export const HOTEL_ITEMS = [
  "Single Bedsheet",
  "Double Bedsheet",
  "Duvet Cover",
  "Pillow Cover",
  "Bath towel",
  "Hand towel",
  "Face towel",
  "Bath mat",
  "Blanket",
];

export const ZOLO_ITEMS = [
  "Single Bedsheet",
  "Double Bedsheet",
  "Duvet Cover",
  "Pillow Cover",
  "Bath towel",
  "Blanket",
  "Curtain",
  "Door mat",
];

export const ONE8_ITEMS = [
  "Wiping Cloth",
  "Chef Coat",
  "T-Shirt",
  "Pant",
  "Apron",
  "Napkin",
  "Blazer",
  "Cap",
];

export const STUDENT_RATE_PER_KG = 55;
export const HOSTEL_99_MONTHLY_REVENUE = 28000;

export const ONE8_RATE_MAP = {
  "Wiping Cloth": 9,
  "Chef Coat": 13,
  "T-Shirt": 13,
  "Pant": 13,
  "Apron": 9,
  "Napkin": 6,
  "Blazer": 200,
  "Cap": 5,
};

export const ZOLO_RATE_MAP = {
  "Towel": 12,
  "Bath towel": 12,
  "Bath Towel": 12,
  "Single Bedsheet": 13,
  "Single Bed Sheet": 13,
  "Double Bedsheet": 15,
  "Double Bed Sheet": 15,
  "Pillow Cover": 10,
  "Single Duvet Cover": 30,
  "Double Duvet Cover": 35,
  "King Duvet Cover": 35,
  "Duvet Cover": 35,
};

export const ZOLO_ITEM_WEIGHTS = {
  "Single Bedsheet": 0.47,
  "Single Bed Sheet": 0.47,
  "Double Bedsheet": 0.87,
  "Double Bed Sheet": 0.87,
  "Single Duvet Cover": 0.92,
  "Duvet Cover Single": 0.92,
  "Double Duvet Cover": 1.5,
  "Duvet Cover Double": 1.5,
  "King Duvet Cover": 1.5,
  "Pillow Cover": 0.175,
  "Towel": 0.72,
  "Bath towel": 0.72,
  "Bath Towel": 0.72,
};

export const ITEM_RATE_MAP = {
  "Single Bedsheet": 30,
  "Bedsheet": 30,
  "Double Bedsheet": 45,
  "Duvet Cover": 30,
  "Pillow Cover": 10,
  "Bath towel": 20,
  "Bath Towel": 20,
  "Hand towel": 10,
  "Hand Towel": 10,
  "Face towel": 10,
  "Face Towel": 10,
  "Bath mat": 20,
  "Bath Mat": 20,
  "Blanket": 110,
  "Curtain": 75,
  "Door Mat": 49,
  ...ONE8_RATE_MAP,
};

export function isHostel99Client(clientName) {
  const c = String(clientName || "").trim().toLowerCase();
  return c.includes("hostel 99") || c.includes("hostel99") || c.startsWith("99");
}

export function getDaysInMonth(dateStr) {
  if (!dateStr || typeof dateStr !== "string") {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  }
  const dStr = dateStr.split("T")[0];
  const parts = dStr.split(/[-/]/);
  if (parts.length >= 2) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    if (!isNaN(year) && !isNaN(month) && month >= 1 && month <= 12) {
      return new Date(year, month, 0).getDate();
    }
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

export function calculateBatchRevenue(entry, countOnDate = 1) {
  const clientLower = String(entry.client || entry.property || "").toLowerCase();

  // Hostel 99 orders have a combined fixed monthly revenue of ₹28,000 across all properties.
  // For each order daily, divide 28,000 by (number of days in month * count of batches on that day).
  if (isHostel99Client(clientLower)) {
    const daysInMonth = getDaysInMonth(entry.date);
    const dailyTotal = HOSTEL_99_MONTHLY_REVENUE / daysInMonth;
    const safeCount = Math.max(1, countOnDate || 1);
    return parseFloat((dailyTotal / safeCount).toFixed(2));
  }

  const isOne8 = clientLower.includes("one 8") || clientLower.includes("one8");
  const isZolo = clientLower.includes("zolo");

  let total = 0;
  let hasItemRevenue = false;

  const items = entry.items || entry.itemsList;
  if (Array.isArray(items) && items.length > 0) {
    items.forEach((it) => {
      const qty = Number(it.qty ?? it.quantity) || 0;
      if (qty <= 0) return;
      const nameLower = String(it.name || "").trim().toLowerCase();
      let rate = 0;
      if (isOne8) {
        rate = ONE8_RATE_MAP[it.name] ||
          (nameLower.includes("wiping") ? 9 :
           nameLower.includes("chef") ? 13 :
           nameLower.includes("t-shirt") || nameLower.includes("tshirt") ? 13 :
           nameLower.includes("pant") || nameLower.includes("trouser") ? 13 :
           nameLower.includes("apron") ? 9 :
           nameLower.includes("napkin") ? 6 :
           nameLower.includes("blazer") ? 200 :
           nameLower.includes("cap") ? 5 : 0);
      } else if (isZolo) {
        rate = ZOLO_RATE_MAP[it.name] ||
          (nameLower.includes("pillow") ? 10 :
           nameLower.includes("towel") ? 12 :
           nameLower.includes("single bedsheet") || nameLower.includes("single bed sheet") ? 13 :
           nameLower.includes("double bedsheet") || nameLower.includes("double bed sheet") ? 15 :
           nameLower.includes("single duvet") ? 30 :
           nameLower.includes("double duvet") || nameLower.includes("king duvet") ? 35 :
           (ITEM_RATE_MAP[it.name] || 0));
      } else {
        rate = ITEM_RATE_MAP[it.name] ||
          (nameLower.includes("bedsheet") ? 30 :
           nameLower.includes("towel") ? 20 :
           nameLower.includes("blanket") ? 110 :
           nameLower.includes("cover") ? 25 : 15);
      }

      if (rate > 0) {
        total += qty * rate;
        hasItemRevenue = true;
      }
    });
  }

  // If entry already carries an explicitly confirmed calculatedRevenue, respect it
  if (!hasItemRevenue && Number(entry.calculatedRevenue) > 0) {
    return Number(entry.calculatedRevenue);
  }

  // Fallback to bulk kg calculation if no itemized rate matched
  const weight = Number(entry.kg ?? entry.weight) || 0;
  if (!hasItemRevenue && weight > 0) {
    const kgRate = 35; // Standard B2B / hostel rate per kg
    total = weight * kgRate;
  }

  return Math.round(total);
}

export function getItemsForPartner(partnerName) {
  if (!partnerName) return HOTEL_ITEMS;
  const lower = String(partnerName).toLowerCase().trim();
  if (lower.includes("one 8") || lower.includes("one8")) {
    return ONE8_ITEMS;
  }
  if (lower.includes("zolo")) {
    return ZOLO_ITEMS;
  }
  return HOTEL_ITEMS;
}

