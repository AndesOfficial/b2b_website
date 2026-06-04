import React, { useState, useMemo } from 'react';
import { FiX, FiDownload, FiFileText } from 'react-icons/fi';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { isNegativeNumberInput } from "../utils/numberInputUtils";
import { ORDER_CATEGORIES, ORDER_TYPES } from "../constants/orders";
import { normalizePropertyName } from "../utils/orderNormalization";
import signatureImage from "../assets/signature.jpeg";


export default function InvoiceGeneratorModal({ isOpen, onClose, orders = [] }) {
    // Form State
    const [invoiceNo, setInvoiceNo] = useState("");
    const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [rate, setRate] = useState("55.00");
    const [clientName, setClientName] = useState("");
    const [clientAddress, setClientAddress] = useState("");
    const [selectedProperty, setSelectedProperty] = useState("GROUP_STUDENT");
    const handleRateChange = (value) => {
        if (isNegativeNumberInput(value)) return;
        setRate(value);
    };

    // Group Definitions
    const HOSTEL_GROUPS = {
        "GROUP_STUDENT": {
            label: "Student Hostels Group (Tulsi, Meera, etc.)",
            properties: ["Aakansha", "Aaradhana", "Adarsha", "Curie", "Gurukul", "Keerti", "Meera", "Plato", "Samriddhi", "Samshrushti", "Tara", "Tulsi"],
            unit: "Kg"
        },
        "GROUP_99": {
            label: "Hostel 99 Group (Base, No-3, No-88, Yerwada, KP)",
            properties: [
                "Hostel 99", "Hostel 99 no-3", "Hostel 99 no-88", 
                "Hostel 99 no 88", "Hostel 99 no 3",
                "Hostel99 Yerwada 1", "Hostel99 Yerwada 2", "Hostel99 koregaon park"
            ],
            unit: "Pcs"
        },
        "GROUP_AIRBNB": {
            label: "Airbnb Group",
            properties: ["Airbnb Viman Nagar", "Treebo Trend Hotel"],
            unit: "Pcs"
        }
    };

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

    const isInvoiceEligibleOrder = (order) => {
        if (order.category === ORDER_CATEGORIES.ISSUES || order.type === ORDER_TYPES.ISSUE) return false;
        if (order.category === ORDER_CATEGORIES.B2C_RETAIL || order.type === ORDER_TYPES.REGULAR) return false;
        return Boolean(getOrderProperty(order));
    };

    // Extract unique properties from orders for the dropdown
    const uniqueProperties = useMemo(() => {
        const propertiesWithOrders = Array.from(new Set(
            orders
                .filter(isInvoiceEligibleOrder)
                .map(getOrderProperty)
                .filter(Boolean)
        ));

        return propertiesWithOrders.sort((a, b) => a.localeCompare(b));
    }, [orders]);

    const getQty = (order, propertyName) => {
        const name = propertyName?.toLowerCase() || "";
        // Use items (clothes count) for Hostel 99 and Airbnbs
        const isItemBased = name.includes("hostel 99") ||
                           name.includes("hostel99") ||
                           name.includes("airbnb") ||
                           groupIncludesProperty(HOSTEL_GROUPS.GROUP_99.properties, propertyName);
        const detailItems = order.details && typeof order.details === "object"
            ? Object.values(order.details).reduce((sum, value) => sum + (Number(value) || 0), 0)
            : 0;
        
        return Number(isItemBased ? (order.items || detailItems || 0) : (order.weight || 0));
    };

    const getUnitLabel = (selection) => {
        if (HOSTEL_GROUPS[selection]) return HOSTEL_GROUPS[selection].unit;
        const name = selection?.toLowerCase() || "";
        const isItemBased = name.includes("hostel 99") || 
                           name.includes("hostel99") ||
                           name.includes("airbnb") ||
                           groupIncludesProperty(HOSTEL_GROUPS.GROUP_99.properties, selection);
        return isItemBased ? "Pcs" : "Kg";
    };

    const isUseBilledAmount = (propertyName) => {
        const name = propertyName?.toLowerCase() || "";
        // Check property name or group inclusion
        return name.includes("hostel 99") || 
               name.includes("hostel99") ||
               name.includes("airbnb") || 
               groupIncludesProperty(HOSTEL_GROUPS.GROUP_99.properties, propertyName) ||
               groupIncludesProperty(HOSTEL_GROUPS.GROUP_AIRBNB.properties, propertyName);
    };

    const numberToIndianWords = (num) => {
        const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
        const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

        const inWords = (n) => {
            if ((n = n.toString()).length > 9) return 'overflow';
            let nArr = ('000000000' + n).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
            if (!nArr) return '';
            let str = '';
            str += Number(nArr[1]) !== 0 ? (a[Number(nArr[1])] || b[nArr[1][0]] + ' ' + a[nArr[1][1]]) + 'Crore ' : '';
            str += Number(nArr[2]) !== 0 ? (a[Number(nArr[2])] || b[nArr[2][0]] + ' ' + a[nArr[2][1]]) + 'Lakh ' : '';
            str += Number(nArr[3]) !== 0 ? (a[Number(nArr[3])] || b[nArr[3][0]] + ' ' + a[nArr[3][1]]) + 'Thousand ' : '';
            str += Number(nArr[4]) !== 0 ? (a[Number(nArr[4])] || b[nArr[4][0]] + ' ' + a[nArr[4][1]]) + 'Hundred ' : '';
            str += Number(nArr[5]) !== 0 ? ((str !== '') ? 'and ' : '') + (a[Number(nArr[5])] || b[nArr[5][0]] + ' ' + a[nArr[5][1]]) : '';
            return str;
        };

        const amount = Math.floor(num);
        const paise = Math.round((num - amount) * 100);
        
        let result = `Indian Rupee ${inWords(amount)}`;
        if (paise > 0) {
            result += `and ${inWords(paise)}Paise `;
        }
        return result + 'Only';
    };

    if (!isOpen) return null;

    const loadSignature = () =>
        new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = signatureImage;
        });

    const generatePDF = async () => {
        if (!startDate || !endDate || !invoiceNo || !clientName || !rate) {
            alert("Please fill in all required fields (Dates, Invoice No, Client Name, Rate).");
            return;
        }

        // 1. Filter Orders by Date
        const dateFiltered = orders.filter(o => {
            const isAfterStart = o.date >= startDate;
            const isBeforeEnd = o.date <= endDate;
            return isAfterStart && isBeforeEnd;
        });

        let targetOrders = [];
        let isGroup = !!HOSTEL_GROUPS[selectedProperty];
        let displayUnit = getUnitLabel(selectedProperty);

        // 2. Filter by Property / Group
        if (selectedProperty === "ALL") {
            targetOrders = dateFiltered;
        } else if (isGroup) {
            const groupProps = HOSTEL_GROUPS[selectedProperty].properties;
            targetOrders = dateFiltered.filter(o => {
                const prop = getOrderProperty(o);
                return groupIncludesProperty(groupProps, prop);
            });
        } else {
            targetOrders = dateFiltered.filter(o => {
                return [o.property, o.linkedHostel, o.tenant, o.partnerName].some((property) =>
                    propertyMatches(property, selectedProperty)
                );
            });
        }

        if (targetOrders.length === 0) {
            alert("No orders found for the selected criteria.");
            return;
        }

        const numRate = parseFloat(rate);
        let tableData = [];
        let totalAmount = 0;
        let totalQtySum = 0;

        // 3. Aggregate Data
        if (selectedProperty === "ALL" || isGroup) {
            // Aggregated by Property
            const propertyTotals = {};
            targetOrders.forEach(o => {
                const prop = getOrderProperty(o) || "Unknown Property";
                if (!propertyTotals[prop]) propertyTotals[prop] = { qty: 0, amount: 0 };
                
                const qty = getQty(o, prop);
                propertyTotals[prop].qty += qty;
                
                if (isUseBilledAmount(prop)) {
                    propertyTotals[prop].amount += Number(o.amount || 0);
                } else {
                    propertyTotals[prop].amount += qty * numRate;
                }
            });

            tableData = Object.entries(propertyTotals)
                .filter(([_, data]) => data.qty > 0 || data.amount > 0)
                .map(([prop, data]) => {
                    const amount = data.amount;
                    totalAmount += amount;
                    totalQtySum += data.qty;
                    const effectiveRate = data.qty > 0 ? (amount / data.qty) : 0;
                    return [
                        `${prop.toUpperCase()} - Wash + Dry + Iron`,
                        data.qty.toFixed(2),
                        effectiveRate.toFixed(2),
                        amount.toFixed(2)
                    ];
                });
        } else {
            // Aggregated by Date (Single Property)
            const dateTotals = {};
            targetOrders.forEach(o => {
                const [y, m, d] = o.date.split("-");
                const formattedDate = `${d}/${m}/${y}`;
                if (!dateTotals[formattedDate]) dateTotals[formattedDate] = { qty: 0, amount: 0 };
                
                const qty = getQty(o, selectedProperty);
                dateTotals[formattedDate].qty += qty;
                
                if (isUseBilledAmount(selectedProperty)) {
                    dateTotals[formattedDate].amount += Number(o.amount || 0);
                } else {
                    dateTotals[formattedDate].amount += qty * numRate;
                }
            });

            const sortedDates = Object.keys(dateTotals)
                .filter(dateStr => dateTotals[dateStr].qty > 0 || dateTotals[dateStr].amount > 0)
                .sort((a, b) => {
                    const [d1, m1, y1] = a.split("/");
                    const [d2, m2, y2] = b.split("/");
                    return new Date(y1, m1 - 1, d1) - new Date(y2, m2 - 1, d2);
                });

            tableData = sortedDates.map(dateStr => {
                const data = dateTotals[dateStr];
                const amount = data.amount;
                totalAmount += amount;
                totalQtySum += data.qty;
                const effectiveRate = data.qty > 0 ? (amount / data.qty) : 0;
                return [
                    `Wash+Dry+Iron- ${dateStr}`,
                    data.qty.toFixed(2),
                    effectiveRate.toFixed(2),
                    amount.toFixed(2)
                ];
            });
        }

        if (tableData.length === 0) {
            alert("No billable quantity or amount found for the selected criteria.");
            return;
        }

        // 3. Initialize jsPDF
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();

        // --- HEADER ---
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
        doc.lines([[8, 0], [-1.2, 4.5], [-5.6, 0], [-1.2, -4.5]], bx + 2.5, by + 8, [1, 1], 'F');
        
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

        doc.setFontSize(22);
        doc.setTextColor(0, 0, 0);
        doc.text("INVOICE", pageWidth - 14, 20, { align: "right" });

        // --- BALANCE DUE ---
        doc.setFontSize(12);
        doc.text("Balance Due", pageWidth - 14, 35, { align: "right" });
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        // Format Indian Rupees
        // Format Indian Rupees safely for jsPDF (Standard fonts don't support ₹, so we use Rs.)
        const formattedTotal = "Rs. " + totalAmount.toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        doc.text(formattedTotal, pageWidth - 14, 43, { align: "right" });

        // --- BILLED BY & BILLED TO ---
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("Billed By", 14, 55);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 100);
        doc.text("Andes Services Private Limited\nRohan Abhilasha, Wagholi-Lohegaon,\nPune,\nMaharashtra, India - 412207", 14, 61);

        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 0, 0);
        doc.text("Billed To", pageWidth / 2, 55);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 100);
        // Handle multi-line address
        const splitAddress = doc.splitTextToSize(clientAddress, (pageWidth / 2) - 14);
        doc.text(clientName, pageWidth / 2, 61);
        doc.text(splitAddress, pageWidth / 2, 66);

        // --- INVOICE DETAILS ---
        const detailsY = 85;
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "normal");

        // Reverse format the invoice date for display
        const [iy, im, id] = invoiceDate.split("-");
        const formattedInvDate = `${id}/${im}/${iy}`;

        doc.text(`Hostel Name: ${selectedProperty === "ALL" ? "TOTAL INVOICE" : (HOSTEL_GROUPS[selectedProperty]?.label || selectedProperty)}`, 14, detailsY);
        doc.text(`Invoice Number: ${invoiceNo}`, 14, detailsY + 6);
        doc.text(`Invoice Date: ${formattedInvDate}`, 14, detailsY + 12);

        // --- TABLE ---
        // --- NEW FIXED CODE ---
        autoTable(doc, {
            startY: detailsY + 18,
            head: [['Date & Description', `Qty (${displayUnit})`, 'Rate', 'Amount']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [243, 244, 246], textColor: [0, 0, 0], fontStyle: 'bold' },
            styles: { fontSize: 9, cellPadding: 4 },
            columnStyles: {
                0: { cellWidth: 'auto' },
                1: { halign: 'right', cellWidth: 30 },
                2: { halign: 'right', cellWidth: 30 },
                3: { halign: 'right', cellWidth: 40 },
            },
            // Add Total Row at the bottom of the table
            foot: [['Total', totalQtySum.toFixed(2), '', formattedTotal]],
            footStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'right' },
        });

        // --- FOOTER SECTION (POST-TABLE) ---
        // Calculate where to start the footer
        let finalY = doc.lastAutoTable.finalY || 100;
        const pageHeight = doc.internal.pageSize.getHeight();
        const footerNeededSpace = 80; // Estimated height for words + notes + bank + sig

        // Check if we need a new page for the footer
        if (finalY + footerNeededSpace > pageHeight - 10) {
            doc.addPage();
            finalY = 20; // Start near top of new page
        }

        // 1. Total in Words
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 0, 0);
        doc.text(`Total In Words:`, pageWidth - 80, finalY + 15, { align: "right" });
        doc.setFont("helvetica", "italic");
        const words = numberToIndianWords(totalAmount);
        const splitWords = doc.splitTextToSize(words, 60);
        doc.text(splitWords, pageWidth - 14, finalY + 15, { align: "right" });

        // 2. Notes & Bank Details
        const footerY = finalY + 45;
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("Notes", 14, footerY);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text("Thanks for your business.", 14, footerY + 6);

        doc.text("Account Name: Andes Services Pvt Ltd", 14, footerY + 15);
        doc.text("Account Number: 50200116540940", 14, footerY + 21);
        doc.text("IFSC code: HDFC0000149", 14, footerY + 27);

        // 3. Signature Area
        const sigX = pageWidth - 70;
        const signatureImageWidth = 56;
        const signatureImageHeight = 24;
        const signatureImageY = footerY + 6;
        const signatureCenterX = sigX + signatureImageWidth / 2;

        try {
            const signature = await loadSignature();
            doc.addImage(signature, "JPEG", sigX, signatureImageY, signatureImageWidth, signatureImageHeight);
        } catch (error) {
            // Fallback if image loading fails.
            doc.setFont("helvetica", "bold");
            doc.text("ARYAN GUPTA", signatureCenterX, footerY + 20, { align: "center" });
            doc.setFontSize(8);
            doc.text("FOUNDER & CEO, ANDES", signatureCenterX, footerY + 25, { align: "center" });
            doc.setFontSize(10);
        }

        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("Authorized Signatory", signatureCenterX, footerY + 34, { align: "center" });

        // Save PDF
        doc.save(`${invoiceNo}_${selectedProperty}.pdf`);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white sm:rounded-2xl shadow-2xl w-full h-full sm:h-auto sm:max-w-2xl sm:max-h-[90vh] overflow-hidden animate-slide-up sm:animate-fade-in flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between p-5 sm:p-6 border-b border-gray-100 bg-gray-50/50 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                            <FiFileText size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Generate Invoice</h2>
                            <p className="text-xs text-gray-500">Create a PDF invoice for billing clients</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                        <FiX size={24} />
                    </button>
                </div>

                {/* Form Body */}
                <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1">

                    {/* Row 1: Dates */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Orders From Date *</label>
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                                className="w-full p-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" required />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Orders To Date *</label>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                                className="w-full p-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" required />
                        </div>
                    </div>

                    {/* Row 2: Property & Rate */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Property / Grouping</label>
                            <select value={selectedProperty} onChange={e => setSelectedProperty(e.target.value)}
                                className="w-full p-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                                <option value="ALL">All Properties</option>
                                <optgroup label="Custom Groups">
                                    {Object.entries(HOSTEL_GROUPS).map(([key, group]) => (
                                        <option key={key} value={key}>{group.label}</option>
                                    ))}
                                </optgroup>
                                <optgroup label="Individual Properties">
                                    {uniqueProperties.map(p => (
                                        <option key={p} value={p}>{p}</option>
                                    ))}
                                </optgroup>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Rate per {getUnitLabel(selectedProperty)} *</label>
                            <input type="number" min="0" step="0.01" value={rate} onChange={e => handleRateChange(e.target.value)}
                                className="w-full p-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" required />
                        </div>
                    </div>

                    {/* Row 3: Invoice Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Invoice Number *</label>
                            <input type="text" placeholder="e.g. INV-000029" value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)}
                                className="w-full p-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" required />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Invoice Date *</label>
                            <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)}
                                className="w-full p-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" required />
                        </div>
                    </div>

                    {/* Row 4: Client Address Info */}
                    <div className="space-y-4 pt-2 border-t border-gray-100">
                        <h3 className="text-sm font-bold text-gray-800">Billed To Details</h3>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Client Company Name *</label>
                            <input type="text" placeholder="e.g. Aaalay property solution private limited" value={clientName} onChange={e => setClientName(e.target.value)}
                                className="w-full p-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" required />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Client Address *</label>
                            <textarea rows="3" placeholder="Sr. No. 53/7, Nr Lohia Jain Square..." value={clientAddress} onChange={e => setClientAddress(e.target.value)}
                                className="w-full p-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" required />
                        </div>
                    </div>

                </div>

                {/* Footer Actions */}
                <div className="p-5 sm:p-6 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row justify-end gap-3 flex-shrink-0">
                    <button onClick={onClose} className="order-2 sm:order-1 px-5 py-3 sm:py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors">
                        Cancel
                    </button>
                    <button onClick={generatePDF} className="order-1 sm:order-2 px-5 py-3 sm:py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2">
                        <FiDownload size={18} /> Generate PDF
                    </button>
                </div>

            </div>
        </div>
    );
}
