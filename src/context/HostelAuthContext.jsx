import { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";
import { signInWithEmailAndPassword, signOut as firebaseSignOut, onAuthStateChanged, setPersistence, browserSessionPersistence } from "firebase/auth";
import { auth, db } from "../firebase";
import { getDoc, doc, onSnapshot, collection, setDoc, query, where, or, limit, orderBy } from "firebase/firestore";
import { ORDER_CATEGORIES, ORDER_TYPES, ORDER_STATUSES } from "../constants/orders";
import { normalizeOrder, normalizePropertyName, CANONICAL_PROPERTY_NAMES } from "../utils/orderNormalization";
import { cleanFirestoreData } from "../utils/cleanFirestoreData";
import { isHostel99Client, calculateBatchRevenue } from "../config/orderRateCard";
import { B2C_OCTOBER_2026_ORDERS } from "../data/b2cVerifiedLedger";

const HostelAuthContext = createContext(null);
const EXTERNAL_ORDER_SOURCES = new Set(["website", "cartdetails"]);

function isVisibleMergedOrder(order) {
  if (order.isDeleted) return false;

  if (!EXTERNAL_ORDER_SOURCES.has(order.source)) return true;

  const isRegularRetailOrder = order.type === ORDER_TYPES.REGULAR || order.category === ORDER_CATEGORIES.B2C_RETAIL;
  if (!isRegularRetailOrder) return true;

  return true;
}

export function HostelAuthProvider({ children }) {
  const [client, setClient] = useState(() => {
    const saved = sessionStorage.getItem("hostelClient");
    return saved ? JSON.parse(saved) : null;
  });

  const [isAdmin, setIsAdmin] = useState(() => {
    const saved = sessionStorage.getItem("hostelClient");
    if (!saved) return false;
    const role = JSON.parse(saved).role;
    return role === "admin" || role === "admin_viewer";
  });

  const [firestoreEdits, setFirestoreEdits] = useState([]);
  const [b2bOrders, setB2bOrders] = useState([]);
  const [websiteOrders, setWebsiteOrders] = useState([]);
  const [cartOrders, setCartOrders] = useState([]);
  const [hostelsOrders, setHostelsOrders] = useState([]); // NEW
  const [appComplaints, setAppComplaints] = useState([]);
  const [hostelComplaints, setHostelComplaints] = useState([]); // hostel form complaints
  const [managerIssues, setManagerIssues] = useState([]); // manager reported issues (B2B & B2C)
  const [managerB2bEntries, setManagerB2bEntries] = useState([]); // factory & store manager B2B batches
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [profileNeedsSetup, setProfileNeedsSetup] = useState(false);
  // Who is signed in, once resolved: { uid, role, allowedProperties }.
  const [session, setSession] = useState(null);
  const [authResolved, setAuthResolved] = useState(false);
  // Order listeners are heavy (every order ever), so they only start once a
  // page that shows orders asks for them via useHostelOrders().
  const [ordersRequested, setOrdersRequested] = useState(false);
  const requestOrders = useCallback(() => setOrdersRequested(true), []);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {

      if (!firebaseUser) {
        setClient(null);
        setIsAdmin(false);
        setFirestoreEdits([]);
        setB2bOrders([]);
        setWebsiteOrders([]);
        setCartOrders([]);
        setHostelsOrders([]);
        setAppComplaints([]);
        setHostelComplaints([]);
        setManagerIssues([]);
        setManagerB2bEntries([]);
        sessionStorage.removeItem("hostelClient");
        setProfileNeedsSetup(false);
        setIsDataLoaded(true);
        setSession(null);
        setAuthResolved(true);
        return;
      }

      let resolvedRole = "client";
      let allowedProperties = [];

      try {
        const userDoc = await getDoc(doc(db, "b2b_managers", firebaseUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data() || {};
          resolvedRole = userData.role || "client";

          const rawPartnernames = userData.partnernames || userData.properties || [];
          allowedProperties = rawPartnernames.map(name => normalizePropertyName(name));
          
          const clientData = {
            email: userData.email || firebaseUser.email || "",
            name: userData.name || (userData.email || firebaseUser.email || "Client"),
            ...userData,
            uid: firebaseUser.uid,
            role: resolvedRole,
            partnernames: allowedProperties,
            properties: allowedProperties,
          };

          setClient(clientData);
          setIsAdmin(resolvedRole === "admin" || resolvedRole === "admin_viewer");
          sessionStorage.setItem("hostelClient", JSON.stringify(clientData));

          const allowed = allowedProperties.filter(Boolean);
          setProfileNeedsSetup(resolvedRole !== "admin" && resolvedRole !== "admin_viewer" && allowed.length === 0);
        } else {
          console.warn("User profile not found in b2b_managers collection.");
          setProfileNeedsSetup(true);
        }

        if (resolvedRole !== "admin" && resolvedRole !== "admin_viewer") {
          setWebsiteOrders([]);
          setCartOrders([]);
        }
      } catch (error) {
        console.error("Auth initialization error:", error.message);
        setProfileNeedsSetup(true);
      }

      setIsDataLoaded(false);
      setSession({ uid: firebaseUser.uid, role: resolvedRole, allowedProperties });
      setAuthResolved(true);
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!session || !ordersRequested) return undefined;
    const { role: resolvedRole, allowedProperties } = session;
    const activeSubscriptions = [];

      let loadedCount = 0;
      const checkAllLoaded = () => {
        loadedCount++;
        if (loadedCount >= 7) setIsDataLoaded(true);
      };

      const getAllAliases = (canonicalNames) => {
        const aliases = new Set();
        
        canonicalNames.forEach(name => {
          if (!name) return;
          aliases.add(name);
          aliases.add(name.toLowerCase());
          aliases.add(name.toUpperCase());
          
          Object.entries(CANONICAL_PROPERTY_NAMES).forEach(([key, val]) => {
            if (val === name || val.toLowerCase() === name.toLowerCase()) {
              aliases.add(key);
              aliases.add(key.toLowerCase());
              aliases.add(key.toUpperCase());
              
              const words = key.split(' ');
              const titleCase = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
              aliases.add(titleCase);
              aliases.add(key.charAt(0).toUpperCase() + key.slice(1).toLowerCase());
            }
          });
        });
        
        return Array.from(aliases);
      };

      const setupCollectionListener = (collectionName, normalizeType, setOrdersFn) => {
        if (resolvedRole === "admin" || resolvedRole === "admin_viewer") {
          let q = query(collection(db, collectionName), limit(5000));

          const unsub = onSnapshot(
            q,
            (snapshot) => {
              setOrdersFn(prev => {
                // For the very first load, prev might be empty, but we can still use Map
                const nextMap = new Map(prev.map(o => [o.id, o]));
                snapshot.docChanges().forEach(change => {
                  if (change.type === "removed") {
                    nextMap.delete(change.doc.id);
                  } else {
                    nextMap.set(change.doc.id, normalizeOrder({ id: change.doc.id, ...change.doc.data() }, normalizeType));
                  }
                });
                return Array.from(nextMap.values());
              });
              checkAllLoaded();
            },
            (error) => {
              console.error(`${collectionName} sync error:`, error.message);
              checkAllLoaded();
            }
          );
          activeSubscriptions.push(unsub);
        } else {
          const allowed = allowedProperties.filter(Boolean);
          if (allowed.length === 0) {
            setOrdersFn([]);
            checkAllLoaded();
            return;
          }

          const allPossibleStrings = getAllAliases(allowed);

          const chunks = [];
          for (let i = 0; i < allPossibleStrings.length; i += 5) {
            chunks.push(allPossibleStrings.slice(i, i + 5));
          }

          let fieldsToCheck = ["property", "linkedHostel"];
          if (collectionName === "hostels_orders") {
            fieldsToCheck = ["property", "hostelName", "hostel", "location"];
          } else if (collectionName === "b2b_orders") {
            fieldsToCheck = ["property", "hostel", "partnerName", "partnername"];
          } else if (collectionName === "managerB2bEntries") {
            fieldsToCheck = ["client", "property", "partnerName"];
          }

          const chunksData = new Map();
          let initializedChunks = 0;

          chunks.forEach((chunk, index) => {
            const orConditions = fieldsToCheck.map(field => where(field, "in", chunk));
            const q = query(collection(db, collectionName), or(...orConditions));

            const unsub = onSnapshot(
              q,
              (snapshot) => {
                // Update chunk data
                const currentChunkArr = chunksData.get(index) || [];
                const chunkMap = new Map(currentChunkArr.map(o => [o.id, o]));
                
                snapshot.docChanges().forEach(change => {
                  if (change.type === "removed") {
                    chunkMap.delete(change.doc.id);
                  } else {
                    chunkMap.set(change.doc.id, normalizeOrder({ id: change.doc.id, ...change.doc.data() }, normalizeType));
                  }
                });
                
                chunksData.set(index, Array.from(chunkMap.values()));

                // Merge all chunks back into the main state
                const merged = [];
                chunksData.forEach(list => merged.push(...list));
                setOrdersFn(merged);

                if (initializedChunks < chunks.length) {
                  initializedChunks++;
                  if (initializedChunks === chunks.length) {
                    checkAllLoaded();
                  }
                }
              },
              (error) => {
                console.error(`${collectionName} chunk sync error:`, error.message);
                if (initializedChunks < chunks.length) {
                  initializedChunks++;
                  if (initializedChunks === chunks.length) {
                    checkAllLoaded();
                  }
                }
              }
            );
            activeSubscriptions.push(unsub);
          });
        }
      };

      setupCollectionListener("b2b_admin_edits", "admin", setFirestoreEdits);
      setupCollectionListener("hostels_orders", "hostels", setHostelsOrders);
      setupCollectionListener("b2b_orders", "b2b", setB2bOrders);
      setupCollectionListener("managerB2bEntries", "manager_b2b", setManagerB2bEntries);
      setupCollectionListener("normal_complaint", "complaint", setAppComplaints);
      setupCollectionListener("complaint", "complaint", setHostelComplaints);
      setupCollectionListener("manager_issues", "manager_issues", setManagerIssues);

      if (resolvedRole === "admin" || resolvedRole === "admin_viewer") {
        setWebsiteOrders([]);
        
        const unsubCart = onSnapshot(
          collection(db, "cartdetails"),
          (snapshot) => {
            setCartOrders(snapshot.docs.map((docSnapshot) => normalizeOrder({ id: docSnapshot.id, ...docSnapshot.data() }, "cartdetails")));
            checkAllLoaded();
          },
          (error) => {
            console.error("Cartdetails sync error:", error.message);
            checkAllLoaded();
          }
        );
        activeSubscriptions.push(unsubCart);
      } else {
        checkAllLoaded();
      }

    return () => activeSubscriptions.forEach((unsub) => unsub());
  }, [session, ordersRequested]);


  const allOrdersMerged = useMemo(() => {
    const primaryRecordsMap = new Map();
    const aliasMap = new Map(); // maps orderId / globalOrderNumber / alternate id -> primary id

    const STATUS_PRIORITY = {
      Delivered: 5,
      Completed: 5,
      "Pickup Done": 4,
      Processing: 3,
      Confirmed: 2,
      Pending: 1,
      Tracking: 0,
      Abandoned: -1,
      Cancelled: -2,
    };

    const smartMergeOrders = (existing, order) => {
      const merged = { ...existing };
      
      for (const [key, val] of Object.entries(order)) {
        if (val === undefined || val === null || val === "" || Number.isNaN(val)) continue;
        if (Array.isArray(val) && val.length === 0) continue;
        
        if (key === "service" && ["Web Store Order", "Regular Service", "Order"].includes(val) && existing.service) continue;
        if (key === "customerName" && ["Website Customer", "Regular Customer"].includes(val) && existing.customerName) continue;
        
        if ((key === "amount" || key === "weight" || key === "items") && val === 0 && (existing[key] > 0)) continue;

        // Preserve higher operational status unless explicitly cancelled
        if (key === "status") {
          const oldPrio = STATUS_PRIORITY[existing.status] ?? 0;
          const newPrio = STATUS_PRIORITY[val] ?? 0;
          if (val === "Cancelled" || existing.status === "Cancelled") {
            merged.status = "Cancelled";
            continue;
          }
          if (newPrio < oldPrio && oldPrio > 0) {
            continue; // keep higher existing status
          }
        }

        merged[key] = val;
      }
      
      return merged;
    };

    const findExistingKey = (order) => {
      if (primaryRecordsMap.has(order.id)) return order.id;
      if (order.canonicalOrderId && aliasMap.has(order.canonicalOrderId)) return aliasMap.get(order.canonicalOrderId);
      if (order.globalOrderNumber && aliasMap.has(String(order.globalOrderNumber))) return aliasMap.get(String(order.globalOrderNumber));
      if (order.orderId && aliasMap.has(String(order.orderId))) return aliasMap.get(String(order.orderId));
      if (order.orderNumber && aliasMap.has(String(order.orderNumber))) return aliasMap.get(String(order.orderNumber));
      if (aliasMap.has(order.id)) return aliasMap.get(order.id);
      return null;
    };

    const registerAliases = (primaryId, order) => {
      aliasMap.set(primaryId, primaryId);
      if (order.id) aliasMap.set(String(order.id), primaryId);
      if (order.canonicalOrderId) aliasMap.set(String(order.canonicalOrderId), primaryId);
      if (order.globalOrderNumber) aliasMap.set(String(order.globalOrderNumber), primaryId);
      if (order.orderId) aliasMap.set(String(order.orderId), primaryId);
      if (order.orderNumber) aliasMap.set(String(order.orderNumber), primaryId);
    };

    // 1. Process cartOrders (B2C)
    // Map to detect duplicate cart submission retries from mobile app
    const b2cUserSlotFingerprints = new Map();

    // Seed authoritative verified October 2026 audit orders (1–18 Oct)
    const octVerifiedIdSet = new Set(B2C_OCTOBER_2026_ORDERS.map((o) => o.id));
    B2C_OCTOBER_2026_ORDERS.forEach((order) => {
      primaryRecordsMap.set(order.id, order);
      registerAliases(order.id, order);
      const phone = String(order.customerNumber || "").replace(/\D/g, "").slice(-10);
      const day = order.date || order.pickupDate;
      if (phone.length === 10 && day) {
        b2cUserSlotFingerprints.set(`${phone}_${day}`, order.id);
      }
    });

    cartOrders.forEach(order => {
      if (order.type === "rider_tracking" || order.isB2bRoomSync) return;

      const orderDay = order.date || order.pickupDate;
      // For Oct 1-18 2026 audit window, preserve the verified audit records as authoritative
      if (orderDay >= "2026-10-01" && orderDay <= "2026-10-18") {
        if (octVerifiedIdSet.has(order.id)) return;
        const phone = String(order.customerNumber || "").replace(/\D/g, "").slice(-10);
        if (phone.length === 10 && b2cUserSlotFingerprints.has(`${phone}_${orderDay}`)) {
          return;
        }
      }

      const existingKey = findExistingKey(order);
      if (existingKey) {
        if (octVerifiedIdSet.has(existingKey)) return;
        primaryRecordsMap.set(existingKey, smartMergeOrders(primaryRecordsMap.get(existingKey), order));
        registerAliases(existingKey, order);
        return;
      }

      // Check semantic fingerprint for B2C orders: same phone + same pickup day + similar amount or slot
      const phone = String(order.customerNumber || "").replace(/\D/g, "").slice(-10);
      const day = order.date || order.pickupDate;
      const isRegular = order.type === ORDER_TYPES.REGULAR || order.category === ORDER_CATEGORIES.B2C_RETAIL;

      if (isRegular && phone.length === 10 && day) {
        const fp = `${phone}_${day}`;
        if (b2cUserSlotFingerprints.has(fp)) {
          const matchedPrimaryId = b2cUserSlotFingerprints.get(fp);
          if (octVerifiedIdSet.has(matchedPrimaryId)) return;
          const matchedOrder = primaryRecordsMap.get(matchedPrimaryId);
          if (matchedOrder) {
            primaryRecordsMap.set(matchedPrimaryId, smartMergeOrders(matchedOrder, order));
            registerAliases(matchedPrimaryId, order);
            return;
          }
        } else {
          b2cUserSlotFingerprints.set(fp, order.id);
        }
      }

      primaryRecordsMap.set(order.id, order);
      registerAliases(order.id, order);
    });

    // 2. Website Store Orders
    websiteOrders.forEach((order) => {
      const existingKey = findExistingKey(order);
      if (existingKey) {
        primaryRecordsMap.set(existingKey, smartMergeOrders(primaryRecordsMap.get(existingKey), order));
        registerAliases(existingKey, order);
      } else {
        primaryRecordsMap.set(order.id, order);
        registerAliases(order.id, order);
      }
    });

    // 3. Complaints & Issues
    appComplaints.forEach((issue) => {
      const orderKey = issue.orderId ? findExistingKey({ id: issue.orderId, orderId: issue.orderId }) : null;
      if (orderKey) {
        const existing = primaryRecordsMap.get(orderKey);
        primaryRecordsMap.set(orderKey, { ...existing, hasIssue: true, issueDetails: issue });
      } else {
        primaryRecordsMap.set(issue.id, { ...issue, category: ORDER_CATEGORIES.ISSUES, type: ORDER_TYPES.ISSUE });
        registerAliases(issue.id, issue);
      }
    });

    hostelComplaints.forEach((issue) => {
      const orderKey = issue.orderId ? findExistingKey({ id: issue.orderId, orderId: issue.orderId }) : null;
      if (orderKey) {
        const existing = primaryRecordsMap.get(orderKey);
        primaryRecordsMap.set(orderKey, { ...existing, hasIssue: true, issueDetails: issue });
      } else {
        primaryRecordsMap.set(issue.id, { ...issue, category: ORDER_CATEGORIES.ISSUES, type: ORDER_TYPES.ISSUE });
        registerAliases(issue.id, issue);
      }
    });

    managerIssues.forEach((issue) => {
      const orderKey = issue.orderId ? findExistingKey({ id: issue.orderId, orderId: issue.orderId }) : null;
      if (orderKey) {
        const existing = primaryRecordsMap.get(orderKey);
        primaryRecordsMap.set(orderKey, { ...existing, hasIssue: true, issueDetails: issue });
      } else {
        primaryRecordsMap.set(issue.id, { ...issue, category: ORDER_CATEGORIES.ISSUES, type: ORDER_TYPES.ISSUE });
        registerAliases(issue.id, issue);
      }
    });

    // 4. Base Data: B2B Orders
    b2bOrders.forEach(order => {
      const existingKey = findExistingKey(order);
      if (existingKey) {
        primaryRecordsMap.set(existingKey, smartMergeOrders(primaryRecordsMap.get(existingKey), order));
        registerAliases(existingKey, order);
      } else {
        primaryRecordsMap.set(order.id, order);
        registerAliases(order.id, order);
      }
    });
    
    // 5. Hostels Orders
    hostelsOrders.forEach(order => {
      const existingKey = findExistingKey(order);
      if (existingKey) {
        primaryRecordsMap.set(existingKey, smartMergeOrders(primaryRecordsMap.get(existingKey), order));
        registerAliases(existingKey, order);
      } else {
        primaryRecordsMap.set(order.id, order);
        registerAliases(order.id, order);
      }
    });

    // 6. Overrides: Admin Edits
    firestoreEdits.forEach(order => {
      const existingKey = findExistingKey(order);
      if (existingKey) {
        primaryRecordsMap.set(existingKey, smartMergeOrders(primaryRecordsMap.get(existingKey), order));
        registerAliases(existingKey, order);
      } else {
        primaryRecordsMap.set(order.id, order);
        registerAliases(order.id, order);
      }
    });

    // 7. Factory & Store Manager B2B Entries (One 8, Zolo stays, Hostel 99)
    const h99CountsByDate = {};
    managerB2bEntries.forEach((entry) => {
      if (isHostel99Client(entry.client) && entry.status !== "Cancelled" && entry.rawStatus !== "cancelled") {
        const d = entry.date || "unknown";
        h99CountsByDate[d] = (h99CountsByDate[d] || 0) + 1;
      }
    });

    managerB2bEntries.forEach((entry) => {
      const isH99 = isHostel99Client(entry.client);
      const countOnDate = isH99 ? (h99CountsByDate[entry.date] || 1) : 1;
      const rev = calculateBatchRevenue(entry, countOnDate);
      const normalizedEntry = {
        ...entry,
        calculatedRevenue: rev,
        amount: rev,
        h99BatchesOnDate: countOnDate,
      };

      const existingKey = findExistingKey(normalizedEntry);
      if (existingKey) {
        primaryRecordsMap.set(existingKey, smartMergeOrders(primaryRecordsMap.get(existingKey), normalizedEntry));
        registerAliases(existingKey, normalizedEntry);
      } else {
        primaryRecordsMap.set(normalizedEntry.id, normalizedEntry);
        registerAliases(normalizedEntry.id, normalizedEntry);
      }
    });

    const merged = [...primaryRecordsMap.values()];
    return merged.filter(isVisibleMergedOrder);
  }, [cartOrders, b2bOrders, hostelsOrders, firestoreEdits, websiteOrders, appComplaints, hostelComplaints, managerIssues, managerB2bEntries]);

  const orders = useMemo(() => {
    if (!client) return [];
    if (client.role === "admin" || client.role === "admin_viewer") return allOrdersMerged;

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

  const verifyOrder = useCallback(async (orderId, source) => {
    try {
      let collectionName = "b2b_orders";
      if (source === "admin") collectionName = "b2b_admin_edits";
      else if (source === "b2b") collectionName = "b2b_orders";
      else if (source === "hostels") collectionName = "hostels_orders";
      else if (source === "website") collectionName = "orders";
      else if (source === "cartdetails") collectionName = "cartdetails";

      const docRef = doc(db, collectionName, String(orderId));
      await setDoc(docRef, { verifiedByClient: true }, { merge: true });
      console.log(`Order ${orderId} successfully verified in ${collectionName}.`);
    } catch (error) {
      console.warn(`Could not write verification to source collection (${source}), trying b2b_admin_edits fallback:`, error.message);
      try {
        const fallbackRef = doc(db, "b2b_admin_edits", String(orderId));
        await setDoc(fallbackRef, { verifiedByClient: true }, { merge: true });
        console.log(`Order ${orderId} successfully verified in b2b_admin_edits fallback.`);
      } catch (fallbackError) {
        console.error("Fallback verification also failed:", fallbackError);
        throw fallbackError;
      }
    }
  }, []);

  const login = useCallback(async (email, password) => {
    try {
      await setPersistence(auth, browserSessionPersistence);
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
      setIsAdmin(userData.role === "admin" || userData.role === "admin_viewer");
      sessionStorage.setItem("hostelClient", JSON.stringify(clientData));

      return { success: true, role: userData.role, client: clientData };
    } catch (error) {
      console.error("Login failed:", error);
      let message = "Invalid email or password. Please check your credentials.";
      const code = error.code || "";
      if (code === "auth/user-not-found" || code === "auth/wrong-password" || code === "auth/invalid-credential" || code === "auth/invalid-email") {
        message = "Invalid email or password. Please check your credentials.";
      } else if (code === "auth/too-many-requests") {
        message = "Too many failed login attempts. Please try again later.";
      } else if (code === "auth/user-disabled") {
        message = "This account has been disabled. Please contact support.";
      } else if (code === "auth/network-request-failed") {
        message = "Network error. Please check your internet connection and try again.";
      } else if (error.message === "User record not found in b2b_managers collection.") {
        message = "Your account is not authorized for portal access. Please contact administrator.";
      }
      return { success: false, error: message };
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
    setIsAdmin(normalizedClient.role === "admin" || normalizedClient.role === "admin_viewer");
    sessionStorage.setItem("hostelClient", JSON.stringify(normalizedClient));
  }, []);

  const logout = useCallback(async () => {
    setClient(null);
    setIsAdmin(false);
    sessionStorage.removeItem("hostelClient");
    sessionStorage.removeItem("andes_unlocked");
    try {
      await firebaseSignOut(auth);
    } catch (_) {
      // ignore
    }
  }, []);

  const verifyAllOrders = useCallback(async (ordersToVerify) => {
    const unverified = ordersToVerify.filter(o => !o.verifiedByClient);
    if(unverified.length === 0) return;
    
    await Promise.all(unverified.map(o => verifyOrder(o.id, o.source)));
  }, [verifyOrder]);

  return (
    <HostelAuthContext.Provider value={{ client, orders, isAdmin, profileNeedsSetup, login, logout, setAuthenticatedUser, addIssue, verifyOrder, verifyAllOrders, isDataLoaded, authResolved, requestOrders, isViewer: client?.role === "admin_viewer" }}>
      {children}
    </HostelAuthContext.Provider>
  );
}

/**
 * Like useHostelAuth(), for pages that show orders: starts the order
 * listeners (once per session) so `orders` and `isDataLoaded` fill in.
 */
export function useHostelOrders() {
  const ctx = useHostelAuth();
  const { requestOrders } = ctx;
  useEffect(() => { requestOrders?.(); }, [requestOrders]);
  return ctx;
}

export function useHostelAuth() {
  const ctx = useContext(HostelAuthContext);
  if (!ctx) {
    // During Vite HMR, the context can momentarily be null while the module
    // graph re-mounts. Throw only in production to avoid false-positive crashes.
    if (import.meta.env.PROD) {
      throw new Error("useHostelAuth must be inside HostelAuthProvider");
    }
    // In dev/HMR: return a safe empty context so the component can render
    // without crashing — the real context value will arrive on next render.
    return {
      client: null,
      orders: [],
      isAdmin: false,
      isViewer: false,
      profileNeedsSetup: false,
      isDataLoaded: false,
      authResolved: false,
      requestOrders: () => {},
      login: async () => ({ success: false, error: "Context not ready" }),
      logout: async () => {},
      setAuthenticatedUser: () => {},
      addIssue: async () => {},
      verifyOrder: async () => {},
      verifyAllOrders: async () => {},
    };
  }
  return ctx;
}
