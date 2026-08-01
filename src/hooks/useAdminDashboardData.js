import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase";
import { ORDER_CATEGORIES, ORDER_TYPES } from "../constants/orders";
import { getTodayString, getMonthStartString } from "../utils/dateUtils";

// getTodayString and getMonthStartString are imported from ../utils/dateUtils

function buildDaysInRange(dateFrom, dateTo) {
  const from = new Date(dateFrom || getTodayString());
  const to = new Date(dateTo || getTodayString());
  const dates = [];

  for (let day = new Date(from); day <= to; day.setDate(day.getDate() + 1)) {
    const year = day.getFullYear();
    const month = String(day.getMonth() + 1).padStart(2, "0");
    const date = String(day.getDate()).padStart(2, "0");
    dates.push(`${year}-${month}-${date}`);
  }

  return dates;
}

// Helper to remove undefined fields which Firestore doesn't support
const cleanObject = (obj) => {
  const newObj = { ...obj };
  Object.keys(newObj).forEach((key) => {
    if (newObj[key] === undefined) delete newObj[key];
  });
  return newObj;
};

function isHotelOrder(order) {
  const propertyName = String(order.property || "").toLowerCase();
  return order.type === ORDER_TYPES.AIRBNB
    || order.category === ORDER_CATEGORIES.AIRBNB
    || propertyName.includes("airbnb")
    || propertyName.includes("hotel");
}

