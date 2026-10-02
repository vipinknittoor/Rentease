import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import api from "../api/axios";
import AIChatbot from "../components/AIChatbot";
import PageNav from "../components/PageNav";
import { useModal } from "../context/ModalContext";

import "./Dashboard.css";

interface PaymentHistory {
  payment_id: number;
  tenant_name: string;
  room_number: string;
  billing_month: string;
  extra_bill: number;
  total_amount: number;
  status: string;
}

const REMINDER_ELIGIBLE_STATUSES = ["pending", "informed"];

const STATUS_UPDATE_ELIGIBLE_STATUSES = [
  "pending",
  "informed",
  "partially_paid",
];

const OPEN_STATUSES = [
  "pending",
  "informed",
  "partially_paid",
];

const SUMMARY_STYLES = `
.rp-summary-trigger {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 18px 10px 16px;
  border-radius: 14px;
  border: none;
  background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
  color: #fff;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  font-family: inherit;
}

.rp-summary-trigger:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(79, 70, 229, 0.45);
}

.rp-summary-trigger:active {
  transform: translateY(0);
  box-shadow: 0 3px 10px rgba(79, 70, 229, 0.35);
}

.rp-summary-trigger-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.18);
  font-size: 16px;
  flex-shrink: 0;
}

.rp-summary-trigger-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1.15;
}

.rp-summary-trigger-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  opacity: 0.85;
}

.rp-summary-trigger-value {
  font-size: 16px;
  font-weight: 700;
}

.rp-summary-trigger-chevron {
  font-size: 13px;
  opacity: 0.8;
  margin-left: 2px;
}

.rp-summary-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 15, 25, 0.45);
  backdrop-filter: blur(2px);
  z-index: 40;
  animation: rp-fade-in 0.18s ease;
}

.rp-summary-drawer {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: min(360px, 90vw);
  background: #fff;
  box-shadow: 4px 0 32px rgba(0, 0, 0, 0.22);
  z-index: 41;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  animation: rp-slide-in 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes rp-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes rp-slide-in {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}

.rp-summary-drawer-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 22px 20px 16px;
  border-bottom: 1px solid #f0f0f2;
  position: sticky;
  top: 0;
  background: #fff;
  z-index: 1;
}

.rp-summary-eyebrow {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #9ca3af;
  margin: 0 0 4px;
}

.rp-summary-heading {
  font-size: 19px;
  font-weight: 700;
  color: #111827;
  margin: 0;
}

.rp-summary-month-chip {
  display: inline-block;
  margin-top: 8px;
  padding: 4px 10px;
  border-radius: 999px;
  background: #eef2ff;
  color: #4338ca;
  font-size: 12px;
  font-weight: 600;
}

.rp-summary-close-icon {
  border: none;
  background: #f3f4f6;
  color: #6b7280;
  width: 30px;
  height: 30px;
  border-radius: 999px;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s ease, color 0.15s ease;
}

.rp-summary-close-icon:hover {
  background: #e5e7eb;
  color: #111827;
}

.rp-summary-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
}

.rp-summary-stat-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  border-radius: 14px;
  border: 1px solid #f0f0f2;
  background: #fafafa;
}

.rp-summary-stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  font-size: 18px;
  font-weight: 700;
  flex-shrink: 0;
}

.rp-summary-stat-icon.tone-green { background: #dcfce7; color: #16a34a; }
.rp-summary-stat-icon.tone-amber { background: #fef3c7; color: #d97706; }
.rp-summary-stat-icon.tone-blue { background: #dbeafe; color: #2563eb; }
.rp-summary-stat-icon.tone-purple { background: #ede9fe; color: #7c3aed; }

.rp-summary-stat-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.rp-summary-stat-label {
  font-size: 12px;
  color: #6b7280;
  font-weight: 500;
}

.rp-summary-stat-value {
  font-size: 18px;
  font-weight: 700;
  color: #111827;
}

.rp-summary-stat-description {
  font-size: 11px;
  color: #9ca3af;
}

.rp-summary-total-bills {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-radius: 14px;
  background: #111827;
  color: #fff;
  margin-top: 4px;
}

.rp-summary-total-bills span {
  font-size: 12px;
  opacity: 0.75;
}

.rp-summary-total-bills strong {
  font-size: 18px;
}

.rp-summary-footer {
  padding: 16px 20px 20px;
  border-top: 1px solid #f0f0f2;
  position: sticky;
  bottom: 0;
  background: #fff;
}

.rp-summary-cancel-btn {
  width: 100%;
  padding: 12px 16px;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #374151;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.rp-summary-cancel-btn:hover {
  background: #f9fafb;
  border-color: #d1d5db;
}
`;

