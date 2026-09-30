import { useMemo } from "react";
import { ORDER_CATEGORIES, ORDER_TYPES } from "../constants/orders";

const DEFAULT_HOTEL_COLORS = { "Airbnb Viman Nagar": "#D97706" };
const FALLBACK_HOTEL_COLORS = ["#D97706", "#1976D2", "#7C3AED", "#059669", "#BE185D", "#0891B2"];
const HIDDEN_HOTEL_RECORDS = new Set([]);

function getHotelColor(name, index) {
  return DEFAULT_HOTEL_COLORS[name] || FALLBACK_HOTEL_COLORS[index % FALLBACK_HOTEL_COLORS.length];
}

function isHotelOrder(order) {
  const propertyName = String(order.property || "").toLowerCase();
  return order.type === ORDER_TYPES.AIRBNB
    || order.category === ORDER_CATEGORIES.AIRBNB
    || propertyName.includes("airbnb")
    || propertyName.includes("hotel");
}

function hasMeaningfulHotelData(order) {
  const detailCount = Object.values(order.details || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
  // Show order if it has an amount OR if it has items logged (even if amount is 0)
  return (order.amount || 0) > 0 || detailCount > 0 || (order.items || 0) > 0;
}

function isHiddenHotelRecord(order) {
  const key = `${String(order.property || "").trim().toLowerCase()}::${order.date}`;
  return HIDDEN_HOTEL_RECORDS.has(key);
}

export function useHotelMetrics(orders) {
  const hotelOrders = useMemo(
    () => orders.filter((order) => isHotelOrder(order) && hasMeaningfulHotelData(order) && !isHiddenHotelRecord(order)),
    [orders]
  );

  const sortedHotelOrders = useMemo(
    () => [...hotelOrders].sort((left, right) => new Date(right.date) - new Date(left.date)),
    [hotelOrders]
  );

  const hotelProperties = useMemo(
    () => [...new Set(hotelOrders.map((order) => order.property).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [hotelOrders]
  );

  const hotelSummaries = useMemo(
    () =>
      hotelProperties.map((name, index) => {
        const propertyOrders = hotelOrders.filter((order) => order.property === name);
        const revenue = propertyOrders.reduce((sum, order) => sum + (order.amount || 0), 0);

        return {
          color: getHotelColor(name, index),
          name,
          orders: propertyOrders,
          revenue,
        };
      }).filter((summary) => summary.orders.length > 0),
    [hotelOrders, hotelProperties]
  );

  return {
    hotelSummaries,
    sortedHotelOrders,
  };
}
