import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";

import api from "../api/axios";
import "./Dashboard.css";
import AIChatbot from "../components/AIChatbot";
import { useModal } from "../context/ModalContext";

const OWNER_PAYEE_NAME = "RentEase Owner";

const STILL_OWED_STATUSES = [
  "pending",
  "informed",
  "partially_paid",
];

const RESOLVED_STATUSES = [
  "paid",
  "payment_closed",
];

interface TenantProfile {
  id: number;
  full_name: string;
  phone: string;
  email: string;
  room_number: string;
  monthly_rent: number;
  electricity_units: number;
  electricity_bill: number;
  join_date: string;
  status: string;
}

interface Payment {
  id: number;
  billing_month: string;

  monthly_rent: number;
  electricity_units: number;
  electricity_bill: number;
  extra_bill: number;

  previous_due: number;
  current_amount: number;
  carry_forward_amount: number;
  total_amount: number;

  status: string;

  paid_at: string | null;
  created_at?: string | null;

  upi_id: string | null;
}

interface AvailableRoom {
  id: number;
  room_number: string;
  floor: number;
  room_type: string;
  capacity: number;
  monthly_rent: number;
  status: string;
}

interface RoomRequest {
  id: number;
  user_id: number;
  room_id: number;
  status: string;
  requested_at: string;
  responded_at: string | null;

  room_number?: string;
  monthly_rent?: number;
  floor?: number;
  room_type?: string;
  capacity?: number;
}

