import { Navigate } from "react-router-dom";
import { useHostelAuth } from "../../context/HostelAuthContext";
import LoadingSpinner from "../Shared/LoadingSpinner";
import { canSeeTab } from "../../config/roles";

/** `tab`: the admin tab this page belongs to; roles without it go back to /admin. */
export default function AdminRoute({ children, tab }) {
    const { client, isAdmin, authResolved } = useHostelAuth();

    // Wait for auth to resolve before redirecting — prevents false /login
    // redirect during initial load and Vite HMR re-mounts.
    if (client === null && !authResolved) return <LoadingSpinner fullscreen message="Authenticating..." />;

    if (!client) return <Navigate to="/login" replace />;
    if (!isAdmin) return <Navigate to="/client/dashboard" replace />;
    if (tab && !canSeeTab(client.role, tab)) return <Navigate to="/admin" replace />;
    return children;
}
