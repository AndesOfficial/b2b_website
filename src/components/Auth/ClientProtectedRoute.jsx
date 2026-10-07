import { Navigate } from "react-router-dom";
import { useHostelAuth } from "../../context/HostelAuthContext";
import LoadingSpinner from "../Shared/LoadingSpinner";

export default function ClientProtectedRoute({ children }) {
  const { client, authResolved } = useHostelAuth();

  // Wait for auth to resolve before redirecting — prevents false redirect
  // during initial load and Vite HMR re-mounts.
  if (client === null && !authResolved) return <LoadingSpinner fullscreen message="Authenticating..." />;

  if (!client) {
    return <Navigate to="/login" replace />;
  }
  if (client.role === "admin" || client.role === "admin_viewer") {
    return <Navigate to="/admin" replace />;
  }
  return children;
}
