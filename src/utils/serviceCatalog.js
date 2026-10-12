import {
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, db, storage } from "../firebase";

// Writes to the service catalog (`prices`). Every write also appends a
// `prices_audit` record in the same batch. Services are never deleted —
// they are hidden or archived through `status`.

/** Human-readable message for a failed catalog write. */
export function describeCatalogError(err) {
  if (err?.code === "permission-denied" || err?.code === "storage/unauthorized") {
    return "Your account isn't allowed to edit services. Ask an Andes admin to give you the admin role, then log out and back in.";
  }
  return err?.message || "Something went wrong. Please try again.";
}

/** Docs written before the admin page only carry `isActive`. */
export function serviceStatusOf(data) {
  if (["active", "hidden", "archived"].includes(data?.status)) return data.status;
  return data?.isActive === false ? "hidden" : "active";
}

const NUMBER_FIELDS = [
  "rateByPiece", "rateByKg", "rateByPair",
  "originalRateByPiece", "originalRateByKg",
  "instantRateByPiece", "instantRateByKg",
  "originalInstantRateByPiece", "originalInstantRateByKg",
  "minPrice", "maxPrice", "displayOrder",
];

const slug = (s) =>
  String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

/**
 * "% off" from the struck-through original vs the selling rate, rounded down
 * so the badge never overstates the saving. "" when there is no saving.
 */
export function discountLabel(rate, original) {
  const r = Number(rate), o = Number(original);
  if (!(r > 0) || !(o > r)) return "";
  return String(Math.floor(((o - r) / o) * 100));
}

/** Turns the editor's form state into the Firestore document shape. */
function toFirestore(form, serviceId) {
  const out = { ...form };
  delete out.id;
  for (const key of NUMBER_FIELDS) {
    if (out[key] === "" || out[key] === null || out[key] === undefined) {
      delete out[key];
    } else {
      out[key] = Number(out[key]);
    }
  }
  // The app shows and bills `rateByPiece`; a pair-only price showed as ₹0
  // (and older Android builds hid the service). Pair services carry both.
  if (out.rateByPair > 0) out.rateByPiece = out.rateByPair;
  // Discount badges follow the prices instead of being typed by hand.
  out.discountPercentage = discountLabel(out.rateByPiece || out.rateByKg, out.rateByPiece ? out.originalRateByPiece : out.originalRateByKg);
  out.instantDiscountPercentage = discountLabel(
    out.instantRateByPiece || out.instantRateByKg,
    out.instantRateByPiece ? out.originalInstantRateByPiece : out.originalInstantRateByKg,
  );
  out.serviceName = String(out.serviceName || "").trim();
  out.status = serviceStatusOf(out);
  // Old app versions only understand isActive.
  out.isActive = out.status === "active";
  out.serviceId = serviceId;
  if (!out.imageUrl) delete out.imageUrl;
  if (Array.isArray(out.subServices)) {
    const used = new Set();
    out.subServices = out.subServices.map((sub) => {
      const status = serviceStatusOf(sub);
      let id = sub.serviceId || `${serviceId}_${slug(sub.name || "sub")}`;
      while (used.has(id)) id += "_x";
      used.add(id);
      const clean = { ...sub, name: String(sub.name || "").trim(), status, isActive: status === "active", serviceId: id, unit: "piece" };
      for (const key of ["rateByPiece", "instantRateByPiece", "originalRateByPiece", "originalInstantRateByPiece", "displayOrder"]) {
        if (clean[key] === "" || clean[key] === null || clean[key] === undefined) delete clean[key];
        else clean[key] = Number(clean[key]);
      }
      return clean;
    });
  }
  return out;
}

