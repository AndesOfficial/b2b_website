// andes_metrics: the one definition of every dashboard KPI, shared by the
// Admin site and Cloud Functions. Edit here, then run ../sync.sh.
export { buildRecords, b2cRecord, b2bRecord, istDay } from "./records.js";
export type { MetricRecord, RecordSources } from "./records.js";
export { computeKpis, emptyTotals, firstVerifiedDays, kpisFromTotals, mergeTotals, totalsFor } from "./kpis.js";
export type { Kpi, KpiMap, Totals } from "./kpis.js";
export { KPI_REGISTRY } from "./registry.js";
export { addDays, eachDay, todayIst } from "./days.js";
export { calculateBatchRevenue, isHostel99Client } from "./rateCard.js";