function Dashboard() {
  const navigate = useNavigate();

  const {
    showError,
  } = useModal();

  const [tenant, setTenant] =
    useState<TenantProfile | null>(null);

  const [currentPayment, setCurrentPayment] =
    useState<Payment | null>(null);

  const [paymentHistory, setPaymentHistory] =
    useState<Payment[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [availableRooms, setAvailableRooms] =
    useState<AvailableRoom[]>([]);

  const [roomRequest, setRoomRequest] =
    useState<RoomRequest | null>(null);

  const [roomRequestLoading, setRoomRequestLoading] =
    useState(false);

  const [roomRequestMessage, setRoomRequestMessage] =
    useState("");

  const [selectedRoomId, setSelectedRoomId] =
    useState<number | null>(null);

  const [paymentAcknowledged, setPaymentAcknowledged] =
    useState(false);

  const [copyFeedback, setCopyFeedback] =
    useState(false);

  useEffect(() => {
    const loggedUser =
      localStorage.getItem("user");

    if (!loggedUser) {
      navigate("/login", {
        replace: true,
      });

      return;
    }

    try {
      const currentUser =
        JSON.parse(loggedUser);

      if (!currentUser?.id) {
        throw new Error(
          "Invalid logged user"
        );
      }

      fetchTenant(currentUser.id);

    } catch (error) {
      console.error(error);

      localStorage.removeItem("user");

      navigate("/login", {
        replace: true,
      });
    }
  }, [navigate]);

  const fetchTenant = async (
    userId: number
  ) => {
    try {
      const response =
        await api.get(
          `/tenants/profile/${userId}`
        );

      setTenant(response.data);

      await fetchPayment(
        response.data.id
      );

    } catch (error) {
      console.error(
        "Tenant profile not found or room not allocated:",
        error
      );

      setTenant(null);
      setCurrentPayment(null);
      setPaymentHistory([]);

      await fetchRoomRequestData();

    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableRooms = async () => {
    try {
      const response =
        await api.get(
          "/room-requests/available-rooms"
        );

      setAvailableRooms(
        Array.isArray(response.data)
          ? response.data
          : []
      );

    } catch (error) {
      console.error(
        "Failed to fetch available rooms:",
        error
      );

      setAvailableRooms([]);
    }
  };

  const fetchMyRoomRequest = async () => {
    try {
      const response =
        await api.get(
          "/room-requests/my-request"
        );

      setRoomRequest(
        response.data
      );

    } catch (error: any) {
      if (
        error?.response?.status === 404
      ) {
        setRoomRequest(null);
      } else {
        console.error(
          "Failed to fetch room request:",
          error
        );
      }
    }
  };

  const fetchRoomRequestData = async () => {
    await Promise.all([
      fetchAvailableRooms(),
      fetchMyRoomRequest(),
    ]);
  };

  const handleRequestRoom = async (
    roomId: number
  ) => {
    setRoomRequestLoading(true);
    setRoomRequestMessage("");
    setSelectedRoomId(roomId);

    try {
      const response =
        await api.post(
          "/room-requests",
          {
            room_id: roomId,
          }
        );

      setRoomRequest(
        response.data
      );

      setRoomRequestMessage(
        "Room request submitted successfully."
      );

      setAvailableRooms([]);

    } catch (error: any) {
      console.error(
        "Failed to request room:",
        error
      );

      const detail =
        error?.response?.data?.detail;

      setRoomRequestMessage(
        detail ||
        "Unable to submit room request."
      );

      setSelectedRoomId(null);

      await fetchAvailableRooms();

    } finally {
      setRoomRequestLoading(false);
    }
  };

  const fetchPayment = async (
    tenantId: number
  ) => {
    try {
      const response =
        await api.get(
          `/payments/${tenantId}`
        );

      const payments: Payment[] =
        Array.isArray(response.data)
          ? response.data
          : [];

      const resolvedPayments =
        payments
          .filter((payment) =>
            RESOLVED_STATUSES.includes(
              String(
                payment.status
              ).toLowerCase()
            )
          )
          .sort((a, b) =>
            b.billing_month.localeCompare(
              a.billing_month
            )
          );

      setPaymentHistory(
        resolvedPayments
      );

      const owedPayments =
        payments
          .filter((payment) =>
            STILL_OWED_STATUSES.includes(
              String(
                payment.status
              ).toLowerCase()
            )
          )
          .sort((a, b) =>
            a.billing_month.localeCompare(
              b.billing_month
            )
          );

      const latestOwed =
        owedPayments.length > 0
          ? owedPayments[
              owedPayments.length - 1
            ]
          : null;

      setCurrentPayment(
        latestOwed
      );

      setPaymentAcknowledged(false);
      setCopyFeedback(false);

    } catch (error) {
      console.error(error);

      setCurrentPayment(null);
      setPaymentHistory([]);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("user");

    navigate("/login", {
      replace: true,
    });
  };

  const isIosDevice = () => {
    if (
      typeof navigator === "undefined"
    ) {
      return false;
    }

    return (
      /iPad|iPhone|iPod/.test(
        navigator.userAgent
      ) &&
      !(window as any).MSStream
    );
  };

  const resolveUpiId = (
    payment: Payment
  ) => {
    return payment.upi_id &&
      payment.upi_id.trim() !== ""
      ? payment.upi_id.trim()
      : "";
  };

  const buildUpiParams = (
    payment: Payment
  ) => {
    if (!tenant) {
      return null;
    }

    const upiId =
      resolveUpiId(payment);

    if (!upiId) {
      return null;
    }

    const amount =
      getTotalPayable(
        payment
      ).toFixed(2);

    const note =
      `Rent ${formatBillingMonth(
        payment.billing_month
      )} - ${tenant.full_name}`;

    return new URLSearchParams({
      pa: upiId,
      pn: OWNER_PAYEE_NAME,
      am: amount,
      cu: "INR",
      tn: note,
    });
  };

  const buildGpayDeepLink = (
    payment: Payment
  ) => {
    const params =
      buildUpiParams(payment);

    if (!params) {
      return "";
    }

    const scheme =
      isIosDevice()
        ? "gpay://upi/pay"
        : "upi://pay";

    return `${scheme}?${params.toString()}`;
  };

  const buildUpiQrValue = (
    payment: Payment
  ) => {
    const params =
      buildUpiParams(payment);

    if (!params) {
      return "";
    }

    return `upi://pay?${params.toString()}`;
  };

  const handleCopyPaymentDetails = async (
    payment: Payment
  ) => {
    if (!tenant) {
      return;
    }

    const amount =
      getTotalPayable(
        payment
      ).toFixed(2);

    const upiIdForBill =
      resolveUpiId(payment);

    if (!upiIdForBill) {
      showError(
        "UPI ID Not Available",
        "The owner has not configured a UPI ID for this bill yet. Please contact the owner."
      );
      return;
    }

    const details =
      `Pay ₹${amount} to UPI ID: ${upiIdForBill} ` +
      `(${OWNER_PAYEE_NAME})\n` +
      `Note: Rent ${formatBillingMonth(
        payment.billing_month
      )} - ${tenant.full_name}`;

    try {
      await navigator.clipboard.writeText(
        details
      );

      setCopyFeedback(true);

      window.setTimeout(
        () =>
          setCopyFeedback(false),
        2500
      );

    } catch (error) {
      console.error(
        "Failed to copy payment details",
        error
      );

      showError(
        "Copy Failed",
        details
      );
    }
  };

  const handleConfirmPaymentDone = () => {
    setPaymentAcknowledged(
      true
    );
  };

  const formatBillingMonth = (
    billingMonth: string
  ) => {
    if (!billingMonth) {
      return "N/A";
    }

    const [
      year,
      month,
    ] =
      billingMonth
        .split("-")
        .map(Number);

    const date =
      new Date(
        year,
        month - 1,
        1
      );

    return date.toLocaleString(
      "default",
      {
        month: "long",
        year: "numeric",
      }
    );
  };

  const formatPaidDate = (
    paidAt: string | null
  ) => {
    if (!paidAt) {
      return "N/A";
    }

    const date =
      new Date(paidAt);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "N/A";
    }

    return date.toLocaleDateString(
      "en-GB",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  };

  const getOwedStatusNote = (
    status: string
  ) => {
    switch (
      String(status).toLowerCase()
    ) {
      case "informed":
        return (
          "The owner has sent you a payment reminder for this bill."
        );

      case "partially_paid":
        return (
          "This bill is marked as partially paid. The amount below is what's still outstanding."
        );

      default:
        return null;
    }
  };

  const getHistoryStatusLabel = (
    status: string
  ) => {
    return (
      String(status).toLowerCase() ===
      "payment_closed"
    )
      ? "🔒 Closed"
      : "✓ Paid";
  };

  const getCurrentBillAmount = (
    payment: Payment
  ) => {
    const currentAmount =
      Number(
        payment.current_amount
      );

    if (
      !Number.isNaN(
        currentAmount
      ) &&
      currentAmount >= 0
    ) {
      return currentAmount;
    }

    return (
      Number(
        payment.monthly_rent || 0
      ) +
      Number(
        payment.electricity_bill || 0
      ) +
      Number(
        payment.extra_bill || 0
      )
    );
  };

  const getPreviousDue = (
    payment: Payment
  ) => {
    const carryForward =
      Number(
        payment.carry_forward_amount ||
        0
      );

    const previousDue =
      Number(
        payment.previous_due ||
        0
      );

    return Math.max(
      carryForward,
      previousDue
    );
  };

  const getTotalPayable = (
    payment: Payment
  ) => {
    const totalAmount =
      Number(
        payment.total_amount
      );

    if (
      !Number.isNaN(
        totalAmount
      ) &&
      totalAmount >= 0
    ) {
      return totalAmount;
    }

    return (
      getCurrentBillAmount(
        payment
      ) +
      getPreviousDue(
        payment
      )
    );
  };

  if (loading) {
    return (
      <div className="dashboard-loading">

        <div className="loading-spinner" />

        <h2>
          Loading your dashboard...
        </h2>

        <p>
          Please wait while we load your
          rental information.
        </p>

      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="dashboard-container">

        <header className="dashboard-navbar">

          <div className="dashboard-logo-section">

            <div className="dashboard-logo-icon">
              🏠
            </div>

            <div>
              <h2>
                RentEase
              </h2>

              <p>
                Tenant Dashboard
              </p>
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

              <div className="tenant-avatar">
                🏠
              </div>

              <div className="welcome-text">

                <p className="welcome-label">
                  Tenant Account
                </p>

                <h1>
                  Find Your Room 🏠
                </h1>

                <p>
                  You don't have a room allocated yet.
                  Choose an available room below.
                </p>

              </div>

            </div>

          </section>

          {roomRequest &&
          String(
            roomRequest.status
          ).toLowerCase() === "pending" ? (

            <section className="dashboard-card">

              <div className="section-header">

                <div>

                  <p className="section-label">
                    Room Allocation
                  </p>

                  <h2 className="section-title">
                    Room Request Pending
                  </h2>

                </div>

              </div>

              <div
                style={{
                  padding: "25px",
                  textAlign: "center",
                }}
              >

                <div
                  style={{
                    fontSize: "48px",
                    marginBottom: "12px",
                  }}
                >
                  ⏳
                </div>

                <h3
                  style={{
                    marginBottom: "8px",
                  }}
                >
                  Your room request is pending
                </h3>

                <p
                  style={{
                    color: "#64748b",
                    marginBottom: "20px",
                  }}
                >
                  The owner needs to approve your
                  room request before the room is
                  allocated to you.
                </p>

                <div
                  style={{
                    display: "inline-block",
                    padding: "16px 25px",
                    borderRadius: "12px",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    textAlign: "left",
                  }}
                >

                  <p
                    style={{
                      margin: "0 0 7px",
                    }}
                  >
                    <strong>
                      Request ID:
                    </strong>{" "}
                    {roomRequest.id}
                  </p>

                  <p
                    style={{
                      margin: "0 0 7px",
                    }}
                  >
                    <strong>
                      Room ID:
                    </strong>{" "}
                    {roomRequest.room_id}
                  </p>

                  <p
                    style={{
                      margin: 0,
                    }}
                  >
                    <strong>
                      Status:
                    </strong>{" "}
                    Pending
                  </p>

                </div>

                {roomRequestMessage && (
                  <p
                    style={{
                      marginTop: "18px",
                      color: "#166534",
                      fontWeight: 600,
                    }}
                  >
                    {roomRequestMessage}
                  </p>
                )}

              </div>

            </section>

          ) : (

            <section className="dashboard-card">

              <div className="section-header">

                <div>

                  <p className="section-label">
                    Available Accommodation
                  </p>

                  <h2 className="section-title">
                    Available Rooms
                  </h2>

                </div>

              </div>

              {roomRequestMessage && (
                <div
                  style={{
                    margin: "0 20px 20px",
                    padding: "12px 15px",
                    borderRadius: "10px",
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    color: "#166534",
                    fontSize: "14px",
                  }}
                >
                  {roomRequestMessage}
                </div>
              )}

              {availableRooms.length === 0 ? (

                <div
                  style={{
                    padding: "40px 20px",
                    textAlign: "center",
                  }}
                >

                  <div
                    style={{
                      fontSize: "48px",
                      marginBottom: "10px",
                    }}
                  >
                    🏠
                  </div>

                  <h3>
                    No Rooms Available
                  </h3>

                  <p
                    style={{
                      color: "#64748b",
                    }}
                  >
                    There are currently no vacant
                    rooms available.
                  </p>

                </div>

              ) : (

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(280px, 1fr))",
                    gap: "18px",
                    padding: "10px 20px 25px",
                  }}
                >

                  {availableRooms.map(
                    (room) => (

                      <div
                        key={room.id}
                        style={{
                          border:
                            "1px solid #e2e8f0",
                          borderRadius: "14px",
                          padding: "20px",
                          background: "#ffffff",
                        }}
                      >

                        <div
                          style={{
                            fontSize: "35px",
                            marginBottom: "10px",
                          }}
                        >
                          🏠
                        </div>

                        <h3
                          style={{
                            margin: "0 0 16px",
                          }}
                        >
                          Room {room.room_number}
                        </h3>

                        <div
                          style={{
                            display: "grid",
                            gap: "10px",
                            marginBottom: "18px",
                          }}
                        >

                          <p
                            style={{
                              margin: 0,
                              color: "#64748b",
                            }}
                          >
                            Room Type:{" "}
                            <strong
                              style={{
                                color: "#0f172a",
                              }}
                            >
                              {room.room_type}
                            </strong>
                          </p>

                          <p
                            style={{
                              margin: 0,
                              color: "#64748b",
                            }}
                          >
                            Floor:{" "}
                            <strong
                              style={{
                                color: "#0f172a",
                              }}
                            >
                              {room.floor}
                            </strong>
                          </p>

                          <p
                            style={{
                              margin: 0,
                              color: "#64748b",
                            }}
                          >
                            Capacity:{" "}
                            <strong
                              style={{
                                color: "#0f172a",
                              }}
                            >
                              {room.capacity}{" "}
                              {Number(room.capacity) === 1
                                ? "Person"
                                : "People"}
                            </strong>
                          </p>

                          <p
                            style={{
                              margin: 0,
                              color: "#64748b",
                            }}
                          >
                            Monthly Rent:{" "}
                            <strong
                              style={{
                                color: "#0f172a",
                              }}
                            >
                              ₹
                              {Number(
                                room.monthly_rent
                              ).toLocaleString(
                                "en-IN"
                              )}
                            </strong>
                          </p>

                          <p
                            style={{
                              margin: 0,
                              color: "#64748b",
                            }}
                          >
                            Status:{" "}
                            <strong
                              style={{
                                color: "#166534",
                              }}
                            >
                              {room.status}
                            </strong>
                          </p>

                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            handleRequestRoom(
                              room.id
                            )
                          }
                          disabled={
                            roomRequestLoading &&
                            selectedRoomId ===
                              room.id
                          }
                          style={{
                            width: "100%",
                            padding:
                              "11px 15px",
                            border: "none",
                            borderRadius: "9px",
                            cursor:
                              roomRequestLoading &&
                              selectedRoomId ===
                                room.id
                                ? "not-allowed"
                                : "pointer",
                            fontWeight: 600,
                            background:
                              "#2563eb",
                            color: "#ffffff",
                            opacity:
                              roomRequestLoading &&
                              selectedRoomId ===
                                room.id
                                ? 0.7
                                : 1,
                          }}
                        >
                          {roomRequestLoading &&
                          selectedRoomId ===
                            room.id
                            ? "Requesting..."
                            : "Request This Room"}
                        </button>

                      </div>

                    )
                  )}

                </div>

              )}

            </section>

          )}

        </main>

      </div>
    );
  }

  const joinDate =
    new Date(
      tenant.join_date
    );

  let dueDate: Date;

  if (currentPayment) {

    const [
      year,
      month,
    ] =
      currentPayment.billing_month
        .split("-")
        .map(Number);

    dueDate =
      new Date(
        year,
        month - 1,
        joinDate.getDate()
      );

  } else {

    dueDate =
      new Date(
        joinDate
      );

    dueDate.setMonth(
      dueDate.getMonth() + 1
    );
  }

  const dateFormatOptions:
    Intl.DateTimeFormatOptions = {

    day: "2-digit",
    month: "long",
    year: "numeric",
  };

  const formattedJoinDate =
    joinDate.toLocaleDateString(
      "en-GB",
      dateFormatOptions
    );

  const formattedDueDate =
    dueDate.toLocaleDateString(
      "en-GB",
      dateFormatOptions
    );

  const initials =
    tenant.full_name
      .split(" ")
      .filter(Boolean)
      .map(
        (name) =>
          name[0]
      )
      .join("")
      .slice(0, 2)
      .toUpperCase();

  const totalDue =
    currentPayment
      ? getTotalPayable(
          currentPayment
        )
      : 0;

  const previousDue =
    currentPayment
      ? getPreviousDue(
          currentPayment
        )
      : 0;

  const electricityBill =
    Number(
      tenant.electricity_bill || 0
    );

  const monthlyRent =
    Number(
      tenant.monthly_rent || 0
    );

  const electricityUnits =
    Number(
      tenant.electricity_units || 0
    );

  const isActive =
    String(
      tenant.status
    ).toLowerCase() ===
    "active";

  const gpayDeepLink =
    currentPayment
      ? buildGpayDeepLink(
          currentPayment
        )
      : "";

  const upiQrValue =
    currentPayment
      ? buildUpiQrValue(
          currentPayment
        )
      : "";

  const owedStatusNote =
    currentPayment
      ? getOwedStatusNote(
          currentPayment.status
        )
      : null;

  const hasUpiId =
    currentPayment
      ? Boolean(
          resolveUpiId(
            currentPayment
          )
        )
      : false;

  return (
    <div className="dashboard-container">

      <header className="dashboard-navbar">

        <div className="dashboard-logo-section">

          <div className="dashboard-logo-icon">
            🏠
          </div>

          <div>

            <h2>
              RentEase
            </h2>

            <p>
              Tenant Dashboard
            </p>

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

            <div className="tenant-avatar">
              {initials}
            </div>

            <div className="welcome-text">

              <p className="welcome-label">
                Tenant Account
              </p>

              <h1>
                Welcome,{" "}
                <span>
                  {tenant.full_name}
                </span>{" "}
                👋
              </h1>

              <p>
                Your rental information and
                payment details are shown below.
              </p>

            </div>

          </div>

          <div
            className={`status-badge ${
              isActive
                ? "status-active"
                : "status-inactive"
            }`}
          >

            <span className="status-dot" />

            {tenant.status}

          </div>

        </section>

        <section className="dashboard-card">

          <div className="section-header">

            <div>

              <p className="section-label">
                Your Accommodation
              </p>

              <h2 className="section-title">
                Rental Details
              </h2>

            </div>

          </div>

          <div className="info-grid">

            <div className="info-box">

              <div className="info-icon blue-icon">
                🏠
              </div>

              <div>

                <span>
                  Room Number
                </span>

                <strong>
                  {tenant.room_number}
                </strong>

              </div>

            </div>

            <div className="info-box">

              <div className="info-icon green-icon">
                ₹
              </div>

              <div>

                <span>
                  Monthly Rent
                </span>

                <strong>
                  ₹
                  {monthlyRent.toLocaleString(
                    "en-IN"
                  )}
                </strong>

              </div>

            </div>

            <div className="info-box">

              <div className="info-icon purple-icon">
                📅
              </div>

              <div>

                <span>
                  Joined On
                </span>

                <strong>
                  {formattedJoinDate}
                </strong>

              </div>

            </div>

            <div className="info-box">

              <div className="info-icon blue-icon">
                ✓
              </div>

              <div>

                <span>
                  Account Status
                </span>

                <strong className="active-text">
                  {tenant.status}
                </strong>

              </div>

            </div>

          </div>

        </section>

        <section className="dashboard-card">

          <div className="section-header">

            <div>

              <p className="section-label">
                Billing
              </p>

              <h2 className="section-title">
                Payment Information
              </h2>

            </div>

          </div>

          <div className="payment-card">

            <div className="payment-card-header">

              <div>

                <p>
                  Current Billing
                </p>

                <h3>
                  Payment Summary
                </h3>

              </div>

              <div className="payment-icon">
                ₹
              </div>

            </div>

            <div className="payment-details">

              <div className="payment-row">

                <span>
                  Monthly Rent
                </span>

                <strong>
                  ₹
                  {monthlyRent.toLocaleString(
                    "en-IN"
                  )}
                </strong>

              </div>

              <div className="payment-row">

                <span>
                  Electricity Units
                </span>

                <strong>

                  {currentPayment
                    ? currentPayment.electricity_units
                    : electricityUnits}

                  {" "}Units

                </strong>

              </div>

              <div className="payment-row">

                <span>
                  Electricity Bill
                </span>

                <strong>

                  ₹
                  {(
                    currentPayment
                      ? Number(
                          currentPayment
                            .electricity_bill || 0
                        )
                      : electricityBill
                  ).toLocaleString(
                    "en-IN"
                  )}

                </strong>

              </div>

              {currentPayment &&
              Number(
                currentPayment.extra_bill || 0
              ) > 0 && (

                <div className="payment-row">

                  <span>
                    Extra Bill
                  </span>

                  <strong>
                    ₹
                    {Number(
                      currentPayment.extra_bill || 0
                    ).toLocaleString(
                      "en-IN"
                    )}
                  </strong>

                </div>

              )}

              {currentPayment &&
              previousDue > 0 && (

                <div className="payment-row previous-due-row">

                  <span>
                    Previous Due
                  </span>

                  <strong>
                    ₹
                    {previousDue.toLocaleString(
                      "en-IN"
                    )}
                  </strong>

                </div>

              )}

            </div>

            <div className="payment-total">

              <div>

                <span>
                  Total Amount To Pay
                </span>

                {currentPayment && (

                  <small>
                    {formatBillingMonth(
                      currentPayment.billing_month
                    )}
                  </small>

                )}

              </div>

              <strong>
                ₹
                {totalDue.toLocaleString(
                  "en-IN"
                )}
              </strong>

            </div>

            <div className="due-date">

              <span>
                Due Date
              </span>

              <strong>
                {formattedDueDate}
              </strong>

            </div>

            {currentPayment && (

              <div
                style={{
                  margin:
                    "12px 18px",
                  padding:
                    "12px 14px",
                  borderRadius:
                    "10px",
                  background:
                    "#f8fafc",
                  border:
                    "1px solid #e2e8f0",
                }}
              >

                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "space-between",
                    alignItems:
                      "center",
                    gap: "12px",
                  }}
                >

                  <span
                    style={{
                      fontSize:
                        "13px",
                      color:
                        "#64748b",
                    }}
                  >
                    UPI ID
                  </span>

                  <strong
                    style={{
                      fontSize:
                        "14px",
                      color:
                        hasUpiId
                          ? "#0f172a"
                          : "#dc2626",
                      wordBreak:
                        "break-all",
                    }}
                  >
                    {hasUpiId
                      ? resolveUpiId(
                          currentPayment
                        )
                      : "Not configured"}
                  </strong>

                </div>

              </div>

            )}

            {currentPayment &&
            owedStatusNote && (

              <div
                style={{
                  margin:
                    "2px 18px 14px",
                  padding:
                    "10px 14px",
                  borderRadius:
                    "10px",
                  background:
                    "#fffbeb",
                  border:
                    "1px solid #fde68a",
                  color:
                    "#92400e",
                  fontSize:
                    "12.5px",
                }}
              >
                ℹ️{" "}
                {owedStatusNote}
              </div>

            )}

            {!currentPayment ? (

              <div className="payment-message payment-empty">

                <div className="message-icon">
                  📄
                </div>

                <div>

                  <h3>
                    No Bills Generated
                  </h3>

                  <p>
                    There is no payment due
                    at the moment.
                  </p>

                </div>

              </div>

            ) : paymentAcknowledged ? (

              <div className="payment-message payment-success">

                <div className="message-icon">
                  ✓
                </div>

                <div>

                  <h3>
                    Payment Successful
                  </h3>

                  <p>
                    Thanks! We've noted that you've
                    completed this payment via GPay.
                    The owner will confirm and close
                    this bill shortly - your Payment
                    History will update once that happens.
                  </p>

                </div>

              </div>

            ) : !hasUpiId ? (

              <div className="payment-message payment-empty">

                <div className="message-icon">
                  ℹ️
                </div>

                <div>

                  <h3>
                    Online Payment Unavailable
                  </h3>

                  <p>
                    The owner has not configured a UPI
                    ID for this bill yet. Please contact
                    the owner to complete the payment.
                  </p>

                </div>

              </div>

            ) : (

              <div className="gpay-payment-options">

                <a
                  href={gpayDeepLink}
                  className="pay-now-btn"
                  style={{
                    textDecoration:
                      "none",
                  }}
                >

                  <span>
                    📲
                  </span>

                  Pay ₹
                  {totalDue.toLocaleString(
                    "en-IN"
                  )}{" "}
                  via GPay

                </a>

                <div className="gpay-divider">
                  <span>
                    or
                  </span>
                </div>

                <div className="gpay-qr-block">

                  <div className="gpay-qr-wrapper">

                    <QRCodeSVG
                      value={
                        upiQrValue
                      }
                      size={168}
                      level="M"
                    />

                  </div>

                  <p className="gpay-qr-caption">

                    Scan with GPay
                    (or any UPI app) →{" "}

                    <strong>
                      Scan any QR code
                    </strong>

                  </p>

                </div>

                <div className="gpay-divider">
                  <span>
                    or
                  </span>
                </div>

                <button
                  type="button"
                  className="gpay-copy-btn"
                  onClick={() =>
                    currentPayment &&
                    handleCopyPaymentDetails(
                      currentPayment
                    )
                  }
                >

                  {copyFeedback
                    ? "✓ Copied to clipboard"
                    : "📋 Copy UPI ID & Amount"}

                </button>

                <p className="gpay-copy-hint">

                  Paste this into GPay's
                  "Pay UPI ID" screen if
                  the button or QR code
                  above doesn't work.

                </p>

                <button
                  type="button"
                  className="gpay-confirm-btn"
                  onClick={
                    handleConfirmPaymentDone
                  }
                >

                  ✓ I've Completed the Payment

                </button>

              </div>

            )}

          </div>

        </section>

        <section className="dashboard-card tenant-payment-history">

          <div className="section-header">

            <div>

              <p className="section-label">
                Transactions
              </p>

              <h2 className="section-title">
                Payment History
              </h2>

            </div>

            {paymentHistory.length > 0 && (

              <span className="tenant-history-count">

                {paymentHistory.length}{" "}

                {paymentHistory.length === 1
                  ? "payment"
                  : "payments"}

              </span>

            )}

          </div>

          {paymentHistory.length === 0 ? (

            <div className="tenant-history-empty">

              <div className="tenant-history-empty-icon">
                💳
              </div>

              <div>

                <strong>
                  No payment history
                </strong>

                <p>
                  Payments the owner has
                  closed out will appear here.
                </p>

              </div>

            </div>

          ) : (

            <div className="tenant-payment-history-list">

              {paymentHistory.map(
                (payment) => {

                  const currentBill =
                    getCurrentBillAmount(
                      payment
                    );

                  const previousDueForRow =
                    getPreviousDue(
                      payment
                    );

                  const totalSettled =
                    getTotalPayable(
                      payment
                    );

                  const hasPreviousDue =
                    previousDueForRow > 0;

                  return (

                    <div
                      className="tenant-payment-history-row"
                      key={payment.id}
                    >

                      <div className="tenant-history-month-wrapper">

                        <div className="tenant-history-month-icon">
                          ✓
                        </div>

                        <div>

                          <span className="tenant-history-label">
                            Billing Month
                          </span>

                          <strong className="tenant-history-month">
                            {formatBillingMonth(
                              payment.billing_month
                            )}
                          </strong>

                        </div>

                      </div>

                      <div className="tenant-history-amount-wrapper">

                        <span className="tenant-history-label">
                          Current Bill
                        </span>

                        <strong className="tenant-history-amount">

                          ₹
                          {currentBill.toLocaleString(
                            "en-IN"
                          )}

                        </strong>

                      </div>

                      <div className="tenant-history-date-wrapper">

                        {hasPreviousDue ? (

                          <>

                            <span className="tenant-history-label">
                              Previous Due
                            </span>

                            <span className="tenant-history-date">

                              ₹
                              {previousDueForRow.toLocaleString(
                                "en-IN"
                              )}

                            </span>

                          </>

                        ) : (

                          <>

                            <span className="tenant-history-label">
                              Paid On
                            </span>

                            <span className="tenant-history-date">

                              {formatPaidDate(
                                payment.paid_at
                              )}

                            </span>

                          </>

                        )}

                      </div>

                      <span className="tenant-history-status">

                        {getHistoryStatusLabel(
                          payment.status
                        )}

                      </span>

                      {hasPreviousDue && (

                        <div
                          className="tenant-history-breakdown"
                          style={{
                            width: "100%",
                            marginTop: "12px",
                            padding:
                              "12px 14px",
                            borderRadius:
                              "10px",
                            background:
                              "#f8fafc",
                            border:
                              "1px solid #e2e8f0",
                            fontSize:
                              "13px",
                          }}
                        >

                          <div
                            style={{
                              display:
                                "flex",
                              justifyContent:
                                "space-between",
                              marginBottom:
                                "5px",
                            }}
                          >

                            <span>
                              Current bill
                            </span>

                            <strong>
                              ₹
                              {currentBill.toLocaleString(
                                "en-IN"
                              )}
                            </strong>

                          </div>

                          <div
                            style={{
                              display:
                                "flex",
                              justifyContent:
                                "space-between",
                              marginBottom:
                                "5px",
                            }}
                          >

                            <span>
                              Previous due
                            </span>

                            <strong>
                              ₹
                              {previousDueForRow.toLocaleString(
                                "en-IN"
                              )}
                            </strong>

                          </div>

                          <div
                            style={{
                              display:
                                "flex",
                              justifyContent:
                                "space-between",
                              paddingTop:
                                "7px",
                              borderTop:
                                "1px solid #e2e8f0",
                              fontWeight: 700,
                            }}
                          >

                            <span>
                              Total settled
                            </span>

                            <strong>
                              ₹
                              {totalSettled.toLocaleString(
                                "en-IN"
                              )}
                            </strong>

                          </div>

                          <p
                            style={{
                              margin:
                                "8px 0 0",
                              color:
                                "#64748b",
                              fontSize:
                                "12px",
                            }}
                          >

                            This payment included
                            the previous outstanding
                            amount.

                          </p>

                        </div>

                      )}

                    </div>
                  );
                }
              )}

            </div>

          )}

        </section>

        <section className="dashboard-card">

          <div className="section-header">

            <div>

              <p className="section-label">
                Account
              </p>

              <h2 className="section-title">
                Contact Information
              </h2>

            </div>

          </div>

          <div className="info-grid contact-grid">

            <div className="info-box">

              <div className="info-icon blue-icon">
                👤
              </div>

              <div>

                <span>
                  Name
                </span>

                <strong>
                  {tenant.full_name}
                </strong>

              </div>

            </div>

            <div className="info-box">

              <div className="info-icon green-icon">
                ☎
              </div>

              <div>

                <span>
                  Phone
                </span>

                <strong>
                  {tenant.phone}
                </strong>

              </div>

            </div>

            <div className="info-box contact-email">

              <div className="info-icon purple-icon">
                @
              </div>

              <div>

                <span>
                  Email
                </span>

                <strong>
                  {tenant.email}
                </strong>

              </div>

            </div>

          </div>

        </section>

      </main>

      <AIChatbot />

    </div>
  );
}

export default Dashboard;