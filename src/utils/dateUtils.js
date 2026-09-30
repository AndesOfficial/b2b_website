/**
 * Shared date utilities — single source of truth for the entire app.
 * All date strings are in YYYY-MM-DD format, timezone-adjusted to the user's local clock.
 */

function toLocalDate(offset = 0) {
  const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  d.setDate(d.getDate() + offset);
  return d;
}

export function getTodayString() {
  return toLocalDate(0).toISOString().split("T")[0];
}

export function getYesterdayString() {
  return toLocalDate(-1).toISOString().split("T")[0];
}

export function getMonthStartString() {
  const d = toLocalDate(0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function formatDateString(offset = 0) {
  const d = toLocalDate(offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function calculateTAT(createdAt, updatedAt) {
  if (!createdAt || !updatedAt) return "—";

  // Convert Firebase timestamps to JS Date objects if needed
  const start = typeof createdAt.toDate === 'function' ? createdAt.toDate() : new Date(createdAt);
  const end = typeof updatedAt.toDate === 'function' ? updatedAt.toDate() : new Date(updatedAt);

  if (isNaN(start) || isNaN(end)) return "—";

  const diffInMs = end - start;
  if (diffInMs < 0) return "—";

  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const hours = Math.floor(diffInMinutes / 60);
  const minutes = diffInMinutes % 60;

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}
