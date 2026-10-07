import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  collection,
  doc,
  setDoc,
  addDoc,
  deleteDoc,
  onSnapshot,
  query,
} from "firebase/firestore";
import { db } from "../firebase";

export const INITIAL_WORKERS = [
  {
    id: "shubam",
    name: "Shubam",
    role: "Manager",
    joiningDate: "2026-09-20",
    currentMonthlySalary: 35000,
    phone: "",
    status: "active",
    salaryHistory: [{ rate: 35000, effectiveDate: "2026-09-20", note: "Joining salary" }],
  },
  {
    id: "neeraj",
    name: "Neeraj",
    role: "Ironing",
    joiningDate: "2026-09-15",
    currentMonthlySalary: 25000,
    phone: "",
    status: "active",
    salaryHistory: [{ rate: 25000, effectiveDate: "2026-09-15", note: "Joining salary" }],
  },
  {
    id: "shiva",
    name: "Shiva",
    role: "Ironing",
    joiningDate: "2026-09-15",
    currentMonthlySalary: 28000,
    phone: "",
    status: "active",
    salaryHistory: [{ rate: 28000, effectiveDate: "2026-09-15", note: "Joining salary" }],
  },
  {
    id: "ajay",
    name: "Ajay",
    role: "Ironing",
    joiningDate: "2026-09-15",
    currentMonthlySalary: 27000,
    phone: "",
    status: "active",
    salaryHistory: [{ rate: 27000, effectiveDate: "2026-09-15", note: "Joining salary" }],
  },
  {
    id: "omkar",
    name: "Omkar",
    role: "Pickup & Delivery",
    joiningDate: "2026-09-15",
    currentMonthlySalary: 19000,
    phone: "",
    status: "active",
    salaryHistory: [{ rate: 19000, effectiveDate: "2026-09-15", note: "Joining salary" }],
  },
  {
    id: "sandeep",
    name: "Sandeep",
    role: "Tagging",
    joiningDate: "2026-09-15",
    currentMonthlySalary: 18000,
    phone: "",
    status: "active",
    salaryHistory: [{ rate: 18000, effectiveDate: "2026-09-15", note: "Joining salary" }],
  },
  {
    id: "sunny",
    name: "Sunny",
    role: "Ironing",
    joiningDate: "2026-09-15",
    currentMonthlySalary: 27000,
    phone: "",
    status: "active",
    salaryHistory: [
      { rate: 23000, effectiveDate: "2026-09-15", note: "Initial salary" },
      { rate: 27000, effectiveDate: "2026-09-23", note: "Salary increment" },
    ],
  },
  {
    id: "pritam",
    name: "Pritam",
    role: "Processing",
    joiningDate: "2026-09-15",
    currentMonthlySalary: 23000,
    phone: "",
    status: "active",
    salaryHistory: [
      { rate: 18000, effectiveDate: "2026-09-15", note: "Initial salary" },
      { rate: 23000, effectiveDate: "2026-09-23", note: "Salary increment" },
    ],
  },
];

export const INITIAL_THURSDAY_WORKED = [
  // Neeraj worked on Sep 17 and Sep 24
  { workerId: "neeraj", date: "2026-09-17", status: "thursday_worked", note: "Thursday Overtime Shift" },
  { workerId: "neeraj", date: "2026-09-24", status: "thursday_worked", note: "Thursday Overtime Shift" },
  // Shiva worked on Sep 17 and Sep 24
  { workerId: "shiva", date: "2026-09-17", status: "thursday_worked", note: "Thursday Overtime Shift" },
  { workerId: "shiva", date: "2026-09-24", status: "thursday_worked", note: "Thursday Overtime Shift" },
  // Sunny worked on Sep 17 and Sep 24
  { workerId: "sunny", date: "2026-09-17", status: "thursday_worked", note: "Thursday Overtime Shift" },
  { workerId: "sunny", date: "2026-09-24", status: "thursday_worked", note: "Thursday Overtime Shift" },
  // Pritam worked on Sep 17 and Sep 24
  { workerId: "pritam", date: "2026-09-17", status: "thursday_worked", note: "Thursday Overtime Shift" },
  { workerId: "pritam", date: "2026-09-24", status: "thursday_worked", note: "Thursday Overtime Shift" },
];

