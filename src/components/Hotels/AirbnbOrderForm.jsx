// src/components/AirbnbOrderForm.jsx
import { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { FiPlus, FiTrash2, FiLoader } from "react-icons/fi";
import { isNegativeNumberInput } from "../../utils/numberInputUtils";

const COMMON_ITEMS = [
    "Single Bedsheet", "Double Bedsheet", "Duvet Cover",
    "Pillow Cover", "Bath towel", "Blanket", "Curtain", "Door mat"
];

export default function AirbnbOrderForm({ clientName, onSuccess }) {
    const [items, setItems] = useState([{ name: "Single Bedsheet", quantity: 1 }]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const handleAddItem = () => {
        setItems([...items, { name: "", quantity: 1 }]);
    };

    const handleRemoveItem = (index) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const handleItemChange = (index, field, value) => {
    if (field === "quantity" && isNegativeNumberInput(value)) return;
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            const validItems = items.filter(item => item.name.trim() !== "" && item.quantity > 0);
            if (validItems.length === 0) throw new Error("Please add at least one item.");

            const detailsString = validItems.map(item => `${item.name}: ${item.quantity}`).join(", ");

            const partnerItemsMap = {};
            validItems.forEach(item => {
                partnerItemsMap[item.name] = Number(item.quantity);
            });

            // Format matching our strict requirements
            const orderPayload = {
                // --- STRICT RIDER APP SCHEMA ---
                createdAt: serverTimestamp(),
                details: detailsString,
                location: "Airbnb viman nagar",
                partnerName: "Airbnb viman nagar",
                partnerItems: partnerItemsMap,
                riderId: "hqIBD5ECsqY7bFcqjXD50ggoaDC2",

                // --- WEB DASHBOARD HELPER FIELDS ---
                date: new Date().toISOString().split("T")[0],
                property: clientName,
                category: "AIRBNB",
                items: validItems.reduce((sum, item) => sum + Number(item.quantity), 0)
            };

            await addDoc(collection(db, "b2b_orders"), orderPayload);

            setItems([{ name: "Single Bedsheet", quantity: 1 }]);
            if (onSuccess) onSuccess();

        } catch (err) {
            console.error("Order submission failed:", err);
            setError(err.message || "Failed to place order. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Removed outer borders/padding since it's now wrapped in a modal
    return (
        <div className="font-sans">
            {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-3">
                    <label className="block text-sm font-bold text-gray-700">Laundry Items to Pickup</label>
                    {items.map((item, index) => (
                        <div key={index} className="flex items-center gap-3">
                            <input
                                type="text"
                                list="common-items"
                                placeholder="Item name (e.g., Blanket)"
                                value={item.name}
                                onChange={(e) => handleItemChange(index, "name", e.target.value)}
                                className="flex-1 p-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                required
                            />
                            <datalist id="common-items">
                                {COMMON_ITEMS.map(i => <option key={i} value={i} />)}
                            </datalist>

                            <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                                className="w-24 p-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                required
                            />

                            <button
                                type="button"
                                onClick={() => handleRemoveItem(index)}
                                className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                            >
                                <FiTrash2 size={18} />
                            </button>
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={handleAddItem}
                        className="flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-700 mt-2"
                    >
                        <FiPlus /> Add Another Item
                    </button>
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-blue-700 disabled:opacity-70 transition-colors shadow-sm"
                >
                    {isSubmitting ? <FiLoader className="animate-spin" /> : null}
                    {isSubmitting ? "Placing Order..." : "Confirm Order"}
                </button>
            </form>
        </div>
    );
}
