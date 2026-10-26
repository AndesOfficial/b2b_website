import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  FiX,
  FiDownload,
  FiFileText,
  FiPlus,
  FiTrash2,
  FiRefreshCw,
  FiCalendar,
  FiEdit3,
} from "react-icons/fi";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { isNegativeNumberInput } from "../../utils/numberInputUtils";
import { ORDER_CATEGORIES, ORDER_TYPES } from "../../constants/orders";
import { normalizePropertyName, CANONICAL_PROPERTY_NAMES } from "../../utils/orderNormalization";
import signatureImage from "../../assets/signature.jpeg";

// Group Definitions matching Andes operations
const HOSTEL_GROUPS = {
  GROUP_STUDENT: {
    label: "Student Hostels Group (Meera, Keerti, etc.)",
    properties: ["Aakansha", "Adarsha", "Archid", "Orchid", "Keerti", "Meera", "Plato", "Samshrushti", "Tara", "One 8", "Zolo stays"],
    unit: "Kg",
    defaultRate: "55.00",
  },
  GROUP_99: {
    label: "Hostel 99 Group (Base, No-3, No-88, No-4, Yerwada, KP)",
    properties: [
      "Hostel 99", "Hostel 99 - 3", "Hostel 99 no-3", "Hostel 99 - 88", "Hostel 99 no-88",
      "Hostel 99 - 4", "Hostel 99 no 88", "Hostel 99 no 3",
      "Hostel99 Yerwada 1", "Hostel99 Yerwada 2", "Hostel99 koregaon park",
    ],
    unit: "Pcs",
    defaultRate: "12.00",
  },
  GROUP_AIRBNB: {
    label: "Airbnb Group (Treebo, Viman Nagar, etc.)",
    properties: ["Airbnb Viman Nagar", "Treebo Trend Hotel"],
    unit: "Pcs",
    defaultRate: "15.00",
  },
};

// Preset Billed-To information for quick prefilling
const CLIENT_PRESETS = {
  GROUP_STUDENT: {
    clientName: "Aaalay Property Solution Private Limited",
    clientAddress: "Sr. No. 53/7, Nr Lohia Jain Square, Karve Nagar, Pune, Maharashtra 411052",
    clientGstin: "27AABCA1234F1Z5",
    rate: "55.00",
    unit: "Kg",
  },
  GROUP_99: {
    clientName: "Hostel 99 Living Solutions",
    clientAddress: "Hostel 99 Properties, Viman Nagar / Yerwada, Pune, Maharashtra 411014",
    clientGstin: "",
    rate: "12.00",
    unit: "Pcs",
  },
  GROUP_AIRBNB: {
    clientName: "Treebo & Airbnb Hospitality Partner",
    clientAddress: "Viman Nagar & Kalyani Nagar Properties, Pune, Maharashtra 411014",
    clientGstin: "",
    rate: "15.00",
    unit: "Pcs",
  },
  "One 8": {
    clientName: "One8 Commune Pune (True Palaces LLP)",
    clientAddress: "Raja Bahadur Mills, Sangamvadi, Pune, Maharashtra 411001",
    clientGstin: "",
    rate: "10.00",
    unit: "Pcs",
  },
  Meera: {
    clientName: "Aaalay Property Solution Private Limited (Meera Hostel)",
    clientAddress: "Karve Nagar, Pune, Maharashtra 411052",
    clientGstin: "27AABCA1234F1Z5",
    rate: "55.00",
    unit: "Kg",
  },
  Keerti: {
    clientName: "Aaalay Property Solution Private Limited (Keerti Hostel)",
    clientAddress: "Karve Nagar, Pune, Maharashtra 411052",
    clientGstin: "27AABCA1234F1Z5",
    rate: "55.00",
    unit: "Kg",
  },
  Plato: {
    clientName: "Aaalay Property Solution Private Limited (Plato Hostel)",
    clientAddress: "Viman Nagar, Pune, Maharashtra 411014",
    clientGstin: "27AABCA1234F1Z5",
    rate: "55.00",
    unit: "Kg",
  },
  Archid: {
    clientName: "Archid Student Living",
    clientAddress: "Bavdhan, Pune, Maharashtra 411021",
    clientGstin: "",
    rate: "55.00",
    unit: "Kg",
  },
  Aakansha: {
    clientName: "Aakansha Student Living",
    clientAddress: "Kothrud, Pune, Maharashtra 411038",
    clientGstin: "",
    rate: "55.00",
    unit: "Kg",
  },
  Adarsha: {
    clientName: "Adarsha Student Living",
    clientAddress: "Bavdhan, Pune, Maharashtra 411021",
    clientGstin: "",
    rate: "55.00",
    unit: "Kg",
  },
  "Zolo stays": {
    clientName: "Zolo Stays Property Management",
    clientAddress: "Pune, Maharashtra",
    clientGstin: "",
    rate: "55.00",
    unit: "Kg",
  },
  RETAIL_B2C: {
    clientName: "Andes Retail Customers",
    clientAddress: "Pune, Maharashtra",
    clientGstin: "",
    rate: "55.00",
    unit: "Kg",
  },
  ALL: {
    clientName: "Andes Consolidated Enterprise Client",
    clientAddress: "Pune, Maharashtra",
    clientGstin: "",
    rate: "55.00",
    unit: "Kg",
  },
};

function getMonthStartStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getDueDateStr(daysAhead = 15) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function generateDefaultInvoiceNo() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `INV-${yy}${mm}${dd}-${rand}`;
}

const numberToIndianWords = (num) => {
  if (!num || isNaN(num) || num <= 0) return "Indian Rupee Zero Only";
  const a = ["", "One ", "Two ", "Three ", "Four ", "Five ", "Six ", "Seven ", "Eight ", "Nine ", "Ten ", "Eleven ", "Twelve ", "Thirteen ", "Fourteen ", "Fifteen ", "Sixteen ", "Seventeen ", "Eighteen ", "Nineteen "];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const inWords = (n) => {
    if ((n = n.toString()).length > 9) return "overflow";
    const nArr = ("000000000" + n).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!nArr) return "";
    let str = "";
    str += Number(nArr[1]) !== 0 ? (a[Number(nArr[1])] || b[nArr[1][0]] + " " + a[nArr[1][1]]) + "Crore " : "";
    str += Number(nArr[2]) !== 0 ? (a[Number(nArr[2])] || b[nArr[2][0]] + " " + a[nArr[2][1]]) + "Lakh " : "";
    str += Number(nArr[3]) !== 0 ? (a[Number(nArr[3])] || b[nArr[3][0]] + " " + a[nArr[3][1]]) + "Thousand " : "";
    str += Number(nArr[4]) !== 0 ? (a[Number(nArr[4])] || b[nArr[4][0]] + " " + a[nArr[4][1]]) + "Hundred " : "";
    str += Number(nArr[5]) !== 0 ? ((str !== "") ? "and " : "") + (a[Number(nArr[5])] || b[nArr[5][0]] + " " + a[nArr[5][1]]) : "";
    return str;
  };

  const amount = Math.floor(num);
  const paise = Math.round((num - amount) * 100);

  let result = `Indian Rupee ${inWords(amount)}`;
  if (paise > 0) {
    result += `and ${inWords(paise)}Paise `;
  }
  return result.trim() + " Only";
};

