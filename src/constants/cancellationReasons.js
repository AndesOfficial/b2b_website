// Must match CANCELLATION_REASONS in andes_now_rider/functions/src/order_events.ts.
export const CANCELLATION_REASONS = {
  customer_unavailable: "Customer unavailable",
  price: "Price",
  delay: "Delay",
  service_issue: "Service issue",
  duplicate: "Duplicate order",
  other: "Other",
};
