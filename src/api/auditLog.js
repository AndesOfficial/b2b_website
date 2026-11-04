// Append-only trail of money edits (rules: create only, `by` must be the
// signer's email, `at` the server time). Failures are logged, never thrown,
// so an audit hiccup can't block the edit itself.
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";

const clean = (v) => (v === undefined ? null : JSON.parse(JSON.stringify(v ?? null)));

export async function logAudit(action, target, { before, after, note } = {}) {
  try {
    await addDoc(collection(db, "auditLog"), {
      action, // e.g. "expense.update"
      collection: target.collection,
      docId: target.id ?? null,
      before: clean(before),
      after: clean(after),
      note: note ?? null,
      by: auth.currentUser?.email ?? null,
      at: serverTimestamp(),
    });
  } catch (e) {
    console.error("auditLog:", action, e);
  }
}
