import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { HostelAuthProvider } from "./context/HostelAuthContext";
import AdminRoute from "./components/Auth/AdminRoute";
import ClientProtectedRoute from "./components/Auth/ClientProtectedRoute";
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import AdminRegularOrders from "./pages/AdminRegularOrders";
import AdminB2BOrders from "./pages/AdminB2BOrders";
import InvestorDashboard from "./pages/InvestorDashboard";
import ClientDashboard from "./pages/ClientDashboard";
import ClientCategoryOrders from "./pages/ClientCategoryOrders";
import ClientOrderDetail from "./pages/ClientOrderDetail";
import AdminSalaries from "./pages/AdminSalaries";
import AdminServices from "./pages/AdminServices";
import AdminCouponsOffers from "./pages/AdminCouponsOffers";
import AdminSubscriptions from "./pages/AdminSubscriptions";
import AdminWallets from "./pages/AdminWallets";
import AdminBotRequests from "./pages/AdminBotRequests";
import AdminRiders from "./pages/AdminRiders";
import AdminAnalytics from "./pages/AdminAnalytics";
import NotFound from "./pages/NotFound";
import HostelOrderForm from "./pages/HostelOrderForm";

export default function App() {
  return (
    <BrowserRouter>
      <HostelAuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/hostel-order" element={<HostelOrderForm />} />
          

          {/* Admin */}
          <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          <Route path="/admin/b2b-orders" element={<AdminRoute><AdminB2BOrders /></AdminRoute>} />
          <Route path="/admin/regular-orders" element={<AdminRoute><AdminRegularOrders /></AdminRoute>} />
          <Route path="/admin/expenses" element={<Navigate to="/admin" replace />} />
          <Route path="/admin/salaries" element={<AdminRoute><AdminSalaries /></AdminRoute>} />
          <Route path="/admin/investors" element={<AdminRoute><InvestorDashboard /></AdminRoute>} />
          <Route path="/admin/calculator" element={<Navigate to="/admin" replace />} />
          <Route path="/admin/meta-leads" element={<Navigate to="/admin" replace />} />
          <Route path="/admin/daily-report" element={<Navigate to="/admin" replace />} />
          <Route path="/admin/services" element={<AdminRoute><AdminServices /></AdminRoute>} />
          <Route path="/admin/subscriptions" element={<AdminRoute><AdminSubscriptions /></AdminRoute>} />
          <Route path="/admin/coupons" element={<AdminRoute><AdminCouponsOffers /></AdminRoute>} />
          <Route path="/admin/wallets" element={<AdminRoute><AdminWallets /></AdminRoute>} />
          <Route path="/admin/bot-requests" element={<AdminRoute><AdminBotRequests /></AdminRoute>} />
          <Route path="/admin/riders" element={<AdminRoute><AdminRiders /></AdminRoute>} />
          <Route path="/admin/analytics" element={<AdminRoute><AdminAnalytics /></AdminRoute>} />
          <Route path="/admin/analytics/:report" element={<AdminRoute><AdminAnalytics /></AdminRoute>} />
          <Route path="/admin/data-export" element={<Navigate to="/admin" replace />} />

          {/* Client Portal */}
          <Route path="/client/dashboard" element={<ClientProtectedRoute><ClientDashboard /></ClientProtectedRoute>} />
          <Route path="/client/category/:categoryKey" element={<ClientProtectedRoute><ClientCategoryOrders /></ClientProtectedRoute>} />
          <Route path="/client/order/:orderId" element={<ClientProtectedRoute><ClientOrderDetail /></ClientProtectedRoute>} />

          {/* Fallback */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </HostelAuthProvider>
    </BrowserRouter>
  );
}
