import { Navigate } from "react-router-dom";
import { useHostelAuth } from "../../context/HostelAuthContext";

export default function AdminRoute({ children }) {
    const { client, isAdmin, isDataLoaded } = useHostelAuth();

    // Wait for auth to resolve before redirecting — prevents false /login
    // redirect during initial load and Vite HMR re-mounts.
    if (client === null && !isDataLoaded) return null;

    if (!client) return <Navigate to="/login" replace />;
    if (!isAdmin) return <Navigate to="/client/dashboard" replace />;
    return children;
}
