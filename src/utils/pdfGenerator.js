import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ORDER_CATEGORIES, ORDER_TYPES } from '../constants/orders';
import signatureImage from "../assets/signature.jpeg";

const loadSignature = () =>
    new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = signatureImage;
    });

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

const drawAndesHeader = (doc, titleText, bx = 14, by = 10) => {
    const pageWidth = doc.internal.pageSize.getWidth();
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
    doc.text(titleText, pageWidth - 14, 20, { align: "right" });
};

const drawFooter = async (doc, totalAmount, finalY) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const footerNeededSpace = 80;

    if (finalY + footerNeededSpace > pageHeight - 10) {
        doc.addPage();
        finalY = 20; 
    }

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(`Total In Words:`, pageWidth - 80, finalY + 15, { align: "right" });
    doc.setFont("helvetica", "italic");
    const words = numberToIndianWords(totalAmount);
    const splitWords = doc.splitTextToSize(words, 60);
    doc.text(splitWords, pageWidth - 14, finalY + 15, { align: "right" });

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

    const sigX = pageWidth - 70;
    const signatureImageWidth = 56;
    const signatureImageHeight = 24;
    const signatureImageY = footerY + 6;
    const signatureCenterX = sigX + signatureImageWidth / 2;

    try {
        const signature = await loadSignature();
        doc.addImage(signature, "JPEG", sigX, signatureImageY, signatureImageWidth, signatureImageHeight);
    } catch (error) {
        doc.setFont("helvetica", "bold");
        doc.text("ARYAN GUPTA", signatureCenterX, footerY + 20, { align: "center" });
        doc.setFontSize(8);
        doc.text("FOUNDER & CEO, ANDES", signatureCenterX, footerY + 25, { align: "center" });
        doc.setFontSize(10);
    }

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Authorized Signatory", signatureCenterX, footerY + 34, { align: "center" });
};

export const generateSingleInvoicePDF = async (order, invoiceNo, returnBlob = false) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    drawAndesHeader(doc, "INVOICE");

    const totalAmount = Number(order.amount || 0);
    const formattedTotal = "Rs. " + totalAmount.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    doc.setFontSize(12);
    doc.text("Balance Due", pageWidth - 14, 35, { align: "right" });
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(formattedTotal, pageWidth - 14, 43, { align: "right" });

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
    
    // For B2C, use customer name. For B2B, use property/hostel name.
    const isB2B = order.type === ORDER_TYPES.AIRBNB || order.type === ORDER_TYPES.STUDENT || order.type === ORDER_TYPES.LINEN || order.category?.includes("B2B");
    const clientName = isB2B ? (order.property || order.tenant || "Client") : (order.customerName || "Retail Customer");
    const clientPhone = order.customerNumber ? `\nPhone: ${order.customerNumber}` : "";
    
    const splitAddress = doc.splitTextToSize((order.address || "Pune, Maharashtra") + clientPhone, (pageWidth / 2) - 14);
    doc.text(clientName, pageWidth / 2, 61);
    doc.text(splitAddress, pageWidth / 2, 66);

    const detailsY = 85;
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");

    const orderDate = order.date || new Date().toISOString().split("T")[0];
    const [iy, im, id] = orderDate.split("-");
    const formattedInvDate = `${id}/${im}/${iy}`;

    doc.text(`Order ID: ${order.id}`, 14, detailsY);
    doc.text(`Invoice Number: ${invoiceNo}`, 14, detailsY + 6);
    doc.text(`Invoice Date: ${formattedInvDate}`, 14, detailsY + 12);

    // Build Table Data
    let tableData = [];
    let displayUnit = isB2B ? (order.items > 0 ? "Pcs" : "Kg") : "Pcs";
    let totalQtySum = isB2B ? (order.items > 0 ? order.items : order.weight || 1) : (order.items || 1);

    if (!isB2B && order.serviceBreakdown) {
        // B2C Itemized Breakdown
        Object.entries(order.serviceBreakdown).forEach(([itemName, details]) => {
            if (details.quantity > 0) {
                tableData.push([
                    itemName,
                    String(details.quantity),
                    details.price ? details.price.toFixed(2) : "0.00",
                    (details.quantity * (details.price || 0)).toFixed(2)
                ]);
            }
        });
        if (tableData.length === 0) {
            tableData.push([
                order.service || "Laundry Services",
                String(totalQtySum),
                (totalAmount / totalQtySum).toFixed(2),
                totalAmount.toFixed(2)
            ]);
        }
    } else {
        // B2B or Simple Order
        const serviceDesc = order.service || (isB2B ? "Wash+Dry+Iron" : "Laundry Service");
        tableData.push([
            serviceDesc,
            String(totalQtySum),
            (totalAmount / (totalQtySum || 1)).toFixed(2),
            totalAmount.toFixed(2)
        ]);
    }

    autoTable(doc, {
        startY: detailsY + 18,
        head: [['Description', `Qty`, 'Rate', 'Amount']],
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
        foot: [['Total', '', '', formattedTotal]],
        footStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'right' },
    });

    const finalY = doc.lastAutoTable.finalY || 100;
    await drawFooter(doc, totalAmount, finalY);

    if (returnBlob) {
        return doc.output('blob');
    } else {
        doc.save(`${invoiceNo}_${clientName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
    }
};

export const generateAnnexurePDF = async (orders, title, startDate, endDate) => {
    const doc = new jsPDF('landscape'); // Use landscape for Annexure due to many columns
    const pageWidth = doc.internal.pageSize.getWidth();

    drawAndesHeader(doc, "ANNEXURE", 14, 10);

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Period: ${startDate} to ${endDate}`, 14, 30);
    doc.text(`Filter: ${title}`, 14, 36);

    let totalRevenue = 0;
    
    const tableData = orders.map(order => {
        const amt = Number(order.amount || 0);
        totalRevenue += amt;
        
        const isB2B = order.type === ORDER_TYPES.AIRBNB || order.type === ORDER_TYPES.STUDENT || order.type === ORDER_TYPES.LINEN || order.category?.includes("B2B");
        const clientName = isB2B ? (order.property || order.tenant || "Client") : (order.customerName || "Retail");
        const serviceDesc = order.service || "Laundry";
        const qty = isB2B ? `${order.items > 0 ? order.items + " Pcs" : (order.weight || 0) + " Kg"}` : `${order.items || 0} Pcs`;

        return [
            order.invoiceNo || "PENDING",
            order.date,
            order.id.slice(-6),
            clientName,
            serviceDesc.substring(0, 25),
            qty,
            amt.toFixed(2)
        ];
    });

    const formattedTotal = "Rs. " + totalRevenue.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    autoTable(doc, {
        startY: 42,
        head: [['Invoice No', 'Date', 'Order Ref', 'Customer / Property', 'Service', 'Qty/Weight', 'Amount']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [25, 118, 210], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 3 },
        columnStyles: {
            6: { halign: 'right' }
        },
        foot: [['Total', '', '', '', '', '', formattedTotal]],
        footStyles: { fillColor: [243, 244, 246], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'right' },
    });

    doc.save(`Annexure_${title}_${startDate}_to_${endDate}.pdf`);
};
