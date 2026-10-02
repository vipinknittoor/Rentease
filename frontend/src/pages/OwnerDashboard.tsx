import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import api from "../api/axios";
import AIChatbot from "../components/AIChatbot";
import { useModal } from "../context/ModalContext";

import "./Dashboard.css";

interface DashboardData {
  total_rooms: number;
  occupied_rooms: number;
  vacant_rooms: number;
  active_tenants: number;
}

function OwnerDashboard() {
  const navigate = useNavigate();

  const { showError } = useModal();

  const [dashboard, setDashboard] = useState<DashboardData>({
    total_rooms: 0,
    occupied_rooms: 0,
    vacant_rooms: 0,
    active_tenants: 0,
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = localStorage.getItem("user");

    if (!user) {
      navigate("/login", { replace: true });
      return;
    }

    try {
      const parsedUser = JSON.parse(user);

      if (parsedUser.role !== "owner") {
        navigate("/dashboard", { replace: true });
        return;
      }

      fetchDashboard();
    } catch (error) {
      console.error("Invalid user session:", error);
      localStorage.removeItem("user");
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  const fetchDashboard = async () => {
    try {
      setLoading(true);

      const response = await api.get("/dashboard/");

      setDashboard({
        total_rooms: response.data.total_rooms ?? 0,
        occupied_rooms: response.data.occupied_rooms ?? 0,
        vacant_rooms: response.data.vacant_rooms ?? 0,
        active_tenants: response.data.active_tenants ?? 0,
      });
    } catch (error) {
      console.error("Failed to load dashboard:", error);
      showError(
        "Dashboard Error",
        "Unable to load dashboard."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  };

  const occupancyRate =
    dashboard.total_rooms > 0
      ? Math.round(
          (dashboard.occupied_rooms / dashboard.total_rooms) * 100
        )
      : 0;

  const statCards = [
    {
      label: "Total Rooms",
      value: dashboard.total_rooms,
      icon: "🏢",
      tone: "blue",
    },
    {
      label: "Occupied Rooms",
      value: dashboard.occupied_rooms,
      icon: "🔑",
      tone: "green",
    },
    {
      label: "Vacant Rooms",
      value: dashboard.vacant_rooms,
      icon: "🚪",
      tone: "amber",
    },
    {
      label: "Active Tenants",
      value: dashboard.active_tenants,
      icon: "👥",
      tone: "purple",
    },
  ] as const;

  const managementLinks = [
    {
      label: "Manage Rooms",
      description: "Add, edit, or remove rental units",
      icon: "🏠",
      tone: "blue",
      path: "/rooms",
    },
    {
      label: "Manage Tenants",
      description: "View and update tenant records",
      icon: "👥",
      tone: "purple",
      path: "/tenants",
    },
    {
      label: "Payment History",
      description: "Track monthly tenant payments",
      icon: "💳",
      tone: "green",
      path: "/payments",
    },
    {
      label: "Generate Monthly Bills",
      description: "Create monthly bills for active tenants",
      icon: "📅",
      tone: "amber",
      path: "/generate-bills",
    },
  ] as const;

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner" />
        <h2>Loading your dashboard...</h2>
        <p>
          Please wait while we load your property information.
        </p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="glow glow-1" />
      <div className="glow glow-2" />

      <header className="dashboard-navbar">
        <div className="dashboard-logo-section">
          <div className="dashboard-logo-icon">🏠</div>

          <div>
            <h2>RentEase</h2>
            <p>Owner Dashboard</p>
          </div>
        </div>

        <button
          className="dashboard-logout-btn"
          onClick={handleLogout}
        >
          Logout
        </button>
      </header>

      <main className="dashboard-content">
        <section className="welcome-card">
          <div className="welcome-left">
            <div className="avatar">🏠</div>

            <div className="welcome-text">
              <p className="welcome-label">Property Owner</p>

              <h1>Property Overview</h1>

              <p>
                Here's how your property is performing today.
              </p>
            </div>
          </div>

          <div className="occupancy-badge">
            {occupancyRate}% Occupied
          </div>
        </section>

        <section className="dashboard-card">
          <h2 className="section-title">
            Property Statistics
          </h2>

          <div className="stat-grid">
            {statCards.map((stat) => (
              <div className="stat-box" key={stat.label}>
                <span
                  className={`stat-icon icon-${stat.tone}`}
                >
                  {stat.icon}
                </span>

                <p className="stat-label">
                  {stat.label}
                </p>

                <h2 className="stat-value">
                  {stat.value}
                </h2>
              </div>
            ))}
          </div>
        </section>

        <section className="dashboard-card">
          <h2 className="section-title">
            Management
          </h2>

          <div className="management-grid">
            {managementLinks.map((link) => (
              <button
                className="management-btn"
                onClick={() => navigate(link.path)}
                key={link.path}
              >
                <span
                  className={`management-icon icon-${link.tone}`}
                >
                  {link.icon}
                </span>

                <div className="management-text">
                  <h3>{link.label}</h3>
                  <p>{link.description}</p>
                </div>

                <span className="management-arrow">
                  →
                </span>
              </button>
            ))}
          </div>
        </section>
      </main>

      <AIChatbot />
    </div>
  );
}

export default OwnerDashboard;