function hasMeaningfulHotelData(order) {
  const detailCount = Object.values(order.details || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
  return (order.amount || 0) > 0 || detailCount > 0;
}

// isHiddenHotelRecord removed - record should be soft-deleted in Firestore instead

function buildDashboardStats({ activeTab, allManagers, daysInRange, orders }) {
  const validOrders = orders.filter((order) => 
    order.category !== "ISSUES" && 
    order.status !== "Cancelled" && 
    order.status !== "Abandoned" && 
    order.type !== "abandoned"
  );
  let focusOrders = validOrders;

  if (activeTab === "regular") {
    focusOrders = validOrders.filter((order) => order.type === "regular");
  } else if (activeTab === "hostels") {
    focusOrders = validOrders.filter((order) => order.type === "student" || order.type === "linen");
  } else if (activeTab === "hotels") {
    focusOrders = validOrders.filter((order) => isHotelOrder(order) && hasMeaningfulHotelData(order));
  }

  const issues = orders.filter((order) => order.category === "ISSUES");
  const totalRevenue = focusOrders.reduce((sum, order) => sum + (order.amount || 0), 0);
  const totalOrders = focusOrders.length;
  const totalKg = focusOrders.reduce((sum, order) => sum + (order.weight || 0), 0);
  const totalClients = activeTab === "regular"
    ? new Set(focusOrders.filter((order) => order.customerName && !order.id.includes("adj")).map((order) => order.customerName)).size
    : activeTab === "hostels" || activeTab === "hotels"
      ? new Set(focusOrders.map((order) => order.property)).size
      : allManagers.length;

  const hostelRevenue = validOrders
    .filter((order) => order.type === "student" || order.type === "linen")
    .reduce((sum, order) => sum + (order.amount || 0), 0);
  const retailRevenue = validOrders
    .filter((order) => order.type === "regular")
    .reduce((sum, order) => sum + (order.amount || 0), 0);
  const hotelRevenue = validOrders
    .filter((order) => isHotelOrder(order) && hasMeaningfulHotelData(order))
    .reduce((sum, order) => sum + (order.amount || 0), 0);

  const getTrend = (filterFn) => (
    daysInRange.map((fullDate) => ({
      v: validOrders
        .filter((order) => order.date === fullDate && filterFn(order))
        .reduce((sum, order) => sum + (order.amount || order.weight || 1), 0),
    }))
  );

  const b2cOrders = validOrders.filter((o) =>
    (o.type === "regular" || o.source === "cartdetails" || o.source === "website") &&
    o.type !== "rider_tracking" &&  // exclude rider tracking records from B2C count
    o.type !== "abandoned"          // exclude abandoned carts from B2C count
  );

  const b2bOrders = validOrders.filter((o) => o.type === "student" || o.type === "linen" || o.type === "airbnb" || o.source === "b2b" || o.source === "hostels");

  const b2cPickups = b2cOrders.filter((o) => {
    const s = String(o.status || "").toLowerCase();
    return s === "processing" || s === "delivered" || s === "completed" || s === "picked up" || s === "pickup done" || s === "confirmed" || s === "pending";
  }).length;
  const b2cDeliveries = b2cOrders.filter((o) => {
    const s = String(o.status || "").toLowerCase();
    return s === "delivered" || s === "completed";
  }).length;

  const b2bPickups = b2bOrders.filter((o) => {
    const s = String(o.status || "").toLowerCase();
    return s !== "cancelled" && s !== "abandoned";
  }).length;
  const b2bDeliveries = b2bOrders.filter((o) => {
    const s = String(o.status || "").toLowerCase();
    return s === "delivered" || s === "completed";
  }).length;

  const b2cKg = b2cOrders.reduce((sum, o) => sum + (o.weight || 0), 0);
  const b2bKg = b2bOrders.reduce((sum, o) => sum + (o.weight || 0), 0);

  const b2cServicesKg = {};

  b2cOrders.forEach(o => {
    if (o.serviceBreakdown && Array.isArray(o.serviceBreakdown) && o.serviceBreakdown.length > 0) {
      o.serviceBreakdown.forEach(item => {
        const name = item.name || "Other";
        const itemWt = Number(item.weight) || 0;
        const itemQty = Number(item.quantity) || 0;
        if (!b2cServicesKg[name]) {
          b2cServicesKg[name] = { weight: 0, quantity: 0 };
        }
        b2cServicesKg[name].weight += itemWt;
        b2cServicesKg[name].quantity += itemQty;
      });
    } else {
      const name = o.service || "Other";
      const wt = Number(o.weight) || 0;
      const qty = Number(o.items) || 0;
      if (!b2cServicesKg[name]) {
        b2cServicesKg[name] = { weight: 0, quantity: 0 };
      }
      b2cServicesKg[name].weight += wt;
      b2cServicesKg[name].quantity += qty;
    }
  });

  return {
    totalRevenue,
    totalOrders,
    totalKg,
    totalClients,
    openIssuesCount: issues.filter((issue) => issue.resolveStatus !== "Resolved").length,
    breakdown: { hostelRevenue, retailRevenue, hotelRevenue },
    b2cPickups,
    b2cDeliveries,
    b2bPickups,
    b2bDeliveries,
    b2cKg,
    b2bKg,
    b2cServicesKg,
    sparklines: {
      revenue: getTrend((order) => {
        if (activeTab === "regular") return order.type === "regular";
        if (activeTab === "hostels") return order.type === "student" || order.type === "linen";
        if (activeTab === "hotels") return isHotelOrder(order) && hasMeaningfulHotelData(order);
        return order.category !== "ISSUES";
      }),
      orders: getTrend((order) => {
        if (activeTab === "regular") return order.type === "regular";
        if (activeTab === "hostels") return order.type === "student" || order.type === "linen";
        if (activeTab === "hotels") return isHotelOrder(order) && hasMeaningfulHotelData(order);
        return order.category !== "ISSUES";
      }),
      kg: getTrend((order) => {
        if (activeTab === "regular") return order.type === "regular";
        if (activeTab === "hostels") return order.type === "student" || order.type === "linen";
        if (activeTab === "hotels") return isHotelOrder(order) && hasMeaningfulHotelData(order);
        return order.category !== "ISSUES";
      }),
      clients: daysInRange.map((_, index) => ({ v: 10 + Math.sin(index) * 2 })),
      issues: getTrend((order) => order.category === "ISSUES"),
    },
  };
}

export function useAdminDashboardData({ activeTab, baseOrders, dateFrom, dateTo }) {
  const [allManagers, setAllManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [screenStats, setScreenStats] = useState([]);
  const [searchStats, setSearchStats] = useState([]);
  const [totalUsers, setTotalUsers] = useState(0);

  useEffect(() => {
    let activeSubscriptions = [];

    const clearSubscriptions = () => {
      activeSubscriptions.forEach((unsubscribe) => unsubscribe());
      activeSubscriptions = [];
    };

    const resetRealtimeState = () => {
      setAllManagers([]);
      setScreenStats([]);
      setSearchStats([]);
      setTotalUsers(0);
      setLoading(false);
    };

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      clearSubscriptions();

      if (!user) {
        resetRealtimeState();
        return;
      }

      setLoading(true);

      activeSubscriptions = [
        onSnapshot(collection(db, "b2b_managers"), (snapshot) => {
          const managers = snapshot.docs
            .map((docSnapshot) => ({ uid: docSnapshot.id, ...docSnapshot.data() }))
            .filter((manager) => manager.role !== "admin");
          setAllManagers(managers);
        }, (error) => console.error("Error fetching managers list:", error)),
        onSnapshot(
          query(collection(db, "analytics", "screens", "popular"), orderBy("visitCount", "desc"), limit(10)),
          (snapshot) => setScreenStats(snapshot.docs.map((docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() }))),
          (error) => console.error("Error fetching screen stats:", error),
        ),
        onSnapshot(
          query(collection(db, "analytics", "searches", "popular"), orderBy("count", "desc"), limit(50)),
          (snapshot) => {
            const rawSearches = snapshot.docs.map((docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() }));
            
            const filteredSearches = [];
            for (const search of rawSearches) {
              const queryStr = (search.query || "").toLowerCase().trim();
              if (queryStr.length < 3) continue; // skip 1-2 char queries like 'b', 'bl'
              
              // Check if this query is just a partial typing of another longer query in the list
              const isPartial = rawSearches.some(other => {
                 if (other.id === search.id) return false;
                 const otherStr = (other.query || "").toLowerCase().trim();
                 return otherStr.length > queryStr.length && otherStr.startsWith(queryStr);
              });

              if (!isPartial) {
                 filteredSearches.push(search);
              }
            }
            
            // Set the top 10 meaningful, complete searches
            setSearchStats(filteredSearches.slice(0, 10));
          },
          (error) => console.error("Error fetching search stats:", error),
        ),
        onSnapshot(
          collection(db, "users"),
          (snapshot) => setTotalUsers(snapshot.size),
          (error) => console.error("Error fetching users:", error),
        ),
      ];

      // Orders already come from the auth context, so the dashboard only needs these sidecar listeners here.
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      clearSubscriptions();
    };
  }, []);

  const orders = useMemo(() => {
    if (!dateFrom && !dateTo) return baseOrders;

    return baseOrders.filter((order) => {
      if (!order.date) return true;
      if (dateFrom && order.date < dateFrom) return false;
      if (dateTo && order.date > dateTo) return false;
      return true;
    });
  }, [baseOrders, dateFrom, dateTo]);

  const daysInRange = useMemo(() => buildDaysInRange(dateFrom, dateTo), [dateFrom, dateTo]);
  const stats = useMemo(
    () => buildDashboardStats({ activeTab, allManagers, daysInRange, orders }),
    [activeTab, allManagers, daysInRange, orders],
  );
  const clients = useMemo(() => allManagers.filter((manager) => manager.role !== "admin"), [allManagers]);
  const managers = useMemo(() => allManagers, [allManagers]);

  const handleUpsertManager = useCallback(async (manager) => {
    try {
      const uid = String(manager?.uid || "").trim();
      if (!uid) throw new Error("Manager UID is required.");

      const payload = cleanObject({ ...manager });
      delete payload.uid;
      await setDoc(doc(db, "b2b_managers", uid), payload, { merge: true });
    } catch (error) {
      console.error("Failed to save manager profile", error);
      throw error;
    }
  }, []);

  const handleDeleteManager = useCallback(async (uid) => {
    if (!uid) return;
    if (!window.confirm("Delete this client profile from Firestore? This does NOT delete the Firebase Auth user.")) return;

    try {
      await deleteDoc(doc(db, "b2b_managers", String(uid)));
    } catch (error) {
      console.error("Failed to delete manager profile", error);
      throw error;
    }
  }, []);

  const handleAddOrder = useCallback(async (order) => {
    try {
      let targetCollection = "b2b_admin_edits";
      
      if (order.category === ORDER_CATEGORIES.STUDENT_LAUNDRY || order.category === "STUDENT_LAUNDRY") {
        targetCollection = "hostels_orders";
      } else if (
        order.category === ORDER_CATEGORIES.LINEN ||
        order.category === ORDER_CATEGORIES.AIRBNB ||
        order.category === "LINEN" ||
        order.category === "AIRBNB"
      ) {
        targetCollection = "b2b_orders";
      }

      await setDoc(doc(db, targetCollection, order.id), cleanObject(order), { merge: true });
    } catch (error) {
      console.error("Failed to add order", error);
    }
  }, []);

  const handleEditOrder = useCallback(async (updatedOrder) => {
    try {
      if (!updatedOrder.id) throw new Error("Order ID missing");
      const id = String(updatedOrder.id);

      // Route writes back to the original source collection so the customer app
      // and all other dashboard views see the updated status immediately.
      let targetCollection;
      if (updatedOrder.source === "hostels") {
        targetCollection = "hostels_orders";
      } else if (updatedOrder.source === "cartdetails") {
        targetCollection = "cartdetails";
      } else if (updatedOrder.source === "website") {
        targetCollection = "orders";
      } else if (updatedOrder.source === "b2b") {
        targetCollection = "b2b_orders";
      } else if (updatedOrder.source === "admin") {
        targetCollection = "b2b_admin_edits";
      } else {
        const isB2B =
          updatedOrder.category === ORDER_CATEGORIES.STUDENT_LAUNDRY ||
          updatedOrder.category === ORDER_CATEGORIES.LINEN ||
          updatedOrder.category === ORDER_CATEGORIES.AIRBNB;
        targetCollection = isB2B ? "b2b_orders" : "b2b_admin_edits";
      }

      await setDoc(doc(db, targetCollection, id), cleanObject(updatedOrder), { merge: true });
    } catch (error) {
      console.error("Failed to edit order", error);
    }
  }, []);

  const handleAddIssue = useCallback(async (issue) => {
    try {
      await setDoc(doc(db, "b2b_admin_edits", issue.id), cleanObject(issue));
    } catch (error) {
      console.error("Failed to add issue", error);
    }
  }, []);

  const handleEditIssue = useCallback(async (updatedIssue) => {
    try {
      if (!updatedIssue.id) throw new Error("Issue ID missing");

      // 1. Always save the full edit to b2b_admin_edits (admin override layer)
      await setDoc(doc(db, "b2b_admin_edits", String(updatedIssue.id)), cleanObject(updatedIssue));

      // 2. If this issue came from the 'complaint' collection (or exists in it),
      //    write the status back to 'closed', 'checking', or 'open'.
      try {
        const complaintRef = doc(db, "complaint", String(updatedIssue.id));
        const firestoreStatus =
          updatedIssue.resolveStatus === "Resolved" ? "closed" :
          updatedIssue.resolveStatus === "Checking" ? "checking" : "open";

        await updateDoc(complaintRef, {
          status: firestoreStatus,
          flagged: updatedIssue.severity === "critical",
          updatedAt: serverTimestamp(),
        });
      } catch (complaintErr) {
        // Ignore if document is not in 'complaint' collection
      }
    } catch (error) {
      console.error("Failed to edit issue", error);
    }
  }, []);

  const handleDeleteData = useCallback(async (item) => {
    if (!window.confirm("Are you sure you want to permanently remove this record from Firebase? This action cannot be undone.")) return;

    try {
      if (!item.id) throw new Error("ID missing for delete action");
      const id = String(item.id);
      
      let targetCollection;
      
      // 1. Identify Target Collection
      if (item.source === "hostels") {
        targetCollection = "hostels_orders";
      } else if (item.source === "website") {
        targetCollection = "orders";
      } else if (item.source === "cartdetails") {
        targetCollection = "cartdetails";
      } else if (item.source === "b2b") {
        targetCollection = "b2b_orders";
      } else if (item.source === "admin") {
        targetCollection = "b2b_admin_edits";
      } else {
        const isB2B =
          item.category === ORDER_CATEGORIES.STUDENT_LAUNDRY ||
          item.category === ORDER_CATEGORIES.LINEN ||
          item.category === ORDER_CATEGORIES.AIRBNB;
        
        targetCollection = isB2B ? "b2b_orders" : "b2b_admin_edits";
      }

      // 2. Execute Hard Delete
      await deleteDoc(doc(db, targetCollection, id));
      
      alert("Record physically deleted from Firebase.");
    } catch (error) {
      console.error("Failed to delete record", error);
      alert("Error deleting record. Check your Firestore permissions.");
    }
  }, []);

  return {
    clients,
    daysInRange,
    handleAddIssue,
    handleAddOrder,
    handleDeleteManager,
    handleDeleteData,
    handleEditIssue,
    handleEditOrder,
    handleUpsertManager,
    loading,
    managers,
    orders,
    screenStats,
    searchStats,
    stats,
    totalUsers,
  };
}

export { getMonthStartString, getTodayString };
