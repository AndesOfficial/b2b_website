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
  "Yellow Wiping Cloth",
  "White Wiping Cloth",
  "White Chef Coat",
  "Black Chef Coat",
  "Beanie Chef Cap",
  "Wiping Cloth",
  "Chef Coat",
  "Cap",
  "T-Shirt",
  "Pant",
  "Apron",
  "Napkin",
  "Blazer",
];

export const STUDENT_RATE_PER_KG = 55;
export const HOSTEL_99_MONTHLY_REVENUE = 28000;

export const ONE8_RATE_MAP = {
  "Yellow Wiping Cloth": 9,
  "White Wiping Cloth": 9,
  "Wiping Cloth": 9,
  "White Chef Coat": 13,
  "Black Chef Coat": 13,
  "Chef Coat": 13,
  "Beanie Chef Cap": 5,
  "Cap": 5,
  "T-Shirt": 13,
  "Pant": 13,
  "Apron": 9,
  "Napkin": 6,
  "Blazer": 200,
};

export const ONE8_ITEM_WEIGHTS = {
  "Yellow Wiping Cloth": 0.11,
  "White Wiping Cloth": 0.135,
  "Wiping Cloth": 0.11,
  "White Chef Coat": 0.32,
  "Black Chef Coat": 0.5,
  "Chef Coat": 0.32,
  "Beanie Chef Cap": 0.05,
  "Cap": 0.05,
  "T-Shirt": 0.2,
  "Pant": 0.4,
  "Apron": 0.15,
  "Napkin": 0.05,
  "Blazer": 0.8,
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

export function calculateB2bWeight(items, clientName = "") {
  if (!Array.isArray(items) || !items.length) return 0;
  let total = 0;
  items.forEach((it) => {
    if (!it || typeof it !== "object") return;
    const qty = Number(it.qty ?? it.quantity) || 0;
    if (qty <= 0) return;
    const rawName = String(it.name || "").trim();
    const name = rawName.toLowerCase();
    let unitWeight = 0;

    // Direct dictionary match
    if (ONE8_ITEM_WEIGHTS[rawName] !== undefined) {
      unitWeight = ONE8_ITEM_WEIGHTS[rawName];
    } else if (ZOLO_ITEM_WEIGHTS[rawName] !== undefined) {
      unitWeight = ZOLO_ITEM_WEIGHTS[rawName];
    }
    // One8 items fuzzy matching
    else if (name.includes("yellow") && (name.includes("wiping") || name.includes("cloth"))) {
      unitWeight = 0.11;
    } else if (name.includes("white") && (name.includes("wiping") || name.includes("cloth"))) {
      unitWeight = 0.135;
    } else if (name.includes("wiping") || (name.includes("cloth") && !name.includes("table"))) {
      unitWeight = 0.11;
    } else if (name.includes("white") && name.includes("chef")) {
      unitWeight = 0.32;
    } else if (name.includes("black") && name.includes("chef")) {
      unitWeight = 0.5;
    } else if (name.includes("chef") || name.includes("coat")) {
      unitWeight = 0.32;
    } else if (name.includes("beanie") || name.includes("cap")) {
      unitWeight = 0.05;
    } else if (name.includes("apron")) {
      unitWeight = 0.15;
    } else if (name.includes("napkin")) {
      unitWeight = 0.05;
    } else if (name.includes("pant") || name.includes("trouser")) {
      unitWeight = 0.4;
    } else if (name.includes("t-shirt") || name.includes("tshirt")) {
      unitWeight = 0.2;
    } else if (name.includes("blazer")) {
      unitWeight = 0.8;
    }
    // Linen / Hostel 99 / Zolo items fuzzy matching
    else if (name.includes("pillow")) {
      unitWeight = 0.175;
    } else if (name.includes("towel")) {
      unitWeight = 0.72;
    } else if (name.includes("single duvet") || name.includes("duvet cover single")) {
      unitWeight = 0.92;
    } else if (name.includes("double duvet") || name.includes("king duvet") || name.includes("duvet cover")) {
      unitWeight = 1.5;
    } else if (name.includes("single bedsheet") || name.includes("single bed sheet")) {
      unitWeight = 0.47;
    } else if (name.includes("double bedsheet") || name.includes("double bed sheet")) {
      unitWeight = 0.87;
    }

    total += qty * unitWeight;
  });
  return Math.round(total * 10) / 10;
}

export const calculateLinenWeight = calculateB2bWeight;

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

