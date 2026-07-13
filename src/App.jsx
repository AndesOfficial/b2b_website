import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { HostelAuthProvider } from "./context/HostelAuthContext";
import AdminRoute from "./components/Auth/AdminRoute";
import ClientProtectedRoute from "./components/Auth/ClientProtectedRoute";
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import AdminExpenses from "./pages/AdminExpenses";
import AdminRegularOrders from "./pages/AdminRegularOrders";
import InvestorDashboard from "./pages/InvestorDashboard";
import Calculator from "./pages/Calculator";
import ClientDashboard from "./pages/ClientDashboard";
import ClientCategoryOrders from "./pages/ClientCategoryOrders";
import ClientOrderDetail from "./pages/ClientOrderDetail";
import AdminMetaAdsLeads from "./pages/AdminMetaAdsLeads";

export default function App() {
  return (
    <BrowserRouter>
      <HostelAuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />

          {/* Admin */}
          <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          <Route path="/admin/regular-orders" element={<AdminRoute><AdminRegularOrders /></AdminRoute>} />
          <Route path="/admin/expenses" element={<AdminRoute><AdminExpenses /></AdminRoute>} />
          <Route path="/admin/investors" element={<AdminRoute><InvestorDashboard /></AdminRoute>} />
          <Route path="/admin/calculator" element={<AdminRoute><Calculator /></AdminRoute>} />
          <Route path="/admin/meta-leads" element={<AdminRoute><AdminMetaAdsLeads /></AdminRoute>} />

          {/* Client Portal */}
          <Route path="/client/dashboard" element={<ClientProtectedRoute><ClientDashboard /></ClientProtectedRoute>} />
          <Route path="/client/category/:categoryKey" element={<ClientProtectedRoute><ClientCategoryOrders /></ClientProtectedRoute>} />
          <Route path="/client/order/:orderId" element={<ClientProtectedRoute><ClientOrderDetail /></ClientProtectedRoute>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </HostelAuthProvider>
    </BrowserRouter>
  );
}
