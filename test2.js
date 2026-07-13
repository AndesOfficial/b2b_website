import { normalizeOrder } from "./src/utils/orderNormalization.js";
const rawOrder = {
  createdAt: "July 9, 2026 at 8:14:43 PM UTC+5:30",
  orderTimestamp: 1783608282971,
  selectionSource: "website",
  totalCost: 10,
  totalItems: 2
};
const order = normalizeOrder(rawOrder, "cartdetails");
console.log(order);
