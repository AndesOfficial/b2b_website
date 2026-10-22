import { useState, useEffect } from "react";
import {
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../firebase";
import { FiCheck, FiAlertCircle, FiClock, FiCalendar } from "react-icons/fi";

function getStartOfTodayIST() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const istDateStr = formatter.format(new Date()); // YYYY-MM-DD
  return new Date(`${istDateStr}T00:00:00+05:30`);
}

export default function OrderAcceptanceToggle() {
  const [isAccepting, setIsAccepting] = useState(true);
  const [limitEnabled, setLimitEnabled] = useState(false);
  const [maxOrders, setMaxOrders] = useState(20);
  const [inputLimit, setInputLimit] = useState("20");
  const [isSavingLimit, setIsSavingLimit] = useState(false);
  const [todayOrderCount, setTodayOrderCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // ── 1. Read / Sync Config from store_settings/config ───────────────────────
  useEffect(() => {
    const configDocRef = doc(db, "store_settings", "config");

    const unsubscribe = onSnapshot(
      configDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setIsAccepting(data.is_accepting_orders ?? true);
          setLimitEnabled(data.daily_order_limit_enabled ?? false);
          const limit = data.max_daily_orders ?? 20;
          setMaxOrders(limit);
          setInputLimit(String(limit));
        } else {
          setDoc(
            configDocRef,
            {
              is_accepting_orders: true,
              daily_order_limit_enabled: false,
              max_daily_orders: 20,
            },
            { merge: true }
          );
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

  // ── 2. Listen to Today's Customer App Orders (cartdetails) in Real Time ─────
  useEffect(() => {
    try {
      const startOfToday = getStartOfTodayIST();
      const todayQuery = query(
        collection(db, "cartdetails"),
        where("createdAt", ">=", Timestamp.fromDate(startOfToday))
      );

      const unsubscribe = onSnapshot(
        todayQuery,
        (snapshot) => {
          const activeOrders = snapshot.docs.filter((d) => {
            const status = String(d.data()?.status || "").toLowerCase();
            return status !== "cancelled" && status !== "rejected";
          });
          setTodayOrderCount(activeOrders.length);
        },
        (error) => {
          console.error("Error fetching today's orders count:", error);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.error("Setup today's orders listener error:", err);
    }
  }, []);

  // ── 3. Keep is_daily_limit_reached synchronized in store_settings/config ───
  useEffect(() => {
    if (loading) return;
    const configDocRef = doc(db, "store_settings", "config");
    const isReached = limitEnabled && todayOrderCount >= maxOrders;

    updateDoc(configDocRef, {
      is_daily_limit_reached: isReached,
      today_order_count: todayOrderCount,
      daily_limit_date: new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
      }).format(new Date()),
    }).catch((err) => {
      console.warn("Could not sync is_daily_limit_reached:", err);
    });
  }, [loading, limitEnabled, todayOrderCount, maxOrders]);

  // ── 4. Toggle Store Status ────────────────────────────────────────────────
  const handleToggleStoreStatus = async () => {
    const configDocRef = doc(db, "store_settings", "config");
    const newState = !isAccepting;
    setIsAccepting(newState);

    try {
      await updateDoc(configDocRef, {
        is_accepting_orders: newState,
      });
    } catch (error) {
      console.error("Error updating store status:", error);
      setIsAccepting(!newState);
      alert("Failed to update store status. Please try again.");
    }
  };

  // ── 5. Toggle Daily Limit Switch ──────────────────────────────────────────
  const handleToggleDailyLimit = async () => {
    const configDocRef = doc(db, "store_settings", "config");
    const newState = !limitEnabled;
    setLimitEnabled(newState);

    try {
      await updateDoc(configDocRef, {
        daily_order_limit_enabled: newState,
        is_daily_limit_reached: newState && todayOrderCount >= maxOrders,
      });
    } catch (error) {
      console.error("Error updating daily limit status:", error);
      setLimitEnabled(!newState);
      alert("Failed to update daily order limit setting.");
    }
  };

  // ── 6. Save Max Orders Limit ──────────────────────────────────────────────
  const handleSaveMaxOrders = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const val = parseInt(inputLimit, 10);
    if (isNaN(val) || val <= 0) return;
    setIsSavingLimit(true);
    try {
      const configDocRef = doc(db, "store_settings", "config");
      await updateDoc(configDocRef, {
        max_daily_orders: val,
        is_daily_limit_reached: limitEnabled && todayOrderCount >= val,
      });
      setMaxOrders(val);
    } catch (error) {
      console.error("Error updating max daily orders:", error);
      alert("Failed to save max orders limit.");
    } finally {
      setIsSavingLimit(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm font-medium text-slate-500 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl animate-pulse">
        <div className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-slate-500 animate-spin"></div>
        Loading Controls...
      </div>
    );
  }

  const isLimitReached = limitEnabled && todayOrderCount >= maxOrders;
  const capacityPercent = limitEnabled && maxOrders > 0
    ? Math.min(100, Math.round((todayOrderCount / maxOrders) * 100))
    : 0;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* ── Block 1: Store Accepting / Paused Switch ── */}
      <div
        className={`flex items-center gap-3.5 px-4 py-2 border rounded-xl shadow-sm transition-all duration-300 ${
          isAccepting
            ? "bg-emerald-50/60 border-emerald-200/80"
            : "bg-rose-50/60 border-rose-200/80"
        }`}
      >
        <div className="flex flex-col">
          <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">
            Store Status
          </span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="relative flex h-2 w-2">
              {isAccepting && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isAccepting ? "bg-emerald-500" : "bg-rose-500"
                }`}
              ></span>
            </span>
            <span
              className={`text-xs font-black ${
                isAccepting ? "text-emerald-800" : "text-rose-800"
              }`}
            >
              {isAccepting ? "Accepting" : "Paused"}
            </span>
          </div>
        </div>

        {/* Store Toggle Button */}
        <button
          onClick={handleToggleStoreStatus}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            isAccepting ? "bg-emerald-500" : "bg-rose-500"
          } hover:opacity-90`}
          role="switch"
          aria-checked={isAccepting}
          title={isAccepting ? "Pause Store Orders" : "Start Accepting Orders"}
        >
          <span className="sr-only">Toggle store status</span>
          <span
            aria-hidden="true"
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
              isAccepting ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* ── Block 2: Daily Order Limit & Intake Counter ── */}
      <div
        className={`flex flex-wrap items-center gap-3 px-4 py-2 border rounded-xl shadow-sm transition-all duration-300 ${
          isLimitReached
            ? "bg-amber-50/70 border-amber-200"
            : limitEnabled
            ? "bg-blue-50/50 border-blue-200"
            : "bg-slate-50 border-slate-200"
        }`}
      >
        {/* Switch: Daily Limit ON/OFF */}
        <div className="flex items-center gap-2.5 pr-2 border-r border-slate-200/80">
          <div className="flex flex-col">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">
              Daily Limit
            </span>
            <span
              className={`text-xs font-bold ${
                limitEnabled ? "text-blue-900" : "text-slate-500"
              }`}
            >
              {limitEnabled ? "Enabled" : "Off"}
            </span>
          </div>

          <button
            onClick={handleToggleDailyLimit}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              limitEnabled ? "bg-blue-600" : "bg-slate-300"
            } hover:opacity-90`}
            role="switch"
            aria-checked={limitEnabled}
            title={limitEnabled ? "Disable Daily Limit" : "Enable Daily Limit"}
          >
            <span className="sr-only">Toggle daily order limit</span>
            <span
              aria-hidden="true"
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                limitEnabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Number Input: Max Daily Orders */}
        <form
          onSubmit={handleSaveMaxOrders}
          className="flex items-center gap-1.5"
        >
          <div className="flex flex-col">
            <label className="text-[9px] font-black uppercase tracking-wider text-slate-400">
              Max / Day
            </label>
            <div className="flex items-center gap-1 mt-0.5">
              <input
                type="number"
                min="1"
                step="1"
                value={inputLimit}
                disabled={!limitEnabled}
                onChange={(e) => setInputLimit(e.target.value)}
                onBlur={handleSaveMaxOrders}
                className={`w-14 rounded-lg border px-2 py-0.5 text-xs font-black text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 text-center ${
                  limitEnabled
                    ? "border-blue-300 bg-white"
                    : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                }`}
                title="Max orders accepted per day"
              />
              {inputLimit !== String(maxOrders) && limitEnabled && (
                <button
                  type="submit"
                  disabled={isSavingLimit}
                  className="rounded-md bg-blue-600 p-1 text-white hover:bg-blue-700 text-[10px]"
                  title="Save Limit"
                >
                  <FiCheck size={12} />
                </button>
              )}
            </div>
          </div>
        </form>

        {/* Live Intake Status & Counter */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200/80">
          <div className="flex flex-col">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">
              Today's Orders
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs font-black text-slate-900">
                {todayOrderCount}
                {limitEnabled ? ` / ${maxOrders}` : ""}
              </span>

              {limitEnabled && (
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-black ${
                    isLimitReached
                      ? "bg-rose-100 text-rose-800 border border-rose-300 animate-pulse"
                      : capacityPercent >= 80
                      ? "bg-amber-100 text-amber-800 border border-amber-200"
                      : "bg-blue-100 text-blue-800 border border-blue-200"
                  }`}
                  title={`${capacityPercent}% of today's limit used`}
                >
                  {isLimitReached ? "100% Full" : `${capacityPercent}%`}
                </span>
              )}
            </div>
          </div>

          {/* Limit Reached Pill Alert */}
          {isLimitReached && (
            <div
              className="flex items-center gap-1 rounded-lg bg-amber-100 border border-amber-300 px-2 py-1 text-[11px] font-bold text-amber-900"
              title="Today's order limit has been reached. App is now scheduling new orders for tomorrow."
            >
              <FiClock size={12} className="text-amber-700 shrink-0" />
              <span>Next-Day Mode Active</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