export default function InvoiceGeneratorModal({ isOpen, onClose, orders = [] }) {
  // Form State
  const [invoiceNo, setInvoiceNo] = useState(() => generateDefaultInvoiceNo());
  const [invoiceDate, setInvoiceDate] = useState(() => getTodayStr());
  const [dueDate, setDueDate] = useState(() => getDueDateStr(15));
  const [startDate, setStartDate] = useState(() => getMonthStartStr());
  const [endDate, setEndDate] = useState(() => getTodayStr());
  const [selectedProperty, setSelectedProperty] = useState("GROUP_STUDENT");
  const [aggregationMode, setAggregationMode] = useState("by_date"); // 'by_date' | 'by_property' | 'by_order'
  const [rate, setRate] = useState("55.00");
  const [clientName, setClientName] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientGstin, setClientGstin] = useState("");
  const [notes, setNotes] = useState("Thanks for your business. Payment is due within 15 days of invoice date.");
  const [discount, setDiscount] = useState("0");
  const [taxRate, setTaxRate] = useState("0");
  const [lineItems, setLineItems] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [fetchStats, setFetchStats] = useState({ count: 0, totalQty: 0, rawAmount: 0 });

  // Property normalization helpers
  const normalizePropertyKey = (value) =>
    String(value || "")
      .trim()
      .replace(/\s+/g, " ")
      .replace(/[._-]/g, " ")
      .replace(/\s+/g, " ")
      .toLowerCase();

  const getOrderPropertyCandidates = (order) =>
    [order.property, order.linkedHostel, order.tenant, order.partnerName, order.propertyName, order.hostelName, order.hotelName]
      .filter(Boolean);

  const getOrderProperty = (order) => {
    const candidates = getOrderPropertyCandidates(order);
    const prop = candidates.find(Boolean);
    return prop ? normalizePropertyName(prop) : "";
  };

  const propertyMatches = (orderProperty, targetProperty) =>
    normalizePropertyKey(normalizePropertyName(orderProperty)) === normalizePropertyKey(targetProperty);

  const groupIncludesProperty = (groupProperties, orderProperty) => {
    const orderKey = normalizePropertyKey(normalizePropertyName(orderProperty));
    return groupProperties.some((property) => normalizePropertyKey(normalizePropertyName(property)) === orderKey);
  };

  const isRetailOrder = (order) =>
    order.category === ORDER_CATEGORIES.B2C_RETAIL ||
    order.type === ORDER_TYPES.REGULAR ||
    order.type === "regular" ||
    order.source === "cartdetails" ||
    order.source === "website";

  const getUnitLabel = (selection) => {
    if (HOSTEL_GROUPS[selection]) return HOSTEL_GROUPS[selection].unit;
    const name = (selection || "").toLowerCase();
    const isItemBased =
      name.includes("hostel 99") ||
      name.includes("hostel99") ||
      name.includes("airbnb") ||
      name.includes("one 8") ||
      groupIncludesProperty(HOSTEL_GROUPS.GROUP_99.properties, selection);
    return isItemBased ? "Pcs" : "Kg";
  };

  const isUseBilledAmount = (propertyName) => {
    const name = (propertyName || "").toLowerCase();
    return (
      name.includes("hostel 99") ||
      name.includes("hostel99") ||
      name.includes("airbnb") ||
      name.includes("one 8") ||
      groupIncludesProperty(HOSTEL_GROUPS.GROUP_99.properties, propertyName) ||
      groupIncludesProperty(HOSTEL_GROUPS.GROUP_AIRBNB.properties, propertyName)
    );
  };

  const getQty = (order, propertyName) => {
    const name = (propertyName || "").toLowerCase();
    const isItemBased =
      name.includes("hostel 99") ||
      name.includes("hostel99") ||
      name.includes("airbnb") ||
      name.includes("one 8") ||
      groupIncludesProperty(HOSTEL_GROUPS.GROUP_99.properties, propertyName);

    const detailItems =
      order.details && typeof order.details === "object"
        ? Object.values(order.details).reduce((sum, value) => sum + (Number(value) || 0), 0)
        : 0;

    return Number(isItemBased ? order.items || order.clothesCount || detailItems || 0 : order.weight || order.clothesWeightKg || 0);
  };

  const uniqueProperties = useMemo(() => {
    const propertiesWithOrders = Array.from(new Set(Object.values(CANONICAL_PROPERTY_NAMES)));
    return propertiesWithOrders.sort((a, b) => a.localeCompare(b));
  }, []);

  // Sync client preset details whenever selectedProperty changes
  useEffect(() => {
    const preset = CLIENT_PRESETS[selectedProperty];
    if (preset) {
      setClientName(preset.clientName);
      setClientAddress(preset.clientAddress);
      setClientGstin(preset.clientGstin || "");
      if (preset.rate) setRate(preset.rate);
    } else {
      setClientName(selectedProperty === "ALL" ? "All Properties Client" : selectedProperty);
      setClientAddress("Pune, Maharashtra, India");
      setClientGstin("");
    }
  }, [selectedProperty]);

  // Extract / fetch data from orders into line items
  const fetchItemsFromOrders = useCallback(() => {
    if (!startDate || !endDate) return;

    // Filter by date range
    const dateFiltered = orders.filter((o) => {
      const d = o.date;
      if (!d) return false;
      return d >= startDate && d <= endDate;
    });

    // Filter by target property / group / retail
    let targetOrders = [];
    const isGroup = Boolean(HOSTEL_GROUPS[selectedProperty]);

    if (selectedProperty === "ALL") {
      targetOrders = dateFiltered.filter((o) => o.category !== ORDER_CATEGORIES.ISSUES && o.type !== ORDER_TYPES.ISSUE);
    } else if (selectedProperty === "RETAIL_B2C") {
      targetOrders = dateFiltered.filter(isRetailOrder);
    } else if (isGroup) {
      const groupProps = HOSTEL_GROUPS[selectedProperty].properties;
      targetOrders = dateFiltered.filter((o) => {
        if (isRetailOrder(o)) return false;
        const prop = getOrderProperty(o);
        return groupIncludesProperty(groupProps, prop);
      });
    } else {
      targetOrders = dateFiltered.filter((o) => {
        const prop = getOrderProperty(o);
        return (
          propertyMatches(prop, selectedProperty) ||
          [o.property, o.linkedHostel, o.tenant, o.partnerName, o.propertyName, o.hostelName].some((p) =>
            propertyMatches(p, selectedProperty)
          )
        );
      });
    }

    const numRate = parseFloat(rate) || 0;
    const defaultUnit = getUnitLabel(selectedProperty);
    let items = [];

    if (aggregationMode === "by_property" || (selectedProperty === "ALL" && aggregationMode !== "by_order")) {
      // Group by property
      const propertyTotals = {};
      targetOrders.forEach((o) => {
        const prop = getOrderProperty(o) || (isRetailOrder(o) ? "B2C Retail Orders" : "General Laundry");
        if (!propertyTotals[prop]) {
          propertyTotals[prop] = { qty: 0, amount: 0, count: 0 };
        }
        const q = getQty(o, prop);
        propertyTotals[prop].qty += q;
        propertyTotals[prop].count += 1;
        if (isUseBilledAmount(prop)) {
          propertyTotals[prop].amount += Number(o.amount || o.totalCost || 0);
        } else {
          propertyTotals[prop].amount += q * numRate;
        }
      });

      items = Object.entries(propertyTotals)
        .filter(([_, d]) => d.qty > 0 || d.amount > 0)
        .map(([prop, d], idx) => {
          const calculatedRate = d.qty > 0 ? d.amount / d.qty : numRate;
          return {
            id: `prop-${prop}-${idx}`,
            description: `${prop.toUpperCase()} - Wash + Dry + Iron (${d.count} orders)`,
            qty: Number(d.qty.toFixed(2)),
            unit: getUnitLabel(prop),
            rate: Number(calculatedRate.toFixed(2)),
            amount: Number(d.amount.toFixed(2)),
          };
        });
    } else if (aggregationMode === "by_order") {
      // Detailed by Order
      items = targetOrders
        .filter((o) => o.weight > 0 || o.items > 0 || o.amount > 0)
        .map((o, idx) => {
          const prop = getOrderProperty(o) || (isRetailOrder(o) ? o.customerName || "Customer" : "Order");
          const q = getQty(o, prop) || 1;
          const amt = Number(o.amount || o.totalCost || (q * numRate));
          const effectiveRate = q > 0 ? amt / q : numRate;
          const orderDateFormatted = o.date ? o.date.split("-").reverse().join("/") : "";
          const ref = String(o.id || "").slice(-6).toUpperCase();
          return {
            id: `order-${o.id || idx}`,
            description: `${prop} · ${o.service || "Wash+Dry+Iron"} (${orderDateFormatted}${ref ? ` · Ref #${ref}` : ""})`,
            qty: Number(q.toFixed(2)),
            unit: defaultUnit,
            rate: Number(effectiveRate.toFixed(2)),
            amount: Number(amt.toFixed(2)),
          };
        });
    } else {
      // Default: Group by Date
      const dateTotals = {};
      targetOrders.forEach((o) => {
        const orderDate = o.date || "Unknown Date";
        if (!dateTotals[orderDate]) {
          dateTotals[orderDate] = { qty: 0, amount: 0, count: 0 };
        }
        const prop = getOrderProperty(o) || selectedProperty;
        const q = getQty(o, prop);
        dateTotals[orderDate].qty += q;
        dateTotals[orderDate].count += 1;
        if (isUseBilledAmount(prop)) {
          dateTotals[orderDate].amount += Number(o.amount || o.totalCost || 0);
        } else {
          dateTotals[orderDate].amount += q * numRate;
        }
      });

      const sortedDates = Object.keys(dateTotals).sort();
      items = sortedDates.map((dStr, idx) => {
        const data = dateTotals[dStr];
        const formattedDate = dStr.includes("-") ? dStr.split("-").reverse().join("/") : dStr;
        const calculatedRate = data.qty > 0 ? data.amount / data.qty : numRate;
        const labelProp = !isGroup && selectedProperty !== "ALL" && selectedProperty !== "RETAIL_B2C" ? `${selectedProperty} - ` : "";
        return {
          id: `date-${dStr}-${idx}`,
          description: `${labelProp}Wash+Dry+Iron - ${formattedDate} (${data.count} orders)`,
          qty: Number(data.qty.toFixed(2)),
          unit: defaultUnit,
          rate: Number(calculatedRate.toFixed(2)),
          amount: Number(data.amount.toFixed(2)),
        };
      });
    }

    // Fallback if no matching orders exist
    if (items.length === 0) {
      items = [
        {
          id: "manual-1",
          description: `${selectedProperty === "ALL" ? "Comprehensive Laundry Services" : (HOSTEL_GROUPS[selectedProperty]?.label || selectedProperty)} - Services`,
          qty: 1,
          unit: defaultUnit,
          rate: numRate || 55,
          amount: numRate || 55,
        },
      ];
    }

    setLineItems(items);
    setFetchStats({
      count: targetOrders.length,
      totalQty: items.reduce((acc, it) => acc + (Number(it.qty) || 0), 0),
      rawAmount: items.reduce((acc, it) => acc + (Number(it.amount) || 0), 0),
    });
  }, [startDate, endDate, selectedProperty, aggregationMode, rate, orders]);

  // Fetch orders when modal opens or initial parameters are ready
  useEffect(() => {
    if (isOpen) {
      fetchItemsFromOrders();
    }
  }, [isOpen, fetchItemsFromOrders]);

  // Edit item handlers
  const updateItem = (id, field, value) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === "qty" || field === "rate") {
          const q = field === "qty" ? parseFloat(value) || 0 : parseFloat(item.qty) || 0;
          const r = field === "rate" ? parseFloat(value) || 0 : parseFloat(item.rate) || 0;
          updated.amount = Number((q * r).toFixed(2));
        }
        return updated;
      })
    );
  };

  const removeItem = (id) => {
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  };

  const addItem = () => {
    const defaultUnit = getUnitLabel(selectedProperty);
    const numRate = parseFloat(rate) || 0;
    const newItem = {
      id: `custom-${Date.now()}`,
      description: "Additional Laundry Service",
      qty: 1,
      unit: defaultUnit,
      rate: numRate,
      amount: numRate,
      isCustom: true,
    };
    setLineItems((prev) => [...prev, newItem]);
  };

  const applyRateToAllItems = () => {
    const numRate = parseFloat(rate) || 0;
    setLineItems((prev) =>
      prev.map((item) => {
        const q = Number(item.qty) || 0;
        return {
          ...item,
          rate: numRate,
          amount: Number((q * numRate).toFixed(2)),
        };
      })
    );
  };

  // Quick preset dates
  const applyPreset = (preset) => {
    const now = new Date();
    const todayStr = getTodayStr();

    if (preset === "this_month") {
      setStartDate(getMonthStartStr());
      setEndDate(todayStr);
    } else if (preset === "last_month") {
      const prevMonthLastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      const prevMonthFirstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const f1 = `${prevMonthFirstDay.getFullYear()}-${String(prevMonthFirstDay.getMonth() + 1).padStart(2, "0")}-01`;
      const f2 = `${prevMonthLastDay.getFullYear()}-${String(prevMonthLastDay.getMonth() + 1).padStart(2, "0")}-${String(prevMonthLastDay.getDate()).padStart(2, "0")}`;
      setStartDate(f1);
      setEndDate(f2);
    } else if (preset === "last_30") {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      setStartDate(d.toISOString().slice(0, 10));
      setEndDate(todayStr);
    } else if (preset === "today") {
      setStartDate(todayStr);
      setEndDate(todayStr);
    }
  };

  // Financial totals
  const subtotal = useMemo(
    () => lineItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0),
    [lineItems]
  );

  const discountAmount = useMemo(() => {
    const d = parseFloat(discount) || 0;
    return Math.min(d, subtotal);
  }, [discount, subtotal]);

  const taxableAmount = Math.max(0, subtotal - discountAmount);

  const taxAmount = useMemo(() => {
    const ratePct = parseFloat(taxRate) || 0;
    return (taxableAmount * ratePct) / 100;
  }, [taxableAmount, taxRate]);

  const grandTotal = Math.max(0, taxableAmount + taxAmount);
  const totalQtySum = useMemo(
    () => lineItems.reduce((acc, it) => acc + (Number(it.qty) || 0), 0),
    [lineItems]
  );

  const loadSignature = () =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = signatureImage;
    });

  // Generate & Download PDF
  const generatePDF = async () => {
    if (!invoiceNo.trim()) {
      alert("Please enter a valid Invoice Number.");
      return;
    }
    if (!clientName.trim()) {
      alert("Please provide the Client Name.");
      return;
    }
    if (lineItems.length === 0) {
      alert("Please add at least one line item to generate the invoice.");
      return;
    }

    setIsGenerating(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // --- BRAND HEADER ---
      const bx = 14;
      const by = 10;
      const brandBlue = [25, 118, 210];

      // Logo: Roof
      doc.setDrawColor(brandBlue[0], brandBlue[1], brandBlue[2]);
      doc.setLineWidth(1.2);
      doc.line(bx, by + 6, bx + 6.5, by);
      doc.line(bx + 6.5, by, bx + 13, by + 6);

      // Logo: Basket
      doc.setFillColor(brandBlue[0], brandBlue[1], brandBlue[2]);
      doc.lines([[8, 0], [-1.2, 4.5], [-5.6, 0], [-1.2, -4.5]], bx + 2.5, by + 8, [1, 1], "F");

      // Logo: Smile
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.6);
      doc.line(bx + 5, by + 9.5, bx + 6.5, by + 11.5);
      doc.line(bx + 6.5, by + 11.5, bx + 8, by + 9.5);

      // Company Name
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text("Andes", bx + 15, by + 11);

      // Document Title
      doc.setFontSize(22);
      doc.setTextColor(0, 0, 0);
      doc.text("INVOICE", pageWidth - 14, 20, { align: "right" });

      // --- BALANCE DUE BANNER ---
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text("Balance Due", pageWidth - 14, 33, { align: "right" });

      doc.setFontSize(17);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      const formattedTotal = "Rs. " + grandTotal.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      doc.text(formattedTotal, pageWidth - 14, 42, { align: "right" });

      // --- BILLED BY & BILLED TO ---
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text("Billed By", 14, 55);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(
        "Andes Services Private Limited\nRohan Abhilasha, Wagholi-Lohegaon,\nPune,\nMaharashtra, India - 412207",
        14,
        61
      );

      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text("Billed To", pageWidth / 2, 55);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(clientName, pageWidth / 2, 61);

      const splitAddress = doc.splitTextToSize(clientAddress || "Pune, Maharashtra", pageWidth / 2 - 14);
      doc.text(splitAddress, pageWidth / 2, 66);
      if (clientGstin) {
        doc.text(`GSTIN: ${clientGstin}`, pageWidth / 2, 66 + splitAddress.length * 4.5);
      }

      // --- INVOICE DETAILS ---
      const detailsY = 88;
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);

      const [iy, im, id] = invoiceDate.split("-");
      const formattedInvDate = `${id}/${im}/${iy}`;
      const [dy, dm, dd] = (dueDate || invoiceDate).split("-");
      const formattedDueDate = `${dd}/${dm}/${dy}`;

      const targetTitle =
        selectedProperty === "ALL"
          ? "All Properties Consolidated"
          : selectedProperty === "RETAIL_B2C"
          ? "Retail B2C Service"
          : HOSTEL_GROUPS[selectedProperty]?.label || selectedProperty;

      doc.text(`Property / Entity: ${targetTitle}`, 14, detailsY);
      doc.text(`Invoice Number: ${invoiceNo}`, 14, detailsY + 5.5);
      doc.text(`Invoice Date: ${formattedInvDate}   |   Due Date: ${formattedDueDate}`, 14, detailsY + 11);

      // --- TABLE ---
      const tableData = lineItems.map((item, idx) => [
        idx + 1,
        item.description,
        `${Number(item.qty).toFixed(2)} ${item.unit || ""}`.trim(),
        `Rs. ${Number(item.rate).toFixed(2)}`,
        `Rs. ${Number(item.amount).toFixed(2)}`,
      ]);

      const footRows = [];
      if (discountAmount > 0 || taxAmount > 0) {
        footRows.push(["", "Subtotal", "", "", `Rs. ${subtotal.toFixed(2)}`]);
      }
      if (discountAmount > 0) {
        footRows.push(["", "Discount", "", "", `- Rs. ${discountAmount.toFixed(2)}`]);
      }
      if (taxAmount > 0) {
        footRows.push(["", `GST / Tax (${taxRate}%)`, "", "", `Rs. ${taxAmount.toFixed(2)}`]);
      }
      footRows.push(["", "Total Due", `${totalQtySum.toFixed(2)}`, "", formattedTotal]);

      autoTable(doc, {
        startY: detailsY + 18,
        head: [["#", "Date & Description", "Qty", "Rate", "Amount"]],
        body: tableData,
        foot: footRows,
        theme: "grid",
        headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold" },
        styles: { fontSize: 8.5, cellPadding: 3.5 },
        columnStyles: {
          0: { halign: "center", cellWidth: 12 },
          1: { cellWidth: "auto" },
          2: { halign: "right", cellWidth: 30 },
          3: { halign: "right", cellWidth: 30 },
          4: { halign: "right", cellWidth: 36 },
        },
        footStyles: { fillColor: [255, 255, 255], textColor: [15, 23, 42], fontStyle: "bold", halign: "right" },
      });

      // --- FOOTER SECTION ---
      let finalY = doc.lastAutoTable.finalY || 100;
      const pageHeight = doc.internal.pageSize.getHeight();
      const footerNeededSpace = 75;

      if (finalY + footerNeededSpace > pageHeight - 10) {
        doc.addPage();
        finalY = 20;
      }

      // 1. Total in Words
      doc.setFontSize(9.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text("Total In Words:", pageWidth - 90, finalY + 12, { align: "right" });
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      const words = numberToIndianWords(grandTotal);
      const splitWords = doc.splitTextToSize(words, 76);
      doc.text(splitWords, pageWidth - 14, finalY + 12, { align: "right" });

      // 2. Notes & Bank Details
      const footerY = finalY + 38;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Notes & Terms", 14, footerY);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      const splitNotes = doc.splitTextToSize(notes || "Thanks for your business.", pageWidth / 2);
      doc.text(splitNotes, 14, footerY + 5);

      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.text("Bank Transfer Details:", 14, footerY + 18);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text("Account Name: Andes Services Pvt Ltd\nAccount Number: 50200116540940\nIFSC Code: HDFC0000149 (HDFC Bank)", 14, footerY + 23);

      // 3. Signature Area
      const sigX = pageWidth - 65;
      const signatureImageWidth = 50;
      const signatureImageHeight = 22;
      const signatureImageY = footerY + 5;
      const signatureCenterX = sigX + signatureImageWidth / 2;

      try {
        const signature = await loadSignature();
        doc.addImage(signature, "JPEG", sigX, signatureImageY, signatureImageWidth, signatureImageHeight);
      } catch {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text("ARYAN GUPTA", signatureCenterX, footerY + 18, { align: "center" });
        doc.setFontSize(8);
        doc.text("FOUNDER & CEO, ANDES", signatureCenterX, footerY + 23, { align: "center" });
        doc.setFontSize(9);
      }

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text("Authorized Signatory", signatureCenterX, footerY + 32, { align: "center" });

      // Save PDF to user's device
      const sanitizedName = (clientName || "Client").replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30);
      doc.save(`${invoiceNo}_${sanitizedName}.pdf`);
      onClose();
    } catch (err) {
      console.error("Failed to generate PDF:", err);
      alert("An error occurred while generating PDF: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[94vh] max-h-[94vh] overflow-hidden flex flex-col border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-xs">
              <FiFileText size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold text-slate-900">Invoice Generator</h2>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Interactive Live Edit
                </span>
              </div>
              <p className="text-xs text-slate-500">Fetch order data dynamically, edit any field or line item, and generate official PDF invoices</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
            aria-label="Close invoice generator modal"
          >
            <FiX size={22} />
          </button>
        </div>

        {/* Scrollable Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-slate-800">
          {/* Section 1: Orders Fetch Filters & Parameters */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FiCalendar className="text-indigo-600" size={16} />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">1. Data Source & Orders Filter</span>
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-500 mr-1">Presets:</span>
                <button
                  type="button"
                  onClick={() => applyPreset("this_month")}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-slate-200 hover:border-indigo-400 hover:text-indigo-600 rounded-lg shadow-2xs transition-all cursor-pointer"
                >
                  This Month
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("last_month")}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-slate-200 hover:border-indigo-400 hover:text-indigo-600 rounded-lg shadow-2xs transition-all cursor-pointer"
                >
                  Last Month
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("last_30")}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-slate-200 hover:border-indigo-400 hover:text-indigo-600 rounded-lg shadow-2xs transition-all cursor-pointer"
                >
                  Last 30 Days
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("today")}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-slate-200 hover:border-indigo-400 hover:text-indigo-600 rounded-lg shadow-2xs transition-all cursor-pointer"
                >
                  Today
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* From Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">From Date *</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white shadow-2xs"
                />
              </div>

              {/* To Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">To Date *</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white shadow-2xs"
                />
              </div>

              {/* Property / Group Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Property / Client Source *</label>
                <select
                  value={selectedProperty}
                  onChange={(e) => setSelectedProperty(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white shadow-2xs"
                >
                  <optgroup label="Operational Groups">
                    {Object.entries(HOSTEL_GROUPS).map(([key, group]) => (
                      <option key={key} value={key}>
                        {group.label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="All Channels">
                    <option value="ALL">All Properties Consolidated</option>
                    <option value="RETAIL_B2C">Retail / B2C Orders</option>
                  </optgroup>
                  <optgroup label="Individual Properties">
                    {uniqueProperties.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* Aggregation Mode */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Aggregation Style</label>
                <select
                  value={aggregationMode}
                  onChange={(e) => setAggregationMode(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white shadow-2xs"
                >
                  <option value="by_date">Group by Date (Daily Logs)</option>
                  <option value="by_property">Group by Property / Entity</option>
                  <option value="by_order">Itemized Individual Orders</option>
                </select>
              </div>
            </div>

            {/* Fetch Status Bar & Action */}
            <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-200/80 gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={fetchItemsFromOrders}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-all cursor-pointer"
                >
                  <FiRefreshCw size={13} /> Fetch from Orders
                </button>

                <div className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                  <span>
                    Matched <strong>{fetchStats.count}</strong> orders ({fetchStats.totalQty.toFixed(1)} {getUnitLabel(selectedProperty)})
                  </span>
                </div>
              </div>

              {/* Master Rate Input */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">Base Rate per {getUnitLabel(selectedProperty)}:</span>
                <div className="relative w-24">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={rate}
                    onChange={(e) => {
                      if (!isNegativeNumberInput(e.target.value)) setRate(e.target.value);
                    }}
                    className="w-full pl-6 pr-2 py-1 text-xs font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={applyRateToAllItems}
                  className="px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:text-indigo-600 bg-white border border-slate-300 hover:border-indigo-400 rounded-lg shadow-2xs transition-all cursor-pointer"
                  title="Apply this rate to all line items"
                >
                  Apply to All
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: Invoice Metadata & Client Billing Details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Invoice Info Card */}
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3 shadow-2xs">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <FiFileText className="text-indigo-600" size={15} />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Invoice Information</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Invoice Number *</label>
                  <input
                    type="text"
                    value={invoiceNo}
                    onChange={(e) => setInvoiceNo(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="INV-000001"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Invoice Date *</label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Billed To Details Card */}
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <FiEdit3 className="text-indigo-600" size={15} />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Billed To (Client / Entity)</span>
                </div>
                <span className="text-[11px] text-slate-400">Pre-filled from property presets</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Client Company / Entity Name *</label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="Client Company Name"
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Client Address *</label>
                  <input
                    type="text"
                    value={clientAddress}
                    onChange={(e) => setClientAddress(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="Registered address / property location"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">GSTIN / Tax ID (Optional)</label>
                  <input
                    type="text"
                    value={clientGstin}
                    onChange={(e) => setClientGstin(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono uppercase focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="e.g. 27AABCA1234F1Z5"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Editable Line Items Table (Core User Request) */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
            <div className="flex flex-wrap items-center justify-between p-4 border-b border-slate-200 bg-slate-50/70 gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-extrabold text-slate-900">Invoice Line Items ({lineItems.length})</h3>
                  <span className="text-[11px] font-semibold text-slate-500">
                    Live editable table — modify descriptions, quantities, rates, or add custom rows
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={addItem}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-all cursor-pointer"
                >
                  <FiPlus size={14} /> Add Line Item
                </button>
                <button
                  type="button"
                  onClick={fetchItemsFromOrders}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-all cursor-pointer"
                  title="Reset table to original order values"
                >
                  <FiRefreshCw size={13} /> Reset to Orders
                </button>
              </div>
            </div>

            {/* Table Container */}
            <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3">Date & Description (Editable)</th>
                    <th className="py-2.5 px-3 w-28 text-right">Qty</th>
                    <th className="py-2.5 px-3 w-24">Unit</th>
                    <th className="py-2.5 px-3 w-28 text-right">Rate (₹)</th>
                    <th className="py-2.5 px-3 w-32 text-right">Amount (₹)</th>
                    <th className="py-2.5 px-3 w-12 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lineItems.map((item, index) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 text-center text-slate-400 font-bold text-[11px]">{index + 1}</td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateItem(item.id, "description", e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                          placeholder="Item Description"
                        />
                      </td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.qty}
                          onChange={(e) => {
                            if (!isNegativeNumberInput(e.target.value)) updateItem(item.id, "qty", e.target.value);
                          }}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-right focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <select
                          value={item.unit || "Kg"}
                          onChange={(e) => updateItem(item.id, "unit", e.target.value)}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                        >
                          <option value="Kg">Kg</option>
                          <option value="Pcs">Pcs</option>
                          <option value="Sets">Sets</option>
                          <option value="Orders">Orders</option>
                          <option value="Trips">Trips</option>
                          <option value="Services">Services</option>
                        </select>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.rate}
                          onChange={(e) => {
                            if (!isNegativeNumberInput(e.target.value)) updateItem(item.id, "rate", e.target.value);
                          }}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-right focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                        />
                      </td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.amount}
                          onChange={(e) => {
                            if (!isNegativeNumberInput(e.target.value)) updateItem(item.id, "amount", e.target.value);
                          }}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 text-right focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                        />
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Remove item"
                        >
                          <FiTrash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Table Footer Summary Bar */}
            <div className="flex flex-wrap items-center justify-between p-3 border-t border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <div>
                Total Items: <span className="font-bold text-slate-900">{lineItems.length}</span> | Cumulative Qty:{" "}
                <span className="font-bold text-slate-900">{totalQtySum.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span>Subtotal:</span>
                <span className="text-sm font-extrabold text-slate-900">
                  ₹{subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Section 4: Notes, Discounts, Tax, and Final Amount */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Notes & Bank Details Card */}
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3 shadow-2xs">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">Notes & Payment Terms</span>
              <textarea
                rows="2"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl text-xs text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                placeholder="Notes for client / bank details / terms"
              />

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-600 space-y-0.5">
                <p className="font-bold text-slate-800">Andes Banking Details (Automatically printed on invoice):</p>
                <p>Account: Andes Services Pvt Ltd · A/C: 50200116540940 · IFSC: HDFC0000149 (HDFC Bank)</p>
              </div>
            </div>

            {/* Financial Summary Card */}
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3 shadow-2xs">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">Billing Summary & Taxes</span>

              <div className="space-y-2 text-xs">
                {/* Subtotal */}
                <div className="flex justify-between items-center text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-bold text-slate-900">₹{subtotal.toFixed(2)}</span>
                </div>

                {/* Discount */}
                <div className="flex justify-between items-center text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <span>Discount (₹)</span>
                  </div>
                  <div className="w-28">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={discount}
                      onChange={(e) => {
                        if (!isNegativeNumberInput(e.target.value)) setDiscount(e.target.value);
                      }}
                      className="w-full px-2 py-1 border border-slate-300 rounded-lg text-xs font-bold text-right outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Tax / GST */}
                <div className="flex justify-between items-center text-slate-600">
                  <div className="flex items-center gap-2">
                    <span>GST / Tax Rate</span>
                    <select
                      value={taxRate}
                      onChange={(e) => setTaxRate(e.target.value)}
                      className="px-2 py-0.5 border border-slate-300 rounded text-xs font-semibold outline-none"
                    >
                      <option value="0">0% (Nil)</option>
                      <option value="5">5% (GST)</option>
                      <option value="12">12% (GST)</option>
                      <option value="18">18% (Standard GST)</option>
                    </select>
                  </div>
                  <span className="font-bold text-slate-900">₹{taxAmount.toFixed(2)}</span>
                </div>

                {/* Final Total */}
                <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
                  <div>
                    <span className="text-sm font-extrabold text-slate-900 block">Total Payable</span>
                    <span className="text-[11px] font-medium text-slate-500 italic">
                      {numberToIndianWords(grandTotal)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black text-indigo-700">
                      ₹{grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
          <div className="text-xs text-slate-500">
            Invoice: <strong className="text-slate-800">{invoiceNo}</strong> | Entity:{" "}
            <strong className="text-slate-800">{clientName || "Client"}</strong>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isGenerating}
              className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={generatePDF}
              disabled={isGenerating}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl transition-all shadow-sm hover:shadow cursor-pointer disabled:opacity-50"
            >
              {isGenerating ? (
                <>Generating PDF...</>
              ) : (
                <>
                  <FiDownload size={16} /> Generate & Download PDF
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
