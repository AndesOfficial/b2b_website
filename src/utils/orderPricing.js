export const DEFAULT_REGULAR_RATE_MAP = {
  "Wash & Fold": 79,
  "Wash & Iron": 99,
  "Wash & Fold + Iron": 120,
  "Dry Clean": 150,
  Other: 0,
};

// Per-kg service name matcher (same as mobile apps & catalog)
const KG_SERVICE_KEYWORDS = [
  "wash & fold",
  "wash and fold",
  "wash & iron",
  "wash and iron",
  "wash & fold + iron",
  "wash and fold + iron",
  "wash & dry",
  "wash and dry",
];

export function isKgService(serviceName = "") {
  const norm = String(serviceName).toLowerCase().replace(/_/g, " ").trim();
  return KG_SERVICE_KEYWORDS.some((kw) => norm.includes(kw));
}

/**
 * Extracts the effective per-kg rate for a service from order metadata,
 * breakdown history, or catalog defaults.
 */
export function getServiceRatePerKg(serviceName = "", order = {}) {
  const normName = String(serviceName).toLowerCase().trim();

  // 1. Explicit ratePerKg on the order
  if (typeof order.ratePerKg === "number" && order.ratePerKg > 0) {
    return order.ratePerKg;
  }

  // 2. Rate from order.breakdown.perKg.services map
  const breakdownKgServices = order.breakdown?.perKg?.services;
  if (breakdownKgServices && typeof breakdownKgServices === "object") {
    for (const [key, rate] of Object.entries(breakdownKgServices)) {
      if (typeof rate === "number" && rate > 0) {
        if (!normName || key.toLowerCase().includes(normName) || normName.includes(key.toLowerCase())) {
          return rate;
        }
      }
    }
  }

  // 3. Rate from breakdown.perKg.items
  const breakdownItems = order.breakdown?.perKg?.items;
  if (Array.isArray(breakdownItems) && breakdownItems.length > 0) {
    const matched = breakdownItems.find((it) => {
      const itName = String(it.name || "").toLowerCase();
      return !normName || itName.includes(normName) || normName.includes(itName);
    }) || breakdownItems[0];
    if (typeof matched?.rate === "number" && matched.rate > 0) {
      return matched.rate;
    }
  }

  // 4. Rate from breakdown.perKg.highestRate
  if (typeof order.breakdown?.perKg?.highestRate === "number" && order.breakdown.perKg.highestRate > 0) {
    return order.breakdown.perKg.highestRate;
  }

  // 5. Rate from serviceBreakdown line items
  if (Array.isArray(order.serviceBreakdown) && order.serviceBreakdown.length > 0) {
    for (const line of order.serviceBreakdown) {
      if (typeof line.rate === "number" && line.rate > 0) {
        return line.rate;
      }
      const lineWeight = Number(line.weight);
      const lineAmount = Number(line.amount);
      if (lineWeight > 0 && lineAmount > 0) {
        const inferredRate = Math.round(lineAmount / lineWeight);
        if (inferredRate > 0) return inferredRate;
      }
    }
  }

  // 6. Inferred from previous total and weight if single service order
  const orderWeight = Number(order.weight ?? order.clothesWeightKg ?? 0);
  const orderAmount = Number(order.amount ?? order.totalCost ?? 0);
  if (orderWeight > 0 && orderAmount > 0) {
    const candidateRate = Math.round(orderAmount / orderWeight);
    if (candidateRate >= 30 && candidateRate <= 300) {
      return candidateRate;
    }
  }

  // 7. Catalog / DEFAULT_REGULAR_RATE_MAP fallbacks
  if (normName.includes("iron")) {
    if (normName.includes("fold")) {
      return DEFAULT_REGULAR_RATE_MAP["Wash & Fold + Iron"] || 120;
    }
    return DEFAULT_REGULAR_RATE_MAP["Wash & Iron"] || 99;
  }
  if (normName.includes("fold")) {
    return DEFAULT_REGULAR_RATE_MAP["Wash & Fold"] || 79;
  }

  return 79; // Standard default Wash & Fold rate per kg
}

