// Service catalog (`prices` collection) — values the admin Services page
// offers. The customer app builds its category chips from these, so a new
// category also needs app work; that is why the list is fixed here.
export const SERVICE_CATEGORIES = [
  { value: "general", label: "General" },
  { value: "dry cleaning", label: "Dry Cleaning" },
  { value: "household", label: "Household" },
  { value: "shoes", label: "Footwear" },
  { value: "bags", label: "Bags" },
  { value: "premiumGeneral", label: "Premium General" },
  { value: "premiumOthers", label: "Premium Others" },
];

// active: everywhere · hidden: riders only · archived: nowhere.
export const SERVICE_STATUSES = [
  { value: "active", label: "Active", hint: "Visible to customers and riders", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { value: "hidden", label: "Hidden", hint: "Hidden from customers; riders can still bill it", tone: "bg-amber-50 text-amber-700 border-amber-200" },
  { value: "archived", label: "Archived", hint: "Gone from every app; kept for old orders", tone: "bg-slate-100 text-slate-500 border-slate-200" },
];

export const SERVICE_UNITS = ["piece", "pair", "kg"];

export const MAX_SERVICE_IMAGE_BYTES = 2 * 1024 * 1024;
