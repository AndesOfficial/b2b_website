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

