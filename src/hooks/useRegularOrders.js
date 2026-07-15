import { useMemo } from "react";

export const REGULAR_CHANNELS = ["All", "App", "Auto", "Website", "WhatsApp", "Outlet", "Call", "Student", "Cancelled"];
export const REGULAR_SERVICE_TYPES = ["Wash & Fold", "Wash & Iron", "Wash & Fold + Iron", "Dry Clean", "Other"];
export const REGULAR_RATE_MAP = {
  "Wash & Fold": 55,
  "Wash & Iron": 90,
  "Wash & Fold + Iron": 120,
  "Dry Clean": 150,
  Other: 0,
};
export const REGULAR_STATUS_OPTIONS = ["Confirmed", "Pickup Done", "In Progress", "Delivered", "Pending"];

const generateServiceLineId = () => `svc-line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function createRegularServiceLine(overrides = {}) {
  return {
    id: generateServiceLineId(),
    serviceType: REGULAR_SERVICE_TYPES[0],
    weight: "",
    quantity: "",
    amount: "",
    ...overrides,
  };
}

export function createEmptyRegularOrderForm() {
  return {
    customerName: "",
    phone: "",
    channel: "App",
    amount: "",
    pickupDate: "",
    deliveryDate: "",
    notes: "",
    status: "Confirmed",
    id: null,
    serviceBreakdown: [createRegularServiceLine()],
    originalOrder: null,
  };
}

export function getServiceLabel(service = "") {
  const [label] = String(service).split(/\s(?:—|-)\s/u);
  return label || "Wash & Fold";
}

export function useRegularOrders(orders, channelFilter) {
  const regularOrders = useMemo(
    () => orders.filter((order) => order.type === "regular"),
    [orders]
  );

  const filteredOrders = useMemo(() => {
    let scopedOrders;
    const isCancelled = (order) => order.status === "Cancelled" || order.status === "Abandoned" || order.type === "abandoned";

    if (channelFilter === "All") {
      scopedOrders = regularOrders.filter((order) => !isCancelled(order));
    } else if (channelFilter === "Cancelled") {
      scopedOrders = regularOrders.filter((order) => isCancelled(order));
    } else {
      scopedOrders = regularOrders.filter((order) => order.channel === channelFilter && !isCancelled(order));
    }

    return [...scopedOrders].sort((left, right) => new Date(right.date || 0) - new Date(left.date || 0));
  }, [channelFilter, regularOrders]);

  const channelStats = useMemo(() => {
    const stats = Object.fromEntries(
      REGULAR_CHANNELS.filter((channel) => channel !== "All").map((channel) => [channel, { count: 0, revenue: 0 }])
    );

    regularOrders.forEach((order) => {
      const isCancelled = order.status === "Cancelled" || order.status === "Abandoned" || order.type === "abandoned";
      
      if (isCancelled) {
        if (stats["Cancelled"]) {
          stats["Cancelled"].count += 1;
          stats["Cancelled"].revenue += order.amount || 0;
        }
        return; // Skip adding to the original channel (e.g. App)
      }

      if (!stats[order.channel]) return;
      stats[order.channel].count += 1;
      stats[order.channel].revenue += order.amount || 0;
    });

    return stats;
  }, [regularOrders]);

  return {
    channelStats,
    filteredOrders,
  };
}
