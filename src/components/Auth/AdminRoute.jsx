import { Navigate } from "react-router-dom";
import { useHostelAuth } from "../../context/HostelAuthContext";

export default function AdminRoute({ children }) {
    const { client, isAdmin } = useHostelAuth();
    if (!client) return <Navigate to="/login" replace />;
    if (!isAdmin) return <Navigate to="/client/dashboard" replace />;
    return children;
}
