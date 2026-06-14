import { doc, getDoc, setDoc, runTransaction } from "firebase/firestore";
import { db } from "../firebase";
import { ORDER_CATEGORIES } from "../constants/orders";

/**
 * Returns the target collection for saving order edits/metadata.
 */
function getOrderTargetCollection(order) {
    const isB2B =
        order.category === ORDER_CATEGORIES.STUDENT_LAUNDRY ||
        order.category === ORDER_CATEGORIES.LINEN ||
        order.category === ORDER_CATEGORIES.AIRBNB ||
        order.category === "STUDENT_LAUNDRY" ||
        order.category === "LINEN" ||
        order.category === "AIRBNB";

    return isB2B ? "b2b_orders" : "b2b_admin_edits";
}

/**
 * Gets the existing invoice number from an order, or atomically generates
 * a new one and saves it back to Firestore.
 * Format: INV-YYYY-XXXX (e.g. INV-2026-0042)
 */
export async function getOrAssignInvoiceNumber(order) {
    if (order.invoiceNo) {
        return order.invoiceNo;
    }

    try {
        // Generate a deterministic invoice number based on Date and Order ID
        // Format: INV-[YYMMDD]-[Last 4 chars of ID]
        const orderDate = order.date || new Date().toISOString().split("T")[0];
        const [yyyy, mm, dd] = orderDate.split("-");
        const yy = yyyy.slice(-2);
        
        const shortId = String(order.id).slice(-4).toUpperCase();
        const newInvoiceNo = `INV-${yy}${mm}${dd}-${shortId}`;

        // Now, we must update the order with the new invoiceNo
        const targetCollection = getOrderTargetCollection(order);
        const orderRef = doc(db, targetCollection, String(order.id));
        
        // Cleanup any undefined fields that might crash Firestore before saving
        const cleanOrder = { ...order, invoiceNo: newInvoiceNo };
        Object.keys(cleanOrder).forEach(key => {
            if (cleanOrder[key] === undefined) {
                delete cleanOrder[key];
            }
        });

        // We use merge: true to avoid wiping out other fields 
        // if we're writing to b2b_admin_edits for the first time.
        await setDoc(orderRef, cleanOrder, { merge: true });

        return newInvoiceNo;
    } catch (error) {
        console.error("Error generating invoice number:", error);
        throw error;
    }
}
