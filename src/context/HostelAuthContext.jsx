import { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";
import { signInWithEmailAndPassword, signOut as firebaseSignOut, onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase";
import { getDoc, doc, onSnapshot, collection, setDoc } from "firebase/firestore";
import { ORDER_CATEGORIES, ORDER_TYPES, ORDER_STATUSES } from "../constants/orders";
import { normalizeOrder, normalizePropertyName } from "../utils/orderNormalization";
import { cleanFirestoreData } from "../utils/cleanFirestoreData";

const HostelAuthContext = createContext(null);
const EXTERNAL_ORDER_SOURCES = new Set(["website", "cartdetails"]);

function isVisibleMergedOrder(order) {
  if (order.isDeleted) return false;

  if (!EXTERNAL_ORDER_SOURCES.has(order.source)) return true;

  const isRegularRetailOrder = order.type === ORDER_TYPES.REGULAR || order.category === ORDER_CATEGORIES.B2C_RETAIL;
  if (!isRegularRetailOrder) return true;

  return Number(order.amount) > 0;
}

export function HostelAuthProvider({ children }) {
  const [client, setClient] = useState(() => {
    const saved = sessionStorage.getItem("hostelClient");
    return saved ? JSON.parse(saved) : null;
  });

  const [isAdmin, setIsAdmin] = useState(() => {
    const saved = sessionStorage.getItem("hostelClient");
    if (!saved) return false;
    return JSON.parse(saved).role === "admin";
  });

  const [firestoreEdits, setFirestoreEdits] = useState([]);
  const [b2bOrders, setB2bOrders] = useState([]);
  const [websiteOrders, setWebsiteOrders] = useState([]);
  const [cartOrders, setCartOrders] = useState([]);
  const [hostelsOrders, setHostelsOrders] = useState([]); // NEW
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [profileNeedsSetup, setProfileNeedsSetup] = useState(false);

  useEffect(() => {
    let unsubscribeEdits = () => { };
    let unsubscribeB2bOrders = () => { };
    let unsubscribeWebsiteOrders = () => { };
    let unsubscribeCartDetails = () => { };
    let unsubscribeHostelsOrders = () => { }; // NEW

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      unsubscribeEdits();
      unsubscribeB2bOrders();
      unsubscribeWebsiteOrders();
      unsubscribeCartDetails();
      unsubscribeHostelsOrders(); // NEW

      if (!firebaseUser) {
        setClient(null);
        setIsAdmin(false);
        setFirestoreEdits([]);
        setB2bOrders([]);
        setWebsiteOrders([]);
        setCartOrders([]);
        setHostelsOrders([]); // NEW
        sessionStorage.removeItem("hostelClient");
        setProfileNeedsSetup(false);
        return;
      }

      try {
        let resolvedRole = "client";
        const userDoc = await getDoc(doc(db, "b2b_managers", firebaseUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data() || {};
          resolvedRole = userData.role || "client";

          const rawPartnernames = userData.partnernames || userData.properties || [];
          const partnernames = rawPartnernames.map(name => normalizePropertyName(name));
          const clientData = {
            email: userData.email || firebaseUser.email || "",
            name: userData.name || (userData.email || firebaseUser.email || "Client"),
            ...userData,
            uid: firebaseUser.uid,
            role: resolvedRole,
            partnernames,
            properties: partnernames,
          };

          setClient(clientData);
          setIsAdmin(resolvedRole === "admin");
          sessionStorage.setItem("hostelClient", JSON.stringify(clientData));

          const allowed = (clientData.partnernames || clientData.properties || []).filter(Boolean);
          setProfileNeedsSetup(resolvedRole !== "admin" && allowed.length === 0);
        } else {
          console.warn("User profile not found in b2b_managers collection.");
          setProfileNeedsSetup(true);
        }

        // NOTE: Firestore rules often restrict website/cart collections to admin users.
        // Avoid subscribing for clients to prevent "Missing or insufficient permissions" errors.
        if (resolvedRole !== "admin") {
          setWebsiteOrders([]);
          setCartOrders([]);
        }
      } catch (error) {
        console.error("Auth initialization error:", error.message);
        setProfileNeedsSetup(true);
      }

      let loadedCount = 0;
      const checkAllLoaded = () => {
        loadedCount++;
        if (loadedCount >= 5) setIsDataLoaded(true); // UPDATED to 5
      };

      unsubscribeEdits = onSnapshot(
        collection(db, "b2b_admin_edits"),
        (snapshot) => {
          setFirestoreEdits(snapshot.docs.map((docSnapshot) => normalizeOrder({ id: docSnapshot.id, ...docSnapshot.data() }, "admin")));
          checkAllLoaded();
        },
        (error) => {
          console.error("Orders sync error:", error.message);
          checkAllLoaded();
        },
      );

      unsubscribeB2bOrders = onSnapshot(
        collection(db, "b2b_orders"),
        (snapshot) => {
          setB2bOrders(snapshot.docs.map((docSnapshot) => normalizeOrder({ id: docSnapshot.id, ...docSnapshot.data() }, "b2b")));
          checkAllLoaded();
        },
        (error) => {
          console.error("B2B Orders sync error:", error.message);
          checkAllLoaded();
        },
      );

      // NEW: Hostels Orders
      unsubscribeHostelsOrders = onSnapshot(
        collection(db, "hostels_orders"),
        (snapshot) => {
          setHostelsOrders(snapshot.docs.map((docSnapshot) => normalizeOrder({ id: docSnapshot.id, ...docSnapshot.data() }, "hostels")));
          checkAllLoaded();
        },
        (error) => {
          console.error("Hostels Orders sync error:", error.message);
          checkAllLoaded();
        },
      );

      // Website + Cart orders are often permission-restricted for client accounts.
      // Treebo (and other partners) should use `b2b_orders` for their order feed.
      const sessionClient = (() => {
        const saved = sessionStorage.getItem("hostelClient");
        if (!saved) return null;
        try { return JSON.parse(saved); } catch { return null; }
      })();

      const roleFromSession = sessionClient?.role || null;

      if (roleFromSession === "admin") {
        unsubscribeWebsiteOrders = onSnapshot(
          collection(db, "orders"),
          (snapshot) => {
            setWebsiteOrders(
              snapshot.docs.map((docSnapshot) =>
                normalizeOrder({ id: docSnapshot.id, ...docSnapshot.data() }, "website")
              )
            );
            checkAllLoaded();
          },
          (error) => {
            console.error("Website Orders sync error:", error.message);
            checkAllLoaded();
          },
        );

        unsubscribeCartDetails = onSnapshot(
          collection(db, "cartdetails"),
          (snapshot) => {
            setCartOrders(
              snapshot.docs.map((docSnapshot) =>
                normalizeOrder({ id: docSnapshot.id, ...docSnapshot.data() }, "cartdetails")
              )
            );
            checkAllLoaded();
          },
          (error) => {
            console.error("Cartdetails sync error:", error.message);
            checkAllLoaded();
          },
        );
      } else {
        // Clients don't subscribe to `orders` / `cartdetails` to avoid permission errors.
        setWebsiteOrders([]);
        setCartOrders([]);
        checkAllLoaded();
        checkAllLoaded();
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeEdits();
      unsubscribeB2bOrders();
      unsubscribeWebsiteOrders();
      unsubscribeCartDetails();
      unsubscribeHostelsOrders(); // NEW
    };
  }, []);


  const allOrdersMerged = useMemo(() => {
    // Partition 1: Build a map of "Primary" records (Admin edits & B2B logged orders)
    // In our new architecture:
    // - b2b_admin_edits stores Regular Orders & Issues
    // - b2b_orders stores Hostels & Hotels & Airbnb
    const primaryRecordsMap = new Map();

    // 1. Base Data: Cartdetails
    cartOrders.forEach(order => {
      if (order.status === ORDER_STATUSES.CANCELLED) return;
      primaryRecordsMap.set(order.id, order);
    });

    // 2. Base Data: Website Orders
    websiteOrders.forEach((order) => {
      if (order.status === ORDER_STATUSES.CANCELLED) return;
      const existing = primaryRecordsMap.get(order.id);
      if (existing) {
        primaryRecordsMap.set(order.id, { ...existing, ...order });
      } else {
        primaryRecordsMap.set(order.id, order);
      }
    });

    // 3. Base Data: B2B Orders
    b2bOrders.forEach(order => {
      const existing = primaryRecordsMap.get(order.id);
      if (existing) {
        primaryRecordsMap.set(order.id, { ...existing, ...order });
      } else {
        primaryRecordsMap.set(order.id, order);
      }
    });
    
    // 3.5 Base Data: Hostels Orders (NEW)
    hostelsOrders.forEach(order => {
      const existing = primaryRecordsMap.get(order.id);
      if (existing) {
        primaryRecordsMap.set(order.id, { ...existing, ...order });
      } else {
        primaryRecordsMap.set(order.id, order);
      }
    });

    // 4. Overrides: Admin Edits (Regular/Issues)
    firestoreEdits.forEach(order => {
      const existing = primaryRecordsMap.get(order.id);
      if (existing) {
        const merged = { ...existing, ...order };
        if (!order.deliveryDate && existing.deliveryDate) merged.deliveryDate = existing.deliveryDate;
        if (!order.customerNumber && existing.customerNumber) merged.customerNumber = existing.customerNumber;
        if (!order.channel && existing.channel) merged.channel = existing.channel;
        primaryRecordsMap.set(order.id, merged);
      } else {
        primaryRecordsMap.set(order.id, order);
      }
    });

    const merged = [...primaryRecordsMap.values()];
    return merged.filter(isVisibleMergedOrder);
  }, [cartOrders, b2bOrders, hostelsOrders, firestoreEdits, websiteOrders]);

  const orders = useMemo(() => {
    if (!client) return [];
    if (client.role === "admin") return allOrdersMerged;

    const allowedProperties = client.properties || client.partnernames || [];
    const normalizedAllowed = allowedProperties.map((property) => property.toLowerCase());

    return allOrdersMerged.filter((order) => {
      const propertyName = (order.property || "").toLowerCase();
      const linkedName = (order.linkedHostel || "").toLowerCase();
      const customerName = (order.customerName || "").toLowerCase();
      const serviceName = (order.service || "").toLowerCase();
      const address = (order.address || "").toLowerCase();
      // Check if any of the manager's allowed properties match the order's property (partial match allowed)
      return normalizedAllowed.some((allowed) =>
        propertyName.includes(allowed)
        || linkedName.includes(allowed)
        // For website/cart orders, the "property" can be generic. Matching extra fields lets partners like Treebo see their own orders.
        || (order.source === "website" || order.source === "cartdetails"
          ? (customerName.includes(allowed) || serviceName.includes(allowed) || address.includes(allowed))
          : false)
      );
    });
  }, [allOrdersMerged, client]);

  const addIssue = useCallback(async (newIssue) => {
    try {
      const normalized = normalizeOrder({
        ...newIssue,
        category: ORDER_CATEGORIES.ISSUES,
        type: ORDER_TYPES.ISSUE,
      }, "admin");

      await setDoc(
        doc(db, "b2b_admin_edits", String(newIssue.id)),
        cleanFirestoreData(normalized),
      );
    } catch (error) {
      console.error("Error raising issue to Firestore:", error);
      setFirestoreEdits((current) => [...current.filter((issue) => issue.id !== newIssue.id), normalizeOrder(newIssue, "admin")]);
    }
  }, []);

  const login = useCallback(async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, "b2b_managers", userCredential.user.uid));

      if (!userDoc.exists()) {
        throw new Error("User record not found in b2b_managers collection.");
      }

      const userData = userDoc.data() || {};
      const rawPartnernames = userData.partnernames || userData.properties || [];
      const partnernames = rawPartnernames.map(name => normalizePropertyName(name));
      const clientData = {
        uid: userCredential.user.uid,
        ...userData,
        role: userData.role || "client",
        partnernames,
        properties: partnernames,
      };

      setClient(clientData);
      setIsAdmin(userData.role === "admin");
      sessionStorage.setItem("hostelClient", JSON.stringify(clientData));

      return { success: true, role: userData.role, client: clientData };
    } catch (error) {
      console.error("Login failed:", error);
      return { success: false, error: error.message || "Invalid email or password." };
    }
  }, []);

  const setAuthenticatedUser = useCallback((clientData) => {
    if (!clientData) {
      setClient(null);
      setIsAdmin(false);
      sessionStorage.removeItem("hostelClient");
      return;
    }
    const rawPartnernames = clientData.partnernames || clientData.properties || [];
    const partnernames = rawPartnernames.map(name => normalizePropertyName(name));
    const normalizedClient = {
      ...clientData,
      partnernames,
      properties: partnernames,
    };
    setClient(normalizedClient);
    setIsAdmin(normalizedClient.role === "admin");
    sessionStorage.setItem("hostelClient", JSON.stringify(normalizedClient));
  }, []);

  const logout = useCallback(async () => {
    setClient(null);
    setIsAdmin(false);
    sessionStorage.removeItem("hostelClient");
    try {
      await firebaseSignOut(auth);
    } catch (_) {
      // ignore
    }
  }, []);

  return (
    <HostelAuthContext.Provider value={{ client, orders, isAdmin, profileNeedsSetup, login, logout, setAuthenticatedUser, addIssue, isDataLoaded }}>
      {children}
    </HostelAuthContext.Provider>
  );
}

export function useHostelAuth() {
  const ctx = useContext(HostelAuthContext);
  if (!ctx) throw new Error("useHostelAuth must be inside HostelAuthProvider");
  return ctx;
}
