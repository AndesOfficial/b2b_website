// src/components/ClientProtectedRoute.jsx
import { Navigate } from "react-router-dom";
import { useHostelAuth } from "../../context/HostelAuthContext";

export default function ClientProtectedRoute({ children }) {
  const { client, isDataLoaded } = useHostelAuth();

  // Wait for auth to resolve before redirecting — prevents false redirect
  // during initial load and Vite HMR re-mounts.
  if (client === null && !isDataLoaded) return null;

  if (!client || client.role === "admin" || client.role === "admin_viewer") {
    return <Navigate to="/admin" replace />;
  }
  return children;
}
