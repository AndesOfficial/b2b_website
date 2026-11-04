// andes_metrics: the one definition of every dashboard KPI, shared by the
// Admin site and Cloud Functions. Edit here, then run ../sync.sh.
export { buildRecords, b2cRecord, b2bRecord, istDay } from "./records.js";
export type { MetricRecord, RecordSources } from "./records.js";
export { computeKpis, emptyTotals, firstVerifiedDays, kpisFromTotals, mergeTotals, totalsFor } from "./kpis.js";
export type { Kpi, KpiMap, Totals } from "./kpis.js";
export { KPI_REGISTRY } from "./registry.js";
export { addDays, eachDay, todayIst } from "./days.js";
export { calculateBatchRevenue, isHostel99Client } from "./rateCard.js";
export {
  AGEING_BUCKETS, DEFAULT_CREDIT_DAYS, EXPENSE_CATEGORIES, LEGACY_CATEGORY_MAP,
  ageing, cashBalance, dso, estimatedContribution, expenseTotals, findDuplicateExpenses,
  invoiceOutstanding, invoicePaid, invoiceStatus, normalizeExpense, standardCostsOn,
} from "./finance.js";
export type { Expense, ExpenseNature, ExpenseTotals, StandardCosts } from "./finance.js";
export { OPEN_STATUSES, opsMetrics } from "./ops.js";
export type { OpsMetrics } from "./ops.js";
export { ACQUISITION_SOURCES, REFERRAL_COST_PER_CUSTOMER, UNKNOWN_SOURCE, acquisitionTable, firstTouchSource, matchSource } from "./attribution.js";
export type { AcquisitionRow } from "./attribution.js";
export { DEFAULT_ALERT_RULES, evaluateAlerts } from "./alerts.js";
export type { AlertInputs, AlertResult, AlertRule } from "./alerts.js";