/**
 * Recalculates the complete B2C order bill, breakdown, and totals given a new weight.
 *
 * Preserves:
 *  - Fixed piece-rate items (dry cleaning, shoe cleaning, etc.)
 *  - Convenience / delivery fees
 *  - Coupon and promotional discounts
 *  - Wallet deduction
 *
 * Returns an object containing all fields needed across all consumer apps:
 *  - amount, totalCost, originalTotalCost, calculatedAmount
 *  - weight, clothesWeightKg
 *  - ratePerKg
 *  - breakdown (full schema used by User App & Rider App)
 *  - serviceBreakdown (used by Admin Portal)
 */
export function recalculateB2COrderTotal(order = {}, newWeightRaw = 0, manualAmountOverride = null) {
  const newWeight = Math.max(0, parseFloat(newWeightRaw) || 0);

  // 1. Identify existing service lines
  let serviceBreakdown = Array.isArray(order.serviceBreakdown) && order.serviceBreakdown.length > 0
    ? order.serviceBreakdown.map((item) => ({ ...item }))
    : [];

  // If no serviceBreakdown, create from order.service or order.breakdown
  if (serviceBreakdown.length === 0) {
    const primaryName = order.service || "Wash & Fold";
    serviceBreakdown = [
      {
        id: `svc-${Date.now()}`,
        name: primaryName,
        weight: newWeight,
        quantity: Number(order.items || order.clothesCount || 1),
        amount: 0,
      }
    ];
  }

  // Determine which services are per-kg vs per-piece
  let totalKgWeightExisting = 0;
  serviceBreakdown.forEach((item) => {
    if (isKgService(item.name || item.serviceType)) {
      totalKgWeightExisting += Number(item.weight || 0);
    }
  });

  // Calculate new per-kg and per-piece sub-totals
  let kgCost = 0;
  let pieceCost = 0;
  let primaryRatePerKg = 0;

  const updatedServiceBreakdown = serviceBreakdown.map((item) => {
    const name = item.name || item.serviceType || "Wash & Fold";
    if (isKgService(name)) {
      const rate = getServiceRatePerKg(name, order);
      if (!primaryRatePerKg) primaryRatePerKg = rate;

      // Assign weight: if single kg service, it gets all newWeight;
      // if multiple, assign proportionally or to the first
      let assignedWeight = newWeight;
      if (totalKgWeightExisting > 0 && Number(item.weight) > 0) {
        assignedWeight = Math.round((Number(item.weight) / totalKgWeightExisting) * newWeight * 10) / 10;
      }
      const itemAmount = Math.round(assignedWeight * rate);
      kgCost += itemAmount;

      return {
        ...item,
        name,
        rate,
        weight: assignedWeight,
        amount: itemAmount,
      };
    } else {
      // Piece-based service
      const itemAmount = Number(item.amount || 0);
      pieceCost += itemAmount;
      return { ...item, name };
    }
  });

  // If no per-kg service was found in breakdown, assume primary service is per-kg
  if (kgCost === 0 && newWeight > 0) {
    const fallbackRate = getServiceRatePerKg(order.service || "Wash & Fold", order);
    primaryRatePerKg = fallbackRate;
    kgCost = Math.round(newWeight * fallbackRate);
    if (updatedServiceBreakdown.length > 0) {
      updatedServiceBreakdown[0].weight = newWeight;
      updatedServiceBreakdown[0].rate = fallbackRate;
      updatedServiceBreakdown[0].amount = kgCost;
    }
  }

  // Fallback for piece cost if not in serviceBreakdown but in order.breakdown.perPiece
  if (pieceCost === 0 && typeof order.breakdown?.perPiece?.subtotal === "number") {
    pieceCost = Number(order.breakdown.perPiece.subtotal);
  }

  // Fees & Extra Charges
  const convenienceFee = Number(
    order.convenienceFee ?? order.breakdown?.fees?.convenienceFee ?? 0
  );
  const extraCharges = Number(
    order.deliveryFee ??
    order.charges ??
    order.breakdown?.fees?.chargesSubtotal ??
    order.deliveryCharge ??
    0
  );

  // Discounts
  const couponDiscount = Number(
    order.couponDiscount ??
    order.breakdown?.couponDiscount ??
    order.breakdown?.fees?.couponDiscount ??
    0
  );
  const promotionDiscount = Number(
    order.promotionDiscount ??
    order.promoDiscount ??
    order.breakdown?.promotionDiscount ??
    order.breakdown?.fees?.promotionDiscount ??
    0
  );
  const walletAmountUsed = Number(
    order.walletAmountUsed ??
    order.breakdown?.fees?.walletAmountUsed ??
    0
  );

  // Computed Totals
  const subtotalBeforeDiscounts = kgCost + pieceCost + convenienceFee + extraCharges;
  const calculatedOriginalTotal = Math.max(0, Math.round(subtotalBeforeDiscounts - couponDiscount - promotionDiscount));
  const calculatedFinalTotal = Math.max(0, Math.round(calculatedOriginalTotal - walletAmountUsed));

  // If manual override is explicitly provided, respect it for final total
  const finalTotal = manualAmountOverride !== null && manualAmountOverride !== undefined && !isNaN(Number(manualAmountOverride))
    ? Math.max(0, Math.round(Number(manualAmountOverride)))
    : calculatedFinalTotal;

  const originalTotalCost = manualAmountOverride !== null && manualAmountOverride !== undefined && !isNaN(Number(manualAmountOverride))
    ? Math.max(0, Math.round(Number(manualAmountOverride) + walletAmountUsed))
    : calculatedOriginalTotal;

  // Build breakdown object matching User App and Rider App schema
  const primaryServiceName = updatedServiceBreakdown[0]?.name || order.service || "Wash & Fold";
  const updatedBreakdown = {
    ...(order.breakdown || {}),
    perKg: {
      ...(order.breakdown?.perKg || {}),
      services: {
        ...(order.breakdown?.perKg?.services || {}),
        [primaryServiceName]: primaryRatePerKg || 79,
      },
      items: [
        {
          name: primaryServiceName,
          rate: primaryRatePerKg || 79,
          weight: newWeight,
          subtotal: kgCost,
        }
      ],
      highestRate: primaryRatePerKg || 79,
      weight: newWeight,
      subtotal: kgCost,
    },
    perPiece: {
      ...(order.breakdown?.perPiece || {}),
      subtotal: pieceCost,
      items: order.breakdown?.perPiece?.items || [],
    },
    fees: {
      ...(order.breakdown?.fees || {}),
      convenienceFee,
      chargesSubtotal: extraCharges,
      walletAmountUsed,
      couponDiscount,
      promotionDiscount,
    },
    couponDiscount,
    promotionDiscount,
    total: finalTotal,
    totalCost: finalTotal,
  };

  // Build perKgDetails for legacy sync
  const updatedPerKgDetails = {
    ...(order.perKgDetails || {}),
    [primaryServiceName]: {
      ...(order.perKgDetails?.[primaryServiceName] || {}),
      rate: primaryRatePerKg || 79,
      weight: newWeight,
      subtotal: kgCost,
      amount: kgCost,
    }
  };

  return {
    amount: finalTotal,
    totalCost: finalTotal,
    originalTotalCost,
    calculatedAmount: finalTotal,
    weight: newWeight,
    clothesWeightKg: newWeight,
    ratePerKg: primaryRatePerKg || 79,
    breakdown: updatedBreakdown,
    perKgDetails: updatedPerKgDetails,
    serviceBreakdown: updatedServiceBreakdown,
  };
}
