import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";
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
  let totalRevenue = 0, totalOrders = 0, totalKg = 0;
  let hostelRevenue = 0, retailRevenue = 0, hotelRevenue = 0;
  let b2cPickups = 0, b2cDeliveries = 0, b2cKg = 0;
  let b2bPickups = 0, b2bDeliveries = 0, b2bKg = 0;
  let openIssuesCount = 0;
  
  const clientSet = new Set();
  const b2cServicesKg = {};
  
  const trendsByDate = {};
  daysInRange.forEach(d => trendsByDate[d] = { sparkVal: 0, issues: 0 });

  orders.forEach(order => {
    if (order.category === "ISSUES") {
      if (order.resolveStatus !== "Resolved") openIssuesCount++;
      if (trendsByDate[order.date]) trendsByDate[order.date].issues += (order.amount || order.weight || 1);
      return;
    }
    
    if (order.status === "Cancelled" || order.status === "Abandoned" || order.type === "abandoned") return;

    const amt = order.amount || 0;
    const wt = order.weight || 0;
    const isHotel = isHotelOrder(order);
    const hasHotelData = hasMeaningfulHotelData(order);
    const s = String(order.status || "").toLowerCase();

    // Breakdowns
    if (order.type === "student" || order.type === "linen") hostelRevenue += amt;
    if (order.type === "regular") retailRevenue += amt;
    if (isHotel && hasHotelData) hotelRevenue += amt;

    // Focus Filtering (Active Tab)
    let inFocus = true;
    if (activeTab === "regular") inFocus = order.type === "regular";
    else if (activeTab === "hostels") inFocus = (order.type === "student" || order.type === "linen");
    else if (activeTab === "hotels") inFocus = (isHotel && hasHotelData);

    if (inFocus) {
      totalRevenue += amt;
      totalOrders++;
      totalKg += wt;
      
      if (activeTab === "regular" && order.customerName && !order.id.includes("adj")) {
        clientSet.add(order.customerName);
      } else if ((activeTab === "hostels" || activeTab === "hotels") && order.property) {
        clientSet.add(order.property);
      }
      
      if (trendsByDate[order.date]) trendsByDate[order.date].sparkVal += (amt || wt || 1);
    }

    // B2C vs B2B Metrics
    const isB2C = (order.type === "regular" || order.source === "cartdetails" || order.source === "website") && order.type !== "rider_tracking";
    const isB2B = (order.type === "student" || order.type === "linen" || order.type === "airbnb" || order.source === "b2b" || order.source === "hostels");
    
    if (isB2C) {
      b2cKg += wt;
      if (["processing", "delivered", "completed", "picked up", "pickup done", "confirmed", "pending"].includes(s)) b2cPickups++;
      if (["delivered", "completed"].includes(s)) b2cDeliveries++;
      
      const bd = order.serviceBreakdown;
      if (bd && Array.isArray(bd) && bd.length > 0) {
        bd.forEach(item => {
          const name = item.name || "Other";
          if (!b2cServicesKg[name]) b2cServicesKg[name] = { weight: 0, quantity: 0 };
          b2cServicesKg[name].weight += (Number(item.weight) || 0);
          b2cServicesKg[name].quantity += (Number(item.quantity) || 0);
        });
      } else {
        const name = order.service || "Other";
        if (!b2cServicesKg[name]) b2cServicesKg[name] = { weight: 0, quantity: 0 };
        b2cServicesKg[name].weight += wt;
        b2cServicesKg[name].quantity += (Number(order.items) || 0);
      }
    }
    
    if (isB2B) {
      b2bKg += wt;
      b2bPickups++;
      if (["delivered", "completed"].includes(s)) b2bDeliveries++;
    }
  });

  const totalClients = ["regular", "hostels", "hotels"].includes(activeTab) ? clientSet.size : allManagers.length;
  const sparklines = {
    revenue: daysInRange.map(d => ({ v: trendsByDate[d].sparkVal })),
    orders: daysInRange.map(d => ({ v: trendsByDate[d].sparkVal })),
    kg: daysInRange.map(d => ({ v: trendsByDate[d].sparkVal })),
    clients: daysInRange.map((_, index) => ({ v: 10 + Math.sin(index) * 2 })),
    issues: daysInRange.map(d => ({ v: trendsByDate[d].issues }))
  };

  return {
    totalRevenue, totalOrders, totalKg, totalClients, openIssuesCount,
    breakdown: { hostelRevenue, retailRevenue, hotelRevenue },
    b2cPickups, b2cDeliveries, b2bPickups, b2bDeliveries,
    b2cKg, b2bKg, b2cServicesKg, sparklines
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

  const SOURCE_COLLECTION_MAP = {
    hostels: "hostels_orders",
    cartdetails: "cartdetails",
    website: "orders",
    b2b: "b2b_orders",
    admin: "b2b_admin_edits",
    complaint: "complaint",
    normal_complaint: "normal_complaint"
  };

  const getTargetCollection = (item) => {
    if (item.source && SOURCE_COLLECTION_MAP[item.source]) {
      return SOURCE_COLLECTION_MAP[item.source];
    }
    const isB2B =
      item.category === ORDER_CATEGORIES.STUDENT_LAUNDRY ||
      item.category === ORDER_CATEGORIES.LINEN ||
      item.category === ORDER_CATEGORIES.AIRBNB ||
      item.category === "STUDENT_LAUNDRY" ||
      item.category === "LINEN" ||
      item.category === "AIRBNB";
    return isB2B ? "b2b_orders" : "b2b_admin_edits";
  };

  const handleEditOrder = useCallback(async (updatedOrder) => {
    try {
      if (!updatedOrder.id) throw new Error("Order ID missing");
      const id = String(updatedOrder.id);
      const targetCollection = getTargetCollection(updatedOrder);

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

      const batch = writeBatch(db);

      // 1. Always save the full edit to b2b_admin_edits (admin override layer)
      const editRef = doc(db, "b2b_admin_edits", String(updatedIssue.id));
      batch.set(editRef, cleanObject(updatedIssue));

      // 2. Write status back to original source collection if applicable
      const source = updatedIssue.source;
      if (source === "complaint" || source === "normal_complaint") {
        const complaintRef = doc(db, source, String(updatedIssue.id));
        const firestoreStatus =
          updatedIssue.resolveStatus === "Resolved" ? "closed" :
          updatedIssue.resolveStatus === "Checking" ? "checking" : "open";

        batch.set(complaintRef, {
          status: firestoreStatus,
          flagged: updatedIssue.severity === "critical",
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }

      await batch.commit();
    } catch (error) {
      console.error("Failed to edit issue", error);
    }
  }, []);

  const handleDeleteData = useCallback(async (item) => {
    if (!window.confirm("Are you sure you want to permanently remove this record from Firebase? This action cannot be undone.")) return;

    try {
      if (!item.id) throw new Error("ID missing for delete action");
      const id = String(item.id);
      const targetCollection = getTargetCollection(item);

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
