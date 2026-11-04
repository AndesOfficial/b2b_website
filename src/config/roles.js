// Admin-site roles (b2b_managers/{uid}.role). Firestore rules enforce the same
// split (andes_now_rider/firestore.rules: isMoneyStaff / isOpsStaff); hiding a
// tab here is convenience, not security.
//   admin         everything, can edit
//   admin_viewer  everything, read-only
//   finance       money tabs (dashboard, finance, expenses, salaries, investors), can edit them
//   ops           orders and operations, no money figures
export const ADMIN_ROLES = ["admin", "admin_viewer", "finance", "ops"];

export const isAdminRole = (role) => ADMIN_ROLES.includes(role);

const OPS_TABS = ["dashboard", "b2b", "regular", "issues", "dailyReport", "services"];
const FINANCE_TABS = ["dashboard", "overview", "analytics", "finance", "expenses", "salaries", "calculator", "investors", "coupons", "metaleads"];

/** Whether `role` may open the admin tab `tabKey`. */
export function canSeeTab(role, tabKey) {
  if (role === "admin" || role === "admin_viewer") return true;
  if (role === "finance") return FINANCE_TABS.includes(tabKey);
  if (role === "ops") return OPS_TABS.includes(tabKey);
  return false;
}

/** Whether `role` may see money figures (revenue, expenses, receivables). */
export const seesMoney = (role) => role === "admin" || role === "admin_viewer" || role === "finance";

/** Whether `role` may change data (viewers never can). */
export const canEdit = (role) => role === "admin" || role === "finance" || role === "ops";