function Payments() {
  const navigate = useNavigate();

  const {
    showSuccess,
    showError,
    showWarning,
    showConfirm,
  } = useModal();

  const [payments, setPayments] = useState<PaymentHistory[]>([]);
  const [selectedMonth, setSelectedMonth] = useState("");

  const [editingPaymentId, setEditingPaymentId] =
    useState<number | null>(null);

  const [editAmount, setEditAmount] = useState("");

  const [savingEdit, setSavingEdit] = useState(false);

  const [sendingReminderId, setSendingReminderId] =
    useState<number | null>(null);

  const [updatingStatusId, setUpdatingStatusId] =
    useState<number | null>(null);

  const [deletingPaymentId, setDeletingPaymentId] =
    useState<number | null>(null);

  const [deletingBills, setDeletingBills] =
    useState(false);

  const [isSummaryOpen, setIsSummaryOpen] =
    useState(false);

  useEffect(() => {
    if (!isSummaryOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsSummaryOpen(false);
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () =>
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
  }, [isSummaryOpen]);

  useEffect(() => {
    const user = localStorage.getItem("user");

    if (!user) {
      navigate("/login", { replace: true });
      return;
    }

    try {
      const parsedUser = JSON.parse(user);

      if (parsedUser.role !== "owner") {
        navigate("/dashboard", {
          replace: true,
        });

        return;
      }

      fetchPayments();
    } catch (error) {
      console.error(
        "Invalid user session",
        error
      );

      localStorage.removeItem("user");

      navigate("/login", {
        replace: true,
      });
    }
  }, [navigate]);

  const fetchPayments = async () => {
    try {
      const response = await api.get(
        "/dashboard/payment-history"
      );

      setPayments(
        Array.isArray(
          response.data?.payments
        )
          ? response.data.payments
          : []
      );
    } catch (error) {
      console.error(
        "Failed to load payments",
        error
      );

      setPayments([]);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("user");

    navigate("/login", {
      replace: true,
    });
  };

  const formatStatusLabel = (
    status: string
  ) =>
    status
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) =>
        c.toUpperCase()
      );

  const getStatusMeta = (
    status: string
  ) => {
    switch (
      status.toLowerCase()
    ) {
      case "paid":
        return {
          label: "Paid",
          icon: "✓",
          className: "status-paid",
        };

      case "informed":
        return {
          label: "Informed",
          icon: "↗",
          className: "status-informed",
        };

      case "partially_paid":
        return {
          label: "Partially Paid",
          icon: "◐",
          className: "status-partial",
        };

      case "payment_closed":
        return {
          label: "Closed",
          icon: "✓",
          className: "status-closed",
        };

      default:
        return {
          label: "Pending",
          icon: "!",
          className: "status-pending",
        };
    }
  };

  const formatCurrency = (
    amount: number
  ) => {
    return `₹${Number(
      amount || 0
    ).toLocaleString("en-IN")}`;
  };

  const formatBillingMonth = (
    billingMonth: string
  ) => {
    const [year, month] =
      billingMonth
        .split("-")
        .map(Number);

    const date = new Date(
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

  const latestGeneratedMonth =
    payments.length > 0
      ? payments.reduce(
          (latest, payment) =>
            payment.billing_month >
            latest
              ? payment.billing_month
              : latest,
          payments[0]
            .billing_month
        )
      : null;

  const latestUnpaidByTenant: Record<
    string,
    string
  > = payments.reduce(
    (
      acc: Record<string, string>,
      payment
    ) => {
      if (
        !OPEN_STATUSES.includes(
          payment.status.toLowerCase()
        )
      ) {
        return acc;
      }

      if (
        !acc[payment.tenant_name] ||
        payment.billing_month >
          acc[payment.tenant_name]
      ) {
        acc[payment.tenant_name] =
          payment.billing_month;
      }

      return acc;
    },
    {}
  );

  const isLatestUnpaidForTenant = (
    payment: PaymentHistory
  ) => {
    if (
      !OPEN_STATUSES.includes(
        payment.status.toLowerCase()
      )
    ) {
      return false;
    }

    return (
      latestUnpaidByTenant[
        payment.tenant_name
      ] ===
      payment.billing_month
    );
  };

  const canEditPayment = (
    payment: PaymentHistory
  ) => {
    return (
      latestGeneratedMonth !== null &&
      payment.billing_month ===
        latestGeneratedMonth &&
      payment.status.toLowerCase() !==
        "paid" &&
      payment.status.toLowerCase() !==
        "payment_closed"
    );
  };

  const isReminderEligible = (
    payment: PaymentHistory
  ) => {
    return (
      REMINDER_ELIGIBLE_STATUSES.includes(
        payment.status.toLowerCase()
      ) &&
      Number(
        payment.total_amount || 0
      ) > 0 &&
      isLatestUnpaidForTenant(
        payment
      )
    );
  };

  const isStatusUpdateEligible = (
    payment: PaymentHistory
  ) => {
    return (
      STATUS_UPDATE_ELIGIBLE_STATUSES.includes(
        payment.status.toLowerCase()
      ) &&
      isLatestUnpaidForTenant(
        payment
      )
    );
  };

  const startEditing = (
    payment: PaymentHistory
  ) => {
    if (!canEditPayment(payment)) {
      return;
    }

    setEditingPaymentId(
      payment.payment_id
    );

    setEditAmount(
      String(
        Number(
          payment.total_amount || 0
        )
      )
    );
  };

  const cancelEditing = () => {
    setEditingPaymentId(null);
    setEditAmount("");
  };

  const saveEditedAmount = async (
    payment: PaymentHistory
  ) => {
    if (!canEditPayment(payment)) {
      showWarning(
        "Editing Not Allowed",
        "Only the latest pending bill can be edited."
      );

      return;
    }

    const numericAmount =
      Number(editAmount);

    if (
      !editAmount.trim() ||
      !Number.isFinite(
        numericAmount
      ) ||
      numericAmount <= 0
    ) {
      showWarning(
        "Invalid Amount",
        "Please enter a valid amount greater than zero."
      );

      return;
    }

    try {
      setSavingEdit(true);

      await api.put(
        `/payments/edit/${payment.payment_id}`,
        {
          amount: numericAmount,
        }
      );

      showSuccess(
        "Bill Updated",
        `${payment.tenant_name}'s bill amount updated successfully.`
      );

      cancelEditing();

      await fetchPayments();
    } catch (error: any) {
      console.error(
        "Failed to update payment amount",
        error
      );

      showError(
        "Update Failed",
        error.response?.data?.detail ||
          "Failed to update the bill amount."
      );
    } finally {
      setSavingEdit(false);
    }
  };

  const sendWhatsAppReminder = async (
    payment: PaymentHistory
  ) => {
    if (sendingReminderId !== null) {
      return;
    }

    if (
      !isReminderEligible(payment)
    ) {
      showWarning(
        "Reminder Not Allowed",
        "Only the tenant's most recent pending bill can be reminded."
      );

      return;
    }

    try {
      setSendingReminderId(
        payment.payment_id
      );

      const response =
        await api.post(
          `/payments/whatsapp-reminder/${payment.payment_id}`
        );

      const whatsappLink =
        response.data?.whatsapp_link;

      if (whatsappLink) {
        window.open(
          whatsappLink,
          "_blank",
          "noopener,noreferrer"
        );
      }

      await fetchPayments();
    } catch (error: any) {
      console.error(
        "Failed to send WhatsApp reminder",
        error
      );

      showError(
        "Reminder Failed",
        error.response?.data?.detail ||
          "Failed to send WhatsApp reminder."
      );
    } finally {
      setSendingReminderId(null);
    }
  };

  const updatePaymentStatus =
    async (
      payment: PaymentHistory,
      newStatus: string
    ) => {
      if (
        !newStatus ||
        updatingStatusId !== null
      ) {
        return;
      }

      const confirmChange =
        await showConfirm(
          "Update Payment Status",
          `Update ${payment.tenant_name}'s bill status to "${formatStatusLabel(
            newStatus
          )}"?`,
          {
            confirmText: "Update",
            cancelText: "Cancel",
          }
        );

      if (!confirmChange) {
        return;
      }

      try {
        setUpdatingStatusId(
          payment.payment_id
        );

        await api.put(
          `/payments/status/${payment.payment_id}`,
          {
            status: newStatus,
          }
        );

        await fetchPayments();

        showSuccess(
          "Status Updated",
          `${payment.tenant_name}'s bill status was updated to "${formatStatusLabel(
            newStatus
          )}".`
        );
      } catch (error: any) {
        console.error(
          "Failed to update payment status",
          error
        );

        showError(
          "Status Update Failed",
          error.response?.data?.detail ||
            "Failed to update payment status."
        );
      } finally {
        setUpdatingStatusId(
          null
        );
      }
    };

  const deleteIndividualBill =
    async (
      payment: PaymentHistory
    ) => {
      const confirmDelete =
        await showConfirm(
          "Delete Bill",
          `Are you sure you want to delete the bill for ${payment.tenant_name} for ${formatBillingMonth(
            payment.billing_month
          )}?`,
          {
            confirmText: "Delete",
            cancelText: "Cancel",
          }
        );

      if (!confirmDelete) {
        return;
      }

      try {
        setDeletingPaymentId(
          payment.payment_id
        );

        await api.delete(
          `/payments/delete/${payment.payment_id}`
        );

        showSuccess(
          "Bill Deleted",
          `${payment.tenant_name}'s bill deleted successfully.`
        );

        await fetchPayments();
      } catch (error: any) {
        console.error(
          "Failed to delete individual bill",
          error
        );

        showError(
          "Delete Failed",
          error.response?.data?.detail ||
            "Failed to delete the bill."
        );
      } finally {
        setDeletingPaymentId(
          null
        );
      }
    };

  const deleteBills = async () => {
    if (deletingBills) {
      return;
    }

    if (!selectedMonth) {
      const confirmDelete =
        await showConfirm(
          "Delete All Bills",
          "Are you sure you want to delete ALL bills from all months?\n\nThis cannot be undone.",
          {
            confirmText: "Delete All",
            cancelText: "Cancel",
          }
        );

      if (!confirmDelete) {
        return;
      }

      try {
        setDeletingBills(true);

        const response =
          await api.delete(
            "/payments/delete-all"
          );

        showSuccess(
          "Bills Deleted",
          response.data?.message ||
            "All bills deleted successfully."
        );

        setSelectedMonth("");

        await fetchPayments();
      } catch (error: any) {
        console.error(
          "Failed to delete all bills",
          error
        );

        showError(
          "Delete Failed",
          error.response?.data?.detail ||
            "Failed to delete all bills."
        );
      } finally {
        setDeletingBills(false);
      }

      return;
    }

    const confirmDelete =
      await showConfirm(
        "Delete Month Bills",
        `Are you sure you want to delete ALL bills for ${formatBillingMonth(
          selectedMonth
        )}?\n\nThis cannot be undone.`,
        {
          confirmText: "Delete Month",
          cancelText: "Cancel",
        }
      );

    if (!confirmDelete) {
      return;
    }

    try {
      setDeletingBills(true);

      const response =
        await api.delete(
          `/payments/delete-bills/${selectedMonth}`
        );

      showSuccess(
        "Bills Deleted",
        response.data?.message ||
          `All bills for ${selectedMonth} deleted successfully.`
      );

      setSelectedMonth("");

      await fetchPayments();
    } catch (error: any) {
      console.error(
        "Failed to delete bills",
        error
      );

      showError(
        "Delete Failed",
        error.response?.data?.detail ||
          "Failed to delete bills."
      );
    } finally {
      setDeletingBills(false);
    }
  };

  const filteredPayments =
    selectedMonth
      ? payments.filter(
          (payment) =>
            payment.billing_month ===
            selectedMonth
        )
      : payments;

  const latestPaymentByTenant: Record<
    string,
    PaymentHistory
  > = payments.reduce(
    (
      acc: Record<
        string,
        PaymentHistory
      >,
      payment
    ) => {
      if (
        !acc[payment.tenant_name] ||
        payment.billing_month >
          acc[payment.tenant_name]
            .billing_month
      ) {
        acc[payment.tenant_name] =
          payment;
      }

      return acc;
    },
    {}
  );

  const summaryPayments =
    selectedMonth
      ? filteredPayments
      : Object.values(
          latestPaymentByTenant
        );

  const isCompletedPayment = (
    payment: PaymentHistory
  ) => {
    const status = String(
      payment.status || ""
    ).toLowerCase();

    return (
      status === "paid" ||
      status === "payment_closed"
    );
  };

  const totalCollected =
    summaryPayments
      .filter((payment) =>
        isCompletedPayment(
          payment
        )
      )
      .reduce(
        (sum, payment) =>
          sum +
          Number(
            payment.total_amount || 0
          ),
        0
      );

  const totalPending =
    summaryPayments
      .filter(
        (payment) =>
          !isCompletedPayment(
            payment
          )
      )
      .reduce(
        (sum, payment) =>
          sum +
          Number(
            payment.total_amount || 0
          ),
        0
      );

  const paidCount =
    summaryPayments.filter(
      (payment) =>
        isCompletedPayment(
          payment
        )
    ).length;

  const pendingCount =
    summaryPayments.filter(
      (payment) =>
        !isCompletedPayment(
          payment
        )
    ).length;

  const months = [
    ...new Set(
      payments.map(
        (payment) =>
          payment.billing_month
      )
    ),
  ].sort((a, b) =>
    b.localeCompare(a)
  );

  const statCards = [
    {
      label: "Collected",
      value:
        formatCurrency(
          totalCollected
        ),
      icon: "₹",
      tone: "green",
      description:
        "Successfully collected",
    },
    {
      label: "Pending",
      value:
        formatCurrency(
          totalPending
        ),
      icon: "!",
      tone: "amber",
      description:
        "Outstanding amount",
    },
    {
      label: "Paid Tenants",
      value: paidCount,
      icon: "✓",
      tone: "blue",
      description:
        "Latest bills paid",
    },
    {
      label: "Pending Tenants",
      value: pendingCount,
      icon: "◷",
      tone: "purple",
      description:
        "Bills requiring attention",
    },
  ] as const;

  return (
    <div className="dashboard-container">
      <style>
        {SUMMARY_STYLES}
      </style>

      <header className="dashboard-navbar">
        <div className="dashboard-logo-section">
          <div className="dashboard-logo-icon">
            🏠
          </div>

          <div>
            <h2>RentEase</h2>
            <p>
              Payments &amp; Billing
            </p>
          </div>
        </div>

        <button
          type="button"
          className="dashboard-logout-btn"
          onClick={handleLogout}
        >
          Logout
        </button>
      </header>

      <main className="dashboard-content">
        <PageNav current="payments" />

        <section
          className="payment-page-header"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent:
              "space-between",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <p className="payment-page-eyebrow">
              FINANCE
            </p>

            <h1 className="payment-page-title">
              Payment History
            </h1>

            <p className="payment-page-description">
              Track rent collection,
              outstanding balances and
              tenant payment status.
            </p>
          </div>

          <button
            type="button"
            className="rp-summary-trigger"
            onClick={() =>
              setIsSummaryOpen(true)
            }
            aria-haspopup="dialog"
            aria-expanded={
              isSummaryOpen
            }
          >
            <span
              className="rp-summary-trigger-icon"
              aria-hidden
            >
              📊
            </span>

            <span className="rp-summary-trigger-text">
              <span className="rp-summary-trigger-label">
                Pending · View Summary
              </span>

              <span className="rp-summary-trigger-value">
                {formatCurrency(
                  totalPending
                )}
              </span>
            </span>

            <span
              className="rp-summary-trigger-chevron"
              aria-hidden
            >
              ›
            </span>
          </button>
        </section>

        <section className="dashboard-card payment-history-card">
          <div className="payment-history-header">
            <div>
              <p className="section-label">
                TRANSACTIONS
              </p>

              <h2 className="section-title">
                Payment History
              </h2>

              <p className="payment-history-subtitle">
                Review and manage tenant
                bills.
              </p>
            </div>

            <div className="payment-history-count">
              <strong>
                {
                  filteredPayments.length
                }
              </strong>

              <span>
                {filteredPayments.length ===
                1
                  ? "Bill"
                  : "Bills"}
              </span>
            </div>
          </div>

          <div className="payment-filter-bar payment-filter-bar-modern">
            <div className="payment-filter-left">
              <div className="filter-field">
                <label
                  className="filter-label"
                  htmlFor="month-select"
                >
                  Billing Month
                </label>

                <select
                  id="month-select"
                  className="month-select"
                  value={selectedMonth}
                  onChange={(e) =>
                    setSelectedMonth(
                      e.target.value
                    )
                  }
                >
                  <option value="">
                    All Months
                  </option>

                  {months.map(
                    (month) => (
                      <option
                        key={month}
                        value={month}
                      >
                        {formatBillingMonth(
                          month
                        )}
                      </option>
                    )
                  )}
                </select>
              </div>

              {selectedMonth && (
                <button
                  type="button"
                  className="clear-month-btn"
                  onClick={() =>
                    setSelectedMonth("")
                  }
                >
                  Clear filter
                </button>
              )}
            </div>

            <button
              type="button"
              className="delete-bills-btn payment-delete-all-btn"
              onClick={deleteBills}
              disabled={
                payments.length === 0 ||
                deletingBills
              }
              title={
                payments.length === 0
                  ? "No bills to delete"
                  : selectedMonth
                  ? `Delete all bills for ${formatBillingMonth(
                      selectedMonth
                    )}`
                  : "Delete all bills from all months"
              }
            >
              {deletingBills
                ? "Deleting..."
                : selectedMonth
                ? "🗑 Delete Month"
                : "🗑 Delete All Bills"}
            </button>
          </div>

          {latestGeneratedMonth && (
            <div
              className="payment-info-banner"
              style={{
                padding: "10px 14px",
                fontSize: "13px",
              }}
            >
              <div className="payment-info-icon">
                ✦
              </div>

              <div>
                <strong>
                  Latest billing month:{" "}
                  {formatBillingMonth(
                    latestGeneratedMonth
                  )}
                </strong>{" "}
                — only the latest pending bill
                per tenant can be edited,
                reminded, or status-updated.
              </div>
            </div>
          )}

          <div
            className="payment-table-wrap"
            style={{
              maxHeight: "60vh",
              overflowY: "auto",
              overflowX: "auto",
            }}
          >
            <table className="payment-table">
              <thead
                style={{
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                  background: "#fff",
                }}
              >
                <tr>
                  <th className="payment-col-tenant">
                    Tenant
                  </th>

                  <th className="payment-col-room">
                    Room
                  </th>

                  <th className="payment-col-month">
                    Billing Month
                  </th>

                  <th className="payment-col-extra">
                    Extra Bill
                  </th>

                  <th className="payment-col-amount">
                    Amount
                  </th>

                  <th className="payment-col-status">
                    Status
                  </th>

                  <th className="payment-col-reminder">
                    Reminder
                  </th>

                  <th className="payment-col-update">
                    Status Update
                  </th>

                  <th className="payment-col-action">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredPayments.length >
                0 ? (
                  filteredPayments.map(
                    (payment) => {
                      const isEditing =
                        editingPaymentId ===
                        payment.payment_id;

                      const editable =
                        canEditPayment(
                          payment
                        );

                      const statusMeta =
                        getStatusMeta(
                          payment.status
                        );

                      const reminderEligible =
                        isReminderEligible(
                          payment
                        );

                      const statusUpdateEligible =
                        isStatusUpdateEligible(
                          payment
                        );

                      const deleting =
                        deletingPaymentId ===
                        payment.payment_id;

                      const updating =
                        updatingStatusId ===
                        payment.payment_id;

                      const sending =
                        sendingReminderId ===
                        payment.payment_id;

                      return (
                        <tr
                          key={
                            payment.payment_id
                          }
                        >
                          <td className="payment-tenant-cell">
                            <div className="payment-tenant-info">
                              <div className="payment-tenant-avatar">
                                {payment.tenant_name
                                  .charAt(
                                    0
                                  )
                                  .toUpperCase()}
                              </div>

                              <div>
                                <strong>
                                  {
                                    payment.tenant_name
                                  }
                                </strong>

                                <span>
                                  Tenant
                                </span>
                              </div>
                            </div>
                          </td>

                          <td>
                            <span className="room-badge">
                              {
                                payment.room_number
                              }
                            </span>
                          </td>

                          <td>
                            <div className="billing-month-cell">
                              <strong>
                                {formatBillingMonth(
                                  payment.billing_month
                                )}
                              </strong>

                              <span>
                                {
                                  payment.billing_month
                                }
                              </span>
                            </div>
                          </td>

                          <td>
                            <span className="extra-bill-amount">
                              {formatCurrency(
                                Number(
                                  payment.extra_bill ||
                                    0
                                )
                              )}
                            </span>
                          </td>

                          <td className="payment-amount-cell">
                            {isEditing ? (
                              <div className="edit-amount-wrapper">
                                <input
                                  type="number"
                                  min="1"
                                  step="0.01"
                                  value={
                                    editAmount
                                  }
                                  onChange={(
                                    e
                                  ) =>
                                    setEditAmount(
                                      e.target
                                        .value
                                    )
                                  }
                                  autoFocus
                                  className="payment-edit-input"
                                />
                              </div>
                            ) : (
                              <strong className="payment-amount">
                                {formatCurrency(
                                  Number(
                                    payment.total_amount ||
                                      0
                                  )
                                )}
                              </strong>
                            )}
                          </td>

                          <td>
                            <span
                              className={`payment-status-badge ${statusMeta.className}`}
                            >
                              <span className="status-badge-icon">
                                {
                                  statusMeta.icon
                                }
                              </span>

                              {
                                statusMeta.label
                              }
                            </span>
                          </td>

                          <td>
                            {reminderEligible ? (
                              <button
                                type="button"
                                onClick={() =>
                                  sendWhatsAppReminder(
                                    payment
                                  )
                                }
                                disabled={
                                  sending
                                }
                                className="whatsapp-reminder-btn"
                                title="Send WhatsApp payment reminder"
                              >
                                {sending
                                  ? "Sending..."
                                  : "📲 Remind"}
                              </button>
                            ) : (
                              <span className="action-disabled-label">
                                —
                              </span>
                            )}
                          </td>

                          <td>
                            {statusUpdateEligible ? (
                              <select
                                className="status-update-select"
                                value=""
                                disabled={
                                  updating
                                }
                                onChange={(
                                  e
                                ) => {
                                  const value =
                                    e.target
                                      .value;

                                  e.target.value =
                                    "";

                                  updatePaymentStatus(
                                    payment,
                                    value
                                  );
                                }}
                              >
                                <option
                                  value=""
                                  disabled
                                >
                                  {updating
                                    ? "Updating..."
                                    : "Update Status"}
                                </option>

                                <option value="partially_paid">
                                  Partially
                                  Paid
                                </option>

                                <option value="payment_closed">
                                  Payment
                                  Closed
                                </option>
                              </select>
                            ) : (
                              <span className="action-disabled-label">
                                —
                              </span>
                            )}
                          </td>

                          <td>
                            <div className="payment-actions">
                              {isEditing ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      saveEditedAmount(
                                        payment
                                      )
                                    }
                                    disabled={
                                      savingEdit
                                    }
                                    className="payment-action-btn payment-save-btn"
                                  >
                                    {savingEdit
                                      ? "Saving..."
                                      : "✓ Save"}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={
                                      cancelEditing
                                    }
                                    disabled={
                                      savingEdit
                                    }
                                    className="payment-action-btn payment-cancel-btn"
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <>
                                  {editable && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        startEditing(
                                          payment
                                        )
                                      }
                                      className="payment-action-btn payment-edit-btn"
                                      title="Edit latest pending bill"
                                    >
                                      ✎ Edit
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() =>
                                      deleteIndividualBill(
                                        payment
                                      )
                                    }
                                    disabled={
                                      deleting
                                    }
                                    className="payment-action-btn payment-delete-btn"
                                    title="Delete this individual bill"
                                  >
                                    {deleting
                                      ? "Deleting..."
                                      : "🗑 Delete"}
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    }
                  )
                ) : (
                  <tr>
                    <td
                      colSpan={9}
                      className="payment-table-empty"
                    >
                      <div className="payment-empty-state">
                        <div className="payment-empty-icon">
                          💳
                        </div>

                        <strong>
                          No payment records
                          found
                        </strong>

                        <p>
                          {selectedMonth
                            ? `There are no bills for ${formatBillingMonth(
                                selectedMonth
                              )}.`
                            : "Payment history will appear here once bills are generated."}
                        </p>

                        {selectedMonth && (
                          <button
                            type="button"
                            className="clear-month-btn payment-empty-clear"
                            onClick={() =>
                              setSelectedMonth(
                                ""
                              )
                            }
                          >
                            View all payments
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filteredPayments.length >
            0 && (
            <div className="payment-table-footer">
              <span>
                Showing{" "}
                <strong>
                  {
                    filteredPayments.length
                  }
                </strong>{" "}
                {filteredPayments.length ===
                1
                  ? "bill"
                  : "bills"}
                {selectedMonth
                  ? ` for ${formatBillingMonth(
                      selectedMonth
                    )}`
                  : ""}
              </span>

              <span className="payment-footer-note">
                Latest unpaid bills are
                eligible for reminders and
                status updates.
              </span>
            </div>
          )}
        </section>
      </main>

      {isSummaryOpen && (
        <>
          <div
            className="rp-summary-overlay"
            onClick={() =>
              setIsSummaryOpen(false)
            }
          />

          <aside
            className="rp-summary-drawer"
            role="dialog"
            aria-label="Payment summary"
            aria-modal="true"
          >
            <div className="rp-summary-drawer-header">
              <div>
                <p className="rp-summary-eyebrow">
                  Overview
                </p>

                <h2 className="rp-summary-heading">
                  Payment Summary
                </h2>

                {selectedMonth && (
                  <span className="rp-summary-month-chip">
                    {formatBillingMonth(
                      selectedMonth
                    )}
                  </span>
                )}
              </div>

              <button
                type="button"
                className="rp-summary-close-icon"
                onClick={() =>
                  setIsSummaryOpen(
                    false
                  )
                }
                aria-label="Close summary"
              >
                ×
              </button>
            </div>

            <div className="rp-summary-body">
              {statCards.map(
                (stat) => (
                  <div
                    className="rp-summary-stat-card"
                    key={stat.label}
                  >
                    <span
                      className={`rp-summary-stat-icon tone-${stat.tone}`}
                      aria-hidden
                    >
                      {stat.icon}
                    </span>

                    <span className="rp-summary-stat-text">
                      <span className="rp-summary-stat-label">
                        {stat.label}
                      </span>

                      <span className="rp-summary-stat-value">
                        {stat.value}
                      </span>

                      <span className="rp-summary-stat-description">
                        {
                          stat.description
                        }
                      </span>
                    </span>
                  </div>
                )
              )}

              <div className="rp-summary-total-bills">
                <span>
                  Total Bills
                </span>

                <strong>
                  {payments.length}
                </strong>
              </div>
            </div>

            <div className="rp-summary-footer">
              <button
                type="button"
                className="rp-summary-cancel-btn"
                onClick={() =>
                  setIsSummaryOpen(
                    false
                  )
                }
              >
                Cancel
              </button>
            </div>
          </aside>
        </>
      )}

      <AIChatbot />
    </div>
  );
}

export default Payments;