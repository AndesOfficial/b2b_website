import { Navigate } from "react-router-dom";
import { useHostelAuth } from "../../context/HostelAuthContext";
import LoadingSpinner from "../Shared/LoadingSpinner";

export default function AdminRoute({ children }) {
    const { client, isAdmin, authResolved } = useHostelAuth();

    // Wait for auth to resolve before redirecting — prevents false /login
    // redirect during initial load and Vite HMR re-mounts.
    if (client === null && !authResolved) return <LoadingSpinner fullscreen message="Authenticating..." />;

    if (!client) return <Navigate to="/login" replace />;
    if (!isAdmin) return <Navigate to="/client/dashboard" replace />;
    return children;
}
