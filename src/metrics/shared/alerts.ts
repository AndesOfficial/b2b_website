// Dashboard alerts. The server gathers the inputs every refresh and opens,
// keeps or auto-resolves one alert per rule per day (alerts/{rule}_{day}).
// Thresholds come from alert_rules/{rule}; missing docs use DEFAULT_ALERT_RULES.

export interface AlertRule {
  enabled: boolean;
  threshold: number;
  severity: "warning" | "critical";
}

export const DEFAULT_ALERT_RULES: Record<string, AlertRule & { label: string; unit: string }> = {
  overdue_orders: { label: "Open orders past their promised delivery", unit: "orders", enabled: true, threshold: 0, severity: "critical" },
  unverified_backlog: { label: "Orders unverified for 2+ days", unit: "orders", enabled: true, threshold: 0, severity: "warning" },
  receivables_overdue: { label: "Receivables past due date", unit: "₹", enabled: true, threshold: 0, severity: "warning" },
  revenue_drop: { label: "Yesterday's revenue below % of the 7-day average", unit: "%", enabled: true, threshold: 50, severity: "warning" },
  cash_low: { label: "Cash balance below", unit: "₹", enabled: false, threshold: 0, severity: "critical" },
};

export interface AlertInputs {
  overdueOrders: number;
  unverifiedOld: number;
  receivablesOverdue: number;
  /** Yesterday's verified revenue and the average of the 7 days before it; null when no history. */
  revenueYesterday: number | null;
  revenueAvg7: number | null;
  cashBalance: number | null;
}

export interface AlertResult {
  rule: string;
  triggered: boolean;
  value: number | null;
  severity: "warning" | "critical";
  message: string;
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export function evaluateAlerts(inputs: AlertInputs, overrides: Record<string, Partial<AlertRule>> = {}): AlertResult[] {
  const out: AlertResult[] = [];
  for (const [rule, def] of Object.entries(DEFAULT_ALERT_RULES)) {
    const r = { ...def, ...(overrides[rule] || {}) };
    if (!r.enabled) continue;
    let value: number | null = null;
    let triggered = false;
    let message = "";
    switch (rule) {
      case "overdue_orders":
        value = inputs.overdueOrders;
        triggered = value > r.threshold;
        message = `${value} open order(s) are past their promised delivery time.`;
        break;
      case "unverified_backlog":
        value = inputs.unverifiedOld;
        triggered = value > r.threshold;
        message = `${value} order(s) picked up 2+ days ago are still not verified by the manager.`;
        break;
      case "receivables_overdue":
        value = inputs.receivablesOverdue;
        triggered = value > r.threshold;
        message = `${inr(value)} of invoices are past their due date.`;
        break;
      case "revenue_drop":
        if (inputs.revenueYesterday == null || !inputs.revenueAvg7) break;
        value = Math.round((inputs.revenueYesterday / inputs.revenueAvg7) * 100);
        triggered = value < r.threshold;
        message = `Yesterday's revenue ${inr(inputs.revenueYesterday)} is ${value}% of the 7-day average (${inr(inputs.revenueAvg7)}).`;
        break;
      case "cash_low":
        if (inputs.cashBalance == null) break;
        value = inputs.cashBalance;
        triggered = value < r.threshold;
        message = `Cash balance ${inr(value)} is below ${inr(r.threshold)}.`;
        break;
    }
    out.push({ rule, triggered, value, severity: r.severity, message });
  }
  return out;
}