/** Returns a list of problems with the form; empty when it can be saved. */
export function validateService(form, allServices) {
  const errors = [];
  const name = String(form.serviceName || "").trim();
  if (!name) errors.push("Name is required.");
  const clash = allServices.find(
    (s) => s.id !== form.id &&
      serviceStatusOf(s) !== "archived" &&
      String(s.serviceName || "").trim().toLowerCase() === name.toLowerCase() &&
      // Case-insensitive: "General" and "general" were treated as different
      // categories, which let duplicate Wash & Fold / Wash & Iron docs in.
      String(s.category || "").trim().toLowerCase() === String(form.category || "").trim().toLowerCase(),
  );
  if (clash) errors.push(`Another service in this category is already called "${name}".`);
  for (const key of NUMBER_FIELDS) {
    const v = form[key];
    if (v !== "" && v !== null && v !== undefined && (Number.isNaN(Number(v)) || Number(v) < 0)) {
      errors.push(`${key} must be a number ≥ 0.`);
    }
  }
  const hasRate = ["rateByPiece", "rateByKg", "rateByPair", "instantRateByPiece", "instantRateByKg"]
    .some((k) => Number(form[k]) > 0);
  const subs = Array.isArray(form.subServices) ? form.subServices : [];
  if (!hasRate && subs.length === 0) errors.push("Set at least one rate, or add sub-services.");
  // Every app reads the unit instead of guessing from the name, so it must
  // be set and match the price that is filled in.
  if (!["kg", "piece", "pair"].includes(form.unit)) {
    errors.push("Choose a unit (per kg, per piece or per pair).");
  } else if (subs.length === 0) {
    const unitRate = {
      kg: ["rateByKg", "instantRateByKg"],
      piece: ["rateByPiece", "instantRateByPiece"],
      pair: ["rateByPair"],
    }[form.unit];
    if (!unitRate.some((k) => Number(form[k]) > 0)) {
      errors.push(`The unit is per ${form.unit}, but no per-${form.unit} price is set.`);
    }
  }
  subs.forEach((sub, i) => {
    if (!String(sub.name || "").trim()) errors.push(`Sub-service ${i + 1} needs a name.`);
    if (!(Number(sub.rateByPiece) > 0) && !(Number(sub.instantRateByPiece) > 0)) {
      errors.push(`Sub-service "${sub.name || i + 1}" needs a rate.`);
    }
  });
  return errors;
}

function actor() {
  const user = auth.currentUser;
  if (!user) throw new Error("You are signed out. Log in again to save.");
  return { uid: user.uid, email: user.email || "" };
}

function auditDoc(batch, { serviceDocId, action, before, after, by }) {
  batch.set(doc(collection(db, "prices_audit")), {
    serviceDocId,
    action,
    before: before ?? null,
    after: after ?? null,
    by: by.uid,
    byEmail: by.email,
    at: serverTimestamp(),
  });
}

/**
 * Creates (when `before` is null) or updates a service.
 * Returns the doc id.
 */
export async function saveService(before, form) {
  const by = actor();
  const ref = before ? doc(db, "prices", before.id) : doc(collection(db, "prices"));
  const serviceId = before?.serviceId || ref.id;
  const data = {
    ...toFirestore(form, serviceId),
    updatedAt: serverTimestamp(),
    updatedBy: by.email || by.uid,
  };
  if (!before) data.createdAt = serverTimestamp();

  const beforeData = before ? { ...before } : null;
  if (beforeData) delete beforeData.id;
  const action = !before
    ? "create"
    : serviceStatusOf(before) !== data.status
      ? "status"
      : "update";

  const batch = writeBatch(db);
  // Full replace so fields cleared in the editor are removed.
  batch.set(ref, before?.createdAt ? { ...data, createdAt: before.createdAt } : data);
  auditDoc(batch, {
    serviceDocId: ref.id,
    action,
    before: beforeData,
    after: { ...data, updatedAt: null, createdAt: null },
    by,
  });
  await batch.commit();
  return ref.id;
}

/** Changes only the status of a service (hide / archive / restore). */
export async function setServiceStatus(service, status) {
  const by = actor();
  const batch = writeBatch(db);
  batch.update(doc(db, "prices", service.id), {
    status,
    isActive: status === "active",
    updatedAt: serverTimestamp(),
    updatedBy: by.email || by.uid,
  });
  auditDoc(batch, {
    serviceDocId: service.id,
    action: "status",
    before: { status: serviceStatusOf(service) },
    after: { status },
    by,
  });
  await batch.commit();
}

/** Writes `displayOrder` 1..n for the services in the given order. */
export async function reorderServices(orderedServices) {
  const by = actor();
  const batch = writeBatch(db);
  const changes = [];
  orderedServices.forEach((s, i) => {
    const displayOrder = i + 1;
    if (s.displayOrder === displayOrder) return;
    changes.push({ id: s.id, from: s.displayOrder ?? null, to: displayOrder });
    batch.update(doc(db, "prices", s.id), {
      displayOrder,
      updatedAt: serverTimestamp(),
      updatedBy: by.email || by.uid,
    });
  });
  if (changes.length === 0) return;
  auditDoc(batch, { serviceDocId: "(reorder)", action: "reorder", before: null, after: { changes }, by });
  await batch.commit();
}

/** Marks a rider's "unit set by rider" report as handled. */
export async function resolveCatalogFlag(flagId) {
  await deleteDoc(doc(db, "catalog_flags", flagId));
}

/** Uploads a service image and returns its public download URL. */
export async function uploadServiceImage(file, serviceKey) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `service_images/${slug(serviceKey) || "service"}-${Date.now()}.${ext}`;
  const snap = await uploadBytes(ref(storage, path), file, { contentType: file.type });
  return getDownloadURL(snap.ref);
}