export function mergeWithInitialWorkers(incomingList) {
  const map = new Map();
  INITIAL_WORKERS.forEach((w) => map.set(w.id, { ...w }));
  if (Array.isArray(incomingList)) {
    incomingList.forEach((w) => {
      if (w && w.id) {
        map.set(w.id, { ...(map.get(w.id) || {}), ...w });
      }
    });
  }
  return Array.from(map.values());
}

export function mergeWithInitialAttendance(incomingList) {
  const map = new Map();
  INITIAL_THURSDAY_WORKED.forEach((a) => map.set(`${a.workerId}_${a.date}`, { ...a }));
  if (Array.isArray(incomingList)) {
    incomingList.forEach((a) => {
      if (a && a.workerId && a.date) {
        map.set(`${a.workerId}_${a.date}`, { ...(map.get(`${a.workerId}_${a.date}`) || {}), ...a });
      }
    });
  }
  return Array.from(map.values());
}

function getStoredJSON(key, fallback) {
  try {
    const val = localStorage.getItem(key);
    if (val) {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    // Ignore JSON parse errors
  }
  return fallback;
}

export function useSalaryData() {
  // Always merge with INITIAL_WORKERS so all 8 workers are guaranteed to be present
  const [workers, setWorkers] = useState(() => {
    const stored = getStoredJSON("andes_salary_workers", []);
    return mergeWithInitialWorkers(stored);
  });

  const [attendance, setAttendance] = useState(() => {
    const stored = getStoredJSON("andes_salary_attendance", []);
    return mergeWithInitialAttendance(stored);
  });

  const [adjustments, setAdjustments] = useState(() => getStoredJSON("andes_salary_adjustments", []));
  const [payments, setPayments] = useState(() => getStoredJSON("andes_salary_payments", []));
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState("ready"); // "ready" | "syncing" | "error"

  const hasSeededRef = useRef(false);

  // Sync to localStorage as backup
  useEffect(() => {
    try {
      localStorage.setItem("andes_salary_workers", JSON.stringify(workers));
    } catch (e) {}
  }, [workers]);

  useEffect(() => {
    try {
      localStorage.setItem("andes_salary_attendance", JSON.stringify(attendance));
    } catch (e) {}
  }, [attendance]);

  useEffect(() => {
    try {
      localStorage.setItem("andes_salary_adjustments", JSON.stringify(adjustments));
    } catch (e) {}
  }, [adjustments]);

  useEffect(() => {
    try {
      localStorage.setItem("andes_salary_payments", JSON.stringify(payments));
    } catch (e) {}
  }, [payments]);

  // Real-time Firestore subscriptions (safe & non-blocking)
  useEffect(() => {
    let unsubs = [];

    try {
      // 1. Workers
      const unsubWorkers = onSnapshot(
        query(collection(db, "salary_workers")),
        (snapshot) => {
          if (!snapshot.empty) {
            const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            setWorkers(mergeWithInitialWorkers(list));
          }
        },
        (err) => {
          console.warn("salary_workers Firestore listener error (using local storage fallback):", err.message);
        }
      );
      unsubs.push(unsubWorkers);

      // 2. Attendance
      const unsubAttendance = onSnapshot(
        query(collection(db, "salary_attendance")),
        (snapshot) => {
          if (!snapshot.empty) {
            const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            setAttendance(mergeWithInitialAttendance(list));
          }
        },
        (err) => {
          console.warn("salary_attendance Firestore listener error:", err.message);
        }
      );
      unsubs.push(unsubAttendance);

      // 3. Adjustments
      const unsubAdj = onSnapshot(
        query(collection(db, "salary_adjustments")),
        (snapshot) => {
          if (!snapshot.empty) {
            const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            setAdjustments(list);
          }
        },
        (err) => {
          console.warn("salary_adjustments Firestore listener error:", err.message);
        }
      );
      unsubs.push(unsubAdj);

      // 4. Payments
      const unsubPayments = onSnapshot(
        query(collection(db, "salary_payments")),
        (snapshot) => {
          if (!snapshot.empty) {
            const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            setPayments(list);
          }
        },
        (err) => {
          console.warn("salary_payments Firestore listener error:", err.message);
        }
      );
      unsubs.push(unsubPayments);
    } catch (err) {
      console.warn("Setup salary subscriptions failed:", err);
    }

    return () => {
      unsubs.forEach((u) => u && u());
    };
  }, []);

  // Map of attendance for quick O(1) lookup: `${workerId}_${date}` -> record
  const attendanceMap = useMemo(() => {
    const map = new Map();
    attendance.forEach((rec) => {
      if (rec.workerId && rec.date) {
        map.set(`${rec.workerId}_${rec.date}`, rec);
      }
    });
    return map;
  }, [attendance]);

  // Seed Initial Workers (non-blocking, runs in background without setting global loading)
  const seedInitialData = useCallback(async () => {
    if (hasSeededRef.current) return;
    hasSeededRef.current = true;

    try {
      // 1. Ensure local state has all 8 workers
      setWorkers((prev) => mergeWithInitialWorkers(prev));
      setAttendance((prev) => mergeWithInitialAttendance(prev));

      // 2. Attempt Firestore background sync
      for (const w of INITIAL_WORKERS) {
        await setDoc(
          doc(db, "salary_workers", w.id),
          {
            ...w,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        ).catch((e) => console.warn(`Could not sync worker ${w.id} to Firestore:`, e.message));
      }

      for (const att of INITIAL_THURSDAY_WORKED) {
        const docId = `${att.workerId}_${att.date}`;
        await setDoc(
          doc(db, "salary_attendance", docId),
          {
            ...att,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            updatedBy: "Admin",
          },
          { merge: true }
        ).catch((e) => console.warn(`Could not sync attendance to Firestore:`, e.message));
      }
    } catch (err) {
      console.warn("Background seed notice:", err.message);
    }
  }, []);

  // Add / Edit Worker
  const saveWorker = useCallback(async (workerData) => {
    const id = workerData.id || String(workerData.name || "").toLowerCase().replace(/[^a-z0-9]/g, "-") + "-" + Date.now().toString().slice(-4);
    const existingHistory = Array.isArray(workerData.salaryHistory) ? workerData.salaryHistory : [];
    
    const salaryHistory = existingHistory.length > 0 ? existingHistory : [
      {
        rate: Number(workerData.currentMonthlySalary || 0),
        effectiveDate: workerData.joiningDate || new Date().toISOString().slice(0, 10),
        note: "Initial salary",
      },
    ];

    const payload = {
      id,
      name: workerData.name.trim(),
      role: workerData.role || "Staff",
      joiningDate: workerData.joiningDate || new Date().toISOString().slice(0, 10),
      currentMonthlySalary: Number(workerData.currentMonthlySalary || 0),
      phone: workerData.phone || "",
      status: workerData.status || "active",
      salaryHistory,
      updatedAt: new Date().toISOString(),
    };

    // Update local state immediately
    setWorkers((prev) => {
      const idx = prev.findIndex((w) => w.id === id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = payload;
        return next;
      }
      return [...prev, payload];
    });

    // Sync to Firestore in background
    await setDoc(doc(db, "salary_workers", id), payload, { merge: true }).catch((err) => {
      console.warn("Firestore worker save error:", err.message);
    });

    return id;
  }, []);

  // Update Worker Salary with Effective Date
  const changeSalaryRate = useCallback(async (workerId, newMonthlySalary, effectiveDate, note = "") => {
    const newRate = Number(newMonthlySalary);
    const todayStr = new Date().toISOString().slice(0, 10);

    let updatedPayload = null;

    setWorkers((prev) => {
      const worker = prev.find((w) => w.id === workerId);
      if (!worker) return prev;

      const history = Array.isArray(worker.salaryHistory) ? [...worker.salaryHistory] : [];
      const existingIndex = history.findIndex((h) => h.effectiveDate === effectiveDate);
      if (existingIndex >= 0) {
        history[existingIndex] = { rate: newRate, effectiveDate, note };
      } else {
        history.push({ rate: newRate, effectiveDate, note });
      }

      history.sort((a, b) => (a.effectiveDate || "").localeCompare(b.effectiveDate || ""));
      const currentRate = effectiveDate <= todayStr ? newRate : worker.currentMonthlySalary;

      updatedPayload = {
        ...worker,
        currentMonthlySalary: currentRate,
        salaryHistory: history,
        updatedAt: new Date().toISOString(),
      };

      return prev.map((w) => (w.id === workerId ? updatedPayload : w));
    });

    if (updatedPayload) {
      await setDoc(doc(db, "salary_workers", workerId), updatedPayload, { merge: true }).catch((err) => {
        console.warn("Firestore salary change save error:", err.message);
      });
    }
  }, []);

  // Mark / Override Attendance for a Worker on a Specific Date
  const markAttendance = useCallback(async (workerId, dateStr, status, note = "") => {
    const docId = `${workerId}_${dateStr}`;
    const payload = {
      workerId,
      date: dateStr,
      status,
      note: note || "",
      updatedAt: new Date().toISOString(),
      updatedBy: "Admin",
    };

    // Update local state immediately
    setAttendance((prev) => {
      const next = prev.filter((r) => !(r.workerId === workerId && r.date === dateStr));
      return [...next, payload];
    });

    // Sync to Firestore in background
    await setDoc(doc(db, "salary_attendance", docId), payload).catch((err) => {
      console.warn("Firestore attendance save error:", err.message);
    });
  }, []);

  // Batch Mark Attendance
  const batchMarkAttendance = useCallback(async (records) => {
    setAttendance((prev) => {
      const map = new Map(prev.map((r) => [`${r.workerId}_${r.date}`, r]));
      records.forEach((rec) => {
        map.set(`${rec.workerId}_${rec.date}`, {
          workerId: rec.workerId,
          date: rec.date,
          status: rec.status,
          note: rec.note || "",
          updatedAt: new Date().toISOString(),
          updatedBy: "Admin",
        });
      });
      return Array.from(map.values());
    });

    for (const rec of records) {
      const docId = `${rec.workerId}_${rec.date}`;
      await setDoc(doc(db, "salary_attendance", docId), {
        workerId: rec.workerId,
        date: rec.date,
        status: rec.status,
        note: rec.note || "",
        updatedAt: new Date().toISOString(),
        updatedBy: "Admin",
      }).catch((e) => console.warn("Firestore batch attendance sync:", e.message));
    }
  }, []);

  // Add Overtime, Extra Work, or Deduction
  const addAdjustment = useCallback(async (data) => {
    const month = (data.date || new Date().toISOString().slice(0, 10)).slice(0, 7);
    const id = "adj_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);

    const payload = {
      id,
      workerId: data.workerId,
      workerName: data.workerName || "",
      date: data.date,
      month,
      type: data.type,
      amount: Number(data.amount || 0),
      reason: data.reason || "",
      notes: data.notes || "",
      createdAt: new Date().toISOString(),
    };

    setAdjustments((prev) => [...prev, payload]);

    await setDoc(doc(db, "salary_adjustments", id), payload).catch((err) => {
      console.warn("Firestore adjustment save error:", err.message);
    });

    return id;
  }, []);

  // Delete Adjustment
  const deleteAdjustment = useCallback(async (id) => {
    setAdjustments((prev) => prev.filter((a) => a.id !== id));
    await deleteDoc(doc(db, "salary_adjustments", id)).catch((err) => {
      console.warn("Firestore adjustment delete error:", err.message);
    });
  }, []);

  // Record Salary Payout
  const recordPayment = useCallback(async (data) => {
    const month = data.month || (data.date || new Date().toISOString().slice(0, 10)).slice(0, 7);
    const id = "pay_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);

    const payload = {
      id,
      workerId: data.workerId,
      workerName: data.workerName || "",
      date: data.date || new Date().toISOString().slice(0, 10),
      month,
      amount: Number(data.amount || 0),
      paymentMode: data.paymentMode || "UPI",
      reference: data.reference || "",
      notes: data.notes || "",
      createdAt: new Date().toISOString(),
    };

    setPayments((prev) => [...prev, payload]);

    await setDoc(doc(db, "salary_payments", id), payload).catch((err) => {
      console.warn("Firestore payment save error:", err.message);
    });

    return id;
  }, []);

  // Delete Payment
  const deletePayment = useCallback(async (id) => {
    setPayments((prev) => prev.filter((p) => p.id !== id));
    await deleteDoc(doc(db, "salary_payments", id)).catch((err) => {
      console.warn("Firestore payment delete error:", err.message);
    });
  }, []);

  return {
    workers,
    attendance,
    attendanceMap,
    adjustments,
    payments,
    loading,
    syncStatus,
    saveWorker,
    changeSalaryRate,
    markAttendance,
    batchMarkAttendance,
    addAdjustment,
    deleteAdjustment,
    recordPayment,
    deletePayment,
    seedInitialData,
  };
}
