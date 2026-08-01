import { useState, useEffect } from "react";
import { doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";

export default function OrderAcceptanceToggle() {
  const [isAccepting, setIsAccepting] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const configDocRef = doc(db, "store_settings", "config");

    const unsubscribe = onSnapshot(
      configDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setIsAccepting(docSnap.data().is_accepting_orders);
        } else {
          // Initialize if it doesn't exist
          setDoc(configDocRef, { is_accepting_orders: true }, { merge: true });
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching store settings:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleToggle = async () => {
    const configDocRef = doc(db, "store_settings", "config");
    const newState = !isAccepting;
    setIsAccepting(newState); // Optimistic update

    try {
      await updateDoc(configDocRef, {
        is_accepting_orders: newState,
      });
    } catch (error) {
      console.error("Error updating store status:", error);
      setIsAccepting(!newState); // Revert on error
      alert("Failed to update store status. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center text-sm text-gray-500 px-4 py-2 bg-gray-100 rounded-xl">
        Loading status...
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 bg-white px-4 py-2 border border-gray-200 rounded-xl shadow-sm">
      <div className="flex flex-col">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Store Status</span>
        <span className={`text-sm font-semibold ${isAccepting ? "text-green-600" : "text-red-600"}`}>
          {isAccepting ? "Accepting Orders" : "Orders Paused"}
        </span>
      </div>
      
      {/* Toggle Switch */}
      <button
        onClick={handleToggle}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
          isAccepting ? "bg-green-500" : "bg-red-500"
        }`}
        role="switch"
        aria-checked={isAccepting}
      >
        <span className="sr-only">Toggle store status</span>
        <span
          aria-hidden="true"
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            isAccepting ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
