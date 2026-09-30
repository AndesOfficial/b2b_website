/**
 * AuthContext.jsx — compatibility shim
 *
 * Legacy pages (Dashboard, MonthOrders, DayOrders, TenantDays, TenantMonths,
 * ProtectedRoute) import `useAuth` from this file. After the Firebase migration,
 * all auth state now lives in HostelAuthContext.
 *
 * This shim bridges the two so legacy imports keep working without any
 * page-level changes. It maps:
 *   client  → partner
 *   orders  → orders  (already the same key)
 *   loading is surfaced as `false` because HostelAuthContext manages loading
 *            internally and doesn't expose it on the context value.
 */
import { useHostelAuth } from "./HostelAuthContext";

export function useAuth() {
  const { client, orders } = useHostelAuth();

  return {
    partner: client,   // legacy pages expect `partner`
    orders,
    loading: false,    // HostelAuthContext handles its own loading state
    isAuthenticated: !!client,
  };
}
