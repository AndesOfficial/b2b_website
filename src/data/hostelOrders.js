// src/data/hostelOrders.js
// All order data extracted from Andes_Daily_Record.xlsx
// Categories: Linen Services, Student Laundry, B2C Retail, Airbnb/Hotel, Bulk Laundry, Issues

export const CATEGORIES = {
  LINEN: { key: "LINEN", label: "Linen Services (B2B)", color: "#7C3AED", icon: "🛏️" },
  STUDENT_LAUNDRY: { key: "STUDENT_LAUNDRY", label: "Student Laundry (B2B)", color: "#1976D2", icon: "👕" },
  INDIVIDUAL_STUDENT: { key: "INDIVIDUAL_STUDENT", label: "Student Direct Orders", color: "#0EA5E9", icon: "📱" },
  B2C_RETAIL: { key: "B2C_RETAIL", label: "Retail Customers (B2C)", color: "#059669", icon: "🧺" },
  AIRBNB: { key: "AIRBNB", label: "Airbnb Services", color: "#D97706", icon: "🏨" },
  BULK_LAUNDRY: { key: "BULK_LAUNDRY", label: "Bulk Laundry", color: "#0891B2", icon: "⚙️" },
  ISSUES: { key: "ISSUES", label: "Issues & Complaints", color: "#DC2626", icon: "⚠️" },
};

export function getCategoryLabel(categoryKey, propertyName = "") {
  if (categoryKey === CATEGORIES.AIRBNB.key) {
    const normalized = String(propertyName || "").toLowerCase();
    return normalized.includes("airbnb") ? "Airbnb Services" : "Hotel Service";
  }

  return CATEGORIES[categoryKey]?.label || categoryKey;
}

export function getCategoryForProperty(property) {
  const propLower = String(property).toLowerCase();
  if (propLower.includes("hostel 99") || propLower.includes("hostel99") || propLower.includes("airbnb viman nagar")) {
    return propLower.includes("airbnb") ? CATEGORIES.AIRBNB : CATEGORIES.LINEN;
  }
  if (["Samriddhi", "Gurukul"].includes(property)) return CATEGORIES.BULK_LAUNDRY;
  if (property === "Regular Customers") return CATEGORIES.B2C_RETAIL;
  if (property === "Issues") return CATEGORIES.ISSUES;
  return CATEGORIES.STUDENT_LAUNDRY;
}
