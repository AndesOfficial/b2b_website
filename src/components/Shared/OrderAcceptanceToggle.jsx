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
      <div className="flex items-center gap-2 text-sm font-medium text-slate-500 px-5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl animate-pulse">
        <div className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-slate-500 animate-spin"></div>
        Loading Status...
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-4 px-5 py-2.5 border rounded-xl shadow-sm transition-all duration-300 ${
      isAccepting ? "bg-emerald-50/50 border-emerald-100" : "bg-rose-50/50 border-rose-100"
    }`}>
      <div className="flex flex-col">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
          Store Status
        </span>
        <div className="flex items-center gap-1.5">
          <span className={`relative flex h-2.5 w-2.5`}>
            {isAccepting && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            )}
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isAccepting ? "bg-emerald-500" : "bg-rose-500"}`}></span>
          </span>
          <span className={`text-sm font-bold ${isAccepting ? "text-emerald-700" : "text-rose-700"}`}>
            {isAccepting ? "Accepting Orders" : "Store Paused"}
          </span>
        </div>
      </div>
      
      {/* Toggle Switch */}
      <button
        onClick={handleToggle}
        className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-1 ${
          isAccepting 
            ? "bg-emerald-500 focus:ring-emerald-500" 
            : "bg-rose-500 focus:ring-rose-500"
        } hover:opacity-90`}
        role="switch"
        aria-checked={isAccepting}
        title={isAccepting ? "Pause Orders" : "Start Accepting Orders"}
      >
        <span className="sr-only">Toggle store status</span>
        <span
          aria-hidden="true"
          className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-300 ease-in-out ${
            isAccepting ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
