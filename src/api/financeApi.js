// Firestore writes for money inputs: invoices/receivables, cash balances and
// standard costs. Shapes are documented in packages/andes_metrics/src/finance.ts.
import { arrayUnion, doc, getDoc, runTransaction, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { invoiceStatus } from "../metrics";
import { logAudit } from "./auditLog";

const who = () => auth.currentUser?.email || null;

/**
 * Records an invoice when its PDF is generated. Re-generating the same number
 * updates the amount/period but keeps the payments already recorded.
 */
export async function recordInvoice({ invoiceNo, client, periodFrom, periodTo, amount, issuedDate, dueDate }) {
  const ref = doc(db, "invoices", invoiceNo);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const payments = snap.exists() ? snap.data().payments || [] : [];
    const next = { invoiceNo, client, periodFrom, periodTo, amount: Number(amount), issuedDate, dueDate, payments };
    tx.set(ref, {
      ...next,
      status: invoiceStatus(next),
      updatedAt: serverTimestamp(),
      updatedBy: who(),
      ...(snap.exists() ? {} : { createdAt: serverTimestamp(), createdBy: who() }),
    }, { merge: true });
  });
  await logAudit("invoice.issue", { collection: "invoices", id: invoiceNo }, { after: { client, amount, issuedDate, dueDate } });
}

export async function recordInvoicePayment(invoiceNo, { amount, date, method, note }) {
  const ref = doc(db, "invoices", invoiceNo);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error(`Invoice ${invoiceNo} not found`);
    const payment = { amount: Number(amount), date, method: method || null, note: note || null, by: who() };
    const inv = snap.data();
    tx.update(ref, {
      payments: arrayUnion(payment),
      status: invoiceStatus({ ...inv, payments: [...(inv.payments || []), payment] }),
      updatedAt: serverTimestamp(),
      updatedBy: who(),
    });
  });
  await logAudit("invoice.payment", { collection: "invoices", id: invoiceNo }, { after: { amount, date, method, note } });
}

export async function voidInvoice(invoiceNo, reason) {
  await setDoc(doc(db, "invoices", invoiceNo),
    { status: "void", voidReason: reason || null, updatedAt: serverTimestamp(), updatedBy: who() }, { merge: true });
  await logAudit("invoice.void", { collection: "invoices", id: invoiceNo }, { note: reason });
}

/** Opening balances for one day: { bank, upi, cash }. */
export async function saveCashBalance(date, accounts, note) {
  const clean = Object.fromEntries(Object.entries(accounts).map(([k, v]) => [k, Number(v) || 0]));
  const ref = doc(db, "cash_balances", date);
  const before = await getDoc(ref);
  await setDoc(ref, { date, accounts: clean, note: note || null, enteredBy: who(), updatedAt: serverTimestamp() });
  await logAudit("cash_balance.set", { collection: "cash_balances", id: date }, { before: before.data()?.accounts, after: clean });
}

/** Adds (or replaces) the standard-cost version effective from `version.effectiveFrom`. */
export async function saveStandardCostsVersion(version) {
  const ref = doc(db, "company_config", "standardCosts");
  const snap = await getDoc(ref);
  const versions = (snap.exists() ? snap.data().versions || [] : []).filter((v) => v.effectiveFrom !== version.effectiveFrom);
  versions.push({ ...version, savedBy: who() });
  versions.sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : 1));
  await setDoc(ref, { versions, updatedAt: serverTimestamp() }, { merge: true });
  await logAudit("standard_costs.save", { collection: "company_config", id: "standardCosts" }, { after: version });
}
