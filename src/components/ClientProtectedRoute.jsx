// src/components/ClientProtectedRoute.jsx
import { Navigate } from "react-router-dom";
import { useHostelAuth } from "../context/HostelAuthContext";

export default function ClientProtectedRoute({ children }) {
  const { client } = useHostelAuth();
  if (!client || client.role === "admin" || client.role === "admin_viewer") {
    return <Navigate to="/admin" replace />;
  }
  return children;
}
