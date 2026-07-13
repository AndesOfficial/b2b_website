import { FiActivity, FiAlertCircle, FiDollarSign, FiHome, FiInbox, FiLayout, FiPieChart, FiUsers } from "react-icons/fi";
import { FaIndianRupeeSign, FaCalculator } from "react-icons/fa6";

// Centralized tab metadata keeps the sidebar, page title, and layout rules in sync.
export const ADMIN_TAB_CONFIG = {
  overview: {
    key: "overview",
    title: "Dashboard Overview",
    navLabel: "Overview",
    navIcon: FiLayout,
    showSidebar: true,
    showHeaderActions: true,
    showKpis: true,
    kpiColumnsClass: "lg:grid-cols-4",
  },
  hostels: {
    key: "hostels",
    title: "Hostel Management",
    navLabel: "Hostels",
    navIcon: FiHome,
    showSidebar: true,
    showHeaderActions: true,
    showKpis: true,
    kpiColumnsClass: "lg:grid-cols-2",
  },
  hotels: {
    key: "hotels",
    title: "Hotel & Airbnb Analytics",
    navLabel: "Hotels & Airbnbs",
    navIcon: FiActivity,
    showSidebar: true,
    showHeaderActions: true,
    showKpis: true,
    kpiColumnsClass: "lg:grid-cols-2",
  },
  regular: {
    key: "regular",
    title: "Regular B2C Orders",
    navLabel: "Regular Orders",
    navIcon: FiInbox,
    showSidebar: true,
    showHeaderActions: false,
    showKpis: true,
    kpiColumnsClass: "lg:grid-cols-2",
  },
  issues: {
    key: "issues",
    title: "Issue Tracker",
    navLabel: "Issues",
    navIcon: FiAlertCircle,
    showSidebar: true,
    showHeaderActions: false,
    showKpis: false,
    kpiColumnsClass: "",
    badgeKey: "issuesCount",
  },
  analytics: {
    key: "analytics",
    title: "Business Analytics",
    navLabel: "Analytics",
    navIcon: FiPieChart,
    showSidebar: true,
    showHeaderActions: false,
    showKpis: false,
    kpiColumnsClass: "",
  },
  expenses: {
    key: "expenses",
    title: "ANDES Expenses",
    navLabel: "Expenses",
    navIcon: FaIndianRupeeSign,
    showSidebar: true,
    showHeaderActions: false,
    showKpis: false,
    kpiColumnsClass: "",
  },
  calculator: {
    key: "calculator",
    title: "Revenue Calculator",
    navLabel: "Calculator",
    navIcon: FaCalculator,
    showSidebar: true,
    showHeaderActions: false,
    showKpis: false,
    kpiColumnsClass: "",
  },
  investors: {
    key: "investors",
    title: "Investor Relations",
    navLabel: "Investor Relations",
    navIcon: FiDollarSign,
    showSidebar: true,
    showHeaderActions: false,
    showKpis: false,
    kpiColumnsClass: "",
  },
  metaleads: {
    key: "metaleads",
    title: "Meta Ads Leads",
    navLabel: "Meta Leads",
    navIcon: FiUsers,
    showSidebar: true,
    showHeaderActions: false,
    showKpis: false,
    kpiColumnsClass: "",
  },
};

export const ADMIN_SIDEBAR_TABS = Object.values(ADMIN_TAB_CONFIG).filter((tab) => tab.showSidebar);

export function getAdminTabConfig(tabKey) {
  return ADMIN_TAB_CONFIG[tabKey] || ADMIN_TAB_CONFIG.overview;
}
