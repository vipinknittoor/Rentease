import { Link } from "react-router-dom";
import "./Landing.css";

function Landing() {
  return (
    <div className="landing-page">

      <nav className="landing-nav">
        <div className="nav-brand">
          <div className="brand-logo">
            <span>R</span>
          </div>

          <span className="brand-name">RentEase</span>
        </div>

        <div className="nav-actions">
          <Link to="/login" className="nav-login">
            Login
          </Link>

          <Link to="/register" className="nav-register">
            Get Started
          </Link>
        </div>
      </nav>

      <main className="hero">

        <div className="hero-content">

          <div className="hero-badge">
            <span className="badge-dot"></span>
            Simple property management
          </div>

          <h1 className="hero-title">
            Manage rentals
            <span> with ease.</span>
          </h1>

          <p className="hero-subtitle">
            RentEase brings property owners and tenants together
            on one secure platform. Manage properties, track rent,
            monitor payments, and stay organized effortlessly.
          </p>

          <div className="hero-buttons">

            <Link to="/register">
              <button className="btn-primary">
                Get Started
                <span>→</span>
              </button>
            </Link>

            <Link to="/login">
              <button className="btn-secondary">
                Login
              </button>
            </Link>

          </div>

          <div className="hero-trust">
            <div className="trust-item">
              <span className="trust-icon">✓</span>
              Secure
            </div>

            <div className="trust-item">
              <span className="trust-icon">✓</span>
              Easy to use
            </div>

            <div className="trust-item">
              <span className="trust-icon">✓</span>
              Built for rentals
            </div>
          </div>

        </div>


        <div className="hero-visual">

          <div className="dashboard-preview">

            <div className="preview-header">
              <div className="preview-brand">
                <div className="preview-logo">R</div>
                <span>RentEase</span>
              </div>

              <div className="preview-user"></div>
            </div>


            <div className="preview-title">
              <div>
                <h3>Dashboard</h3>
                <p>Welcome back</p>
              </div>

              <div className="preview-date">
                August 2026
              </div>
            </div>


            <div className="preview-stats">

              <div className="preview-stat">
                <div className="stat-icon blue">
                  ₹
                </div>

                <div>
                  <span>Total Rent</span>
                  <strong>₹48,000</strong>
                </div>
              </div>


              <div className="preview-stat">
                <div className="stat-icon green">
                  ✓
                </div>

                <div>
                  <span>Paid</span>
                  <strong>₹36,000</strong>
                </div>
              </div>

            </div>


            <div className="preview-card">

              <div className="preview-card-header">
                <span>Recent Payments</span>

                <span className="preview-view">
                  View all
                </span>
              </div>


              <div className="payment-row">

                <div className="payment-avatar">
                  A
                </div>

                <div className="payment-info">
                  <strong>Arun Kumar</strong>
                  <span>Room 102</span>
                </div>

                <div className="payment-status">
                  Paid
                </div>

              </div>


              <div className="payment-row">

                <div className="payment-avatar">
                  S
                </div>

                <div className="payment-info">
                  <strong>Sneha Rao</strong>
                  <span>Room 103</span>
                </div>

                <div className="payment-status">
                  Paid
                </div>

              </div>

            </div>

          </div>


          <div className="floating-card floating-card-payment">

            <div className="floating-icon">
              ✓
            </div>

            <div>
              <span>Payment received</span>
              <strong>₹12,000</strong>
            </div>

          </div>


          <div className="floating-card floating-card-room">

            <div className="room-icon">
              🏠
            </div>

            <div>
              <span>Occupied rooms</span>
              <strong>12 / 15</strong>
            </div>

          </div>

        </div>

      </main>


      <section className="features">

        <div className="section-heading">

          <span className="section-label">
            EVERYTHING YOU NEED
          </span>

          <h2>
            One platform for your rental management
          </h2>

          <p>
            RentEase simplifies the everyday tasks of managing
            rental properties and tenants.
          </p>

        </div>


        <div className="features-grid">

          <div className="feature-card">

            <div className="feature-icon blue-icon">
              🏠
            </div>

            <h3>
              Property Management
            </h3>

            <p>
              Manage rooms, occupancy, rent and property
              information from one place.
            </p>

          </div>


          <div className="feature-card">

            <div className="feature-icon green-icon">
              ₹
            </div>

            <h3>
              Payment Tracking
            </h3>

            <p>
              Track rent payments, electricity charges,
              billing and payment history easily.
            </p>

          </div>


          <div className="feature-card">

            <div className="feature-icon purple-icon">
              👥
            </div>

            <h3>
              Tenant Management
            </h3>

            <p>
              Keep tenant information organized and
              manage their rental details efficiently.
            </p>

          </div>


          <div className="feature-card">

            <div className="feature-icon orange-icon">
              🔒
            </div>

            <h3>
              Secure Platform
            </h3>

            <p>
              Role-based access and secure authentication
              keep your rental information protected.
            </p>

          </div>

        </div>

      </section>

      <section className="bottom-cta">

        <div>

          <h2>
            Ready to simplify your rental management?
          </h2>

          <p>
            Get started with RentEase today.
          </p>

        </div>

        <Link to="/register">
          <button className="cta-button">
            Get Started →
          </button>
        </Link>

      </section>


      <footer className="landing-footer">

        <div className="footer-brand">

          <div className="footer-logo">
            R
          </div>

          <span>
            RentEase
          </span>

        </div>

        <p>
          © 2026 RentEase. All rights reserved.
        </p>

      </footer>

    </div>
  );
}

export default Landing;