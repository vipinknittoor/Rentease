import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import api from "../api/axios";
import PageNav from "../components/PageNav";
import { useModal } from "../context/ModalContext";

import "./GenerateBills.css";

const UPI_STORAGE_KEY = "rentease_upi_id";

const isValidUpiId = (value: string): boolean => {
  const trimmed = value.trim();

  if (!trimmed) {
    return false;
  }

  return /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(trimmed);
};

function GenerateBills() {
  const navigate = useNavigate();

  const {
    showSuccess,
    showError,
    showWarning,
  } = useModal();

  const [loading, setLoading] = useState(false);

  const [checkingMonth, setCheckingMonth] = useState(true);

  const [nextBillingMonth, setNextBillingMonth] =
    useState<string | null>(null);

  const [billingReady, setBillingReady] = useState(true);

  const [upiId, setUpiId] = useState<string>(() => {
    try {
      return localStorage.getItem(UPI_STORAGE_KEY) || "";
    } catch {
      return "";
    }
  });

  const [upiError, setUpiError] = useState<string>("");

  const [upiSaved, setUpiSaved] = useState(false);

  const createMonth = (
    year: number,
    month: number
  ): string => {
    const date = new Date(year, month - 1, 1);

    const formattedYear = date.getFullYear();

    const formattedMonth = String(
      date.getMonth() + 1
    ).padStart(2, "0");

    return `${formattedYear}-${formattedMonth}`;
  };

  const formatBillingMonth = (
    billingMonth: string
  ): string => {
    const [year, month] = billingMonth
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

  const getDropdownMonths = (): string[] => {
    if (!nextBillingMonth) {
      return [];
    }

    const [year, month] = nextBillingMonth
      .split("-")
      .map(Number);

    const months: string[] = [];

    for (
      let offset = -2;
      offset <= 3;
      offset++
    ) {
      const date = new Date(
        year,
        month - 1 + offset,
        1
      );

      months.push(
        createMonth(
          date.getFullYear(),
          date.getMonth() + 1
        )
      );
    }

    return months;
  };

  const isMonthSelectable = (
    month: string
  ): boolean => {
    return month === nextBillingMonth;
  };

  const fetchNextBillingMonth = async () => {
    try {
      const response = await api.get(
        "/payments/latest-billing-month"
      );

      console.log(
        "Billing month response:",
        response.data
      );

      const nextMonth =
        response.data.next_billing_month;

      if (!nextMonth) {
        console.error(
          "Backend did not return next_billing_month:",
          response.data
        );

        setNextBillingMonth(null);
        setBillingReady(true);

        return;
      }

      setNextBillingMonth(nextMonth);

      setBillingReady(
        response.data.ready ?? true
      );

      console.log(
        "Next billing month:",
        nextMonth
      );
    } catch (error: any) {
      console.error(
        "Unable to determine next billing month:",
        error
      );

      const message =
        error?.response?.data?.detail;

      if (message) {
        showError(
          "Billing Month Error",
          message
        );
      } else {
        showError(
          "Billing Month Error",
          "Unable to determine the next billing month."
        );
      }

      setNextBillingMonth(null);
      setBillingReady(true);
    }
  };

  useEffect(() => {
    const checkUserAndBillingMonth =
      async () => {
        try {
          const user =
            localStorage.getItem("user");

          if (!user) {
            navigate(
              "/login",
              {
                replace: true,
              }
            );

            return;
          }

          const currentUser =
            JSON.parse(user);

          if (
            currentUser.role !== "owner"
          ) {
            navigate(
              "/dashboard",
              {
                replace: true,
              }
            );

            return;
          }

          await fetchNextBillingMonth();
        } catch (error) {
          console.error(
            "Billing month check failed:",
            error
          );

          setNextBillingMonth(null);
        } finally {
          setCheckingMonth(false);
        }
      };

    checkUserAndBillingMonth();
    
  }, [navigate]);

  const handleUpiChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setUpiId(event.target.value);

    setUpiSaved(false);

    if (upiError) {
      setUpiError("");
    }
  };

  const saveUpiId = () => {
    const trimmed = upiId.trim();

    if (!isValidUpiId(trimmed)) {
      setUpiError(
        "Please enter a valid UPI ID, e.g. name@bank or 9876543210@ybl"
      );

      setUpiSaved(false);

      return;
    }

    setUpiId(trimmed);

    setUpiError("");

    try {
      localStorage.setItem(
        UPI_STORAGE_KEY,
        trimmed
      );
    } catch (error) {
      console.error(
        "Unable to save UPI ID locally:",
        error
      );
    }

    setUpiSaved(true);
  };

  const generateBills = async () => {
    if (!nextBillingMonth) {
      showWarning(
        "Billing Month Unavailable",
        "Unable to determine the billing month."
      );

      return;
    }

    const trimmedUpiId = upiId.trim();

    if (!isValidUpiId(trimmedUpiId)) {
      setUpiError(
        "Please enter a valid UPI ID before generating bills, e.g. name@bank"
      );

      showWarning(
        "Invalid UPI ID",
        "Please enter a valid UPI ID before generating bills, e.g. name@bank."
      );

      return;
    }

    if (!billingReady) {
      showWarning(
        "Update Readings First",
        `Please update meter readings (and extra bills, if applicable) and click "Save All" in Manage Tenants before generating bills for ${formatBillingMonth(
          nextBillingMonth
        )}.`
      );

      return;
    }

    try {
      setLoading(true);

      try {
        localStorage.setItem(
          UPI_STORAGE_KEY,
          trimmedUpiId
        );
      } catch (error) {
        console.error(
          "Unable to save UPI ID locally:",
          error
        );
      }

      const response = await api.post(
        "/payments/generate-monthly-bills",
        {
          billing_month:
            nextBillingMonth,

          upi_id:
            trimmedUpiId,
        }
      );

      showSuccess(
        "Bills Generated",
        response.data.message
      );

      console.log(
        "Bills generated:",
        response.data
      );

      await fetchNextBillingMonth();
    } catch (error: any) {
      console.error(
        "Generate bills error:",
        error
      );

      const message =
        error?.response?.data?.detail;

      if (message) {
        showError(
          "Generate Bills Failed",
          message
        );
      } else {
        showError(
          "Generate Bills Failed",
          "Failed to generate bills."
        );
      }

      await fetchNextBillingMonth();
    } finally {
      setLoading(false);
    }
  };

  const handleMainButtonClick = () => {
    if (!nextBillingMonth) {
      return;
    }

    if (!billingReady) {
      navigate("/tenants");
      return;
    }

    generateBills();
  };

  if (checkingMonth) {
    return (
      <div className="generate-page">
        <div className="generate-card loading-card">
          <div className="page-icon">
            📅
          </div>

          <h2>
            Checking billing month...
          </h2>

          <p>
            Please wait while we determine
            the next available billing month.
          </p>

          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  const dropdownMonths =
    getDropdownMonths();

  return (
    <div className="generate-page">
      <div className="generate-card">

        <PageNav current="generate-bills" />

        <div className="page-header">
          <div className="page-icon">
            📅
          </div>

          <div>
            <h1>
              Generate Monthly Bills
            </h1>

            <p>
              Generate rent and electricity
              bills for all active tenants.
            </p>
          </div>
        </div>

        <div className="upi-section">
          <label htmlFor="upi-id">
            Payment UPI ID
          </label>

          <div className="upi-input-row">
            <input
              id="upi-id"
              type="text"
              className={
                upiError
                  ? "upi-input upi-input-error"
                  : "upi-input"
              }
              placeholder="e.g. owner@okhdfcbank"
              value={upiId}
              disabled={loading}
              onChange={handleUpiChange}
              onBlur={saveUpiId}
              autoComplete="off"
              spellCheck={false}
            />

            <button
              type="button"
              className="upi-save-btn"
              onClick={saveUpiId}
              disabled={loading}
            >
              {upiSaved
                ? "✓ Saved"
                : "Save"}
            </button>
          </div>

          {upiError ? (
            <p className="upi-error-text">
              {upiError}
            </p>
          ) : (
            <p className="billing-hint">
              This UPI ID will be attached to
              the bills generated for{" "}
              {nextBillingMonth
                ? formatBillingMonth(
                    nextBillingMonth
                  )
                : "the next billing month"}
              , and used for WhatsApp reminders
              and the tenant dashboard.
            </p>
          )}
        </div>

        <div className="billing-section">
          <label htmlFor="billing-month">
            Billing Month
          </label>

          {nextBillingMonth ? (
            <>
              <select
                id="billing-month"
                className="billing-month-select"
                value={nextBillingMonth}
                disabled={loading}
                onChange={(event) => {
                  const selectedMonth =
                    event.target.value;

                  if (
                    isMonthSelectable(
                      selectedMonth
                    )
                  ) {
                    setNextBillingMonth(
                      selectedMonth
                    );
                  }
                }}
              >
                {dropdownMonths.map(
                  (month) => {
                    const selectable =
                      isMonthSelectable(
                        month
                      );

                    return (
                      <option
                        key={month}
                        value={month}
                        disabled={!selectable}
                      >
                        {formatBillingMonth(
                          month
                        )}

                        {!selectable
                          ? " — unavailable"
                          : " — next bill"}
                      </option>
                    );
                  }
                )}
              </select>

              <p className="billing-hint">
                You can only generate the next
                billing month. Previous months
                and future months cannot be selected.
              </p>
            </>
          ) : (
            <div className="billing-error">
              Unable to determine billing month.
            </div>
          )}
        </div>

        {nextBillingMonth && (
          <div className="selected-month-card">
            <div className="selected-month-icon">
              📆
            </div>

            <div>
              <span>
                Next billable month
              </span>

              <strong>
                {formatBillingMonth(
                  nextBillingMonth
                )}
              </strong>
            </div>
          </div>
        )}

        {nextBillingMonth && !billingReady && (
          <div
            className="billing-error"
            style={{
              marginTop: "12px",
            }}
          >
            <strong>
              ⏳ Not ready to generate{" "}
              {formatBillingMonth(
                nextBillingMonth
              )}
              {" "}yet.
            </strong>

            <p
              style={{
                margin: "8px 0 0",
              }}
            >
              Please click on the update readings button below or go to Manage Tenants,
              update meter readings
              (and extra bills, if applicable),
              then click "Save All" before
              generating this month's bills.
            </p>
          </div>
        )}

        <div className="info-box">
          <h3>
            How monthly billing works
          </h3>

          <ul>
            <li>
              <span>
                ✓
              </span>
              Monthly rent is captured.
            </li>

            <li>
              <span>
                ✓
              </span>
              Latest electricity bill is included.
            </li>

            <li>
              <span>
                ✓
              </span>
              Each billing month can be
              generated only once.
            </li>

            <li>
              <span>
                ✓
              </span>
              Bills must be generated
              month-by-month.
            </li>

            <li>
              <span>
                ✓
              </span>
              Previous months cannot
              be selected.
            </li>

            <li>
              <span>
                ✓
              </span>
              You cannot skip a billing month.
            </li>

            <li>
              <span>
                ✓
              </span>
              Every active tenant's meter reading
              must be saved via "Save All" before
              that month can be generated.
            </li>

            <li>
              <span>
                ✓
              </span>
              The UPI ID entered above is attached
              to each month's generated bills.
            </li>
          </ul>
        </div>

        <div className="button-row">
          <button
            className="generate-button"
            onClick={handleMainButtonClick}
            disabled={
              loading ||
              !nextBillingMonth ||
              (
                billingReady &&
                !upiId.trim()
              )
            }
          >
            {loading
              ? "Generating..."
              : !billingReady &&
                nextBillingMonth
                ? "Update Readings First"
                : nextBillingMonth
                  ? `Generate ${formatBillingMonth(
                      nextBillingMonth
                    )}`
                  : "Generate Bills"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default GenerateBills;