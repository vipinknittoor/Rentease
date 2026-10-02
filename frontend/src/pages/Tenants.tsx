import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import api from "../api/axios";
import { useModal } from "../context/ModalContext";

import type { Tenant } from "../types/Tenant";
import type { Room } from "../types/Room";

import "./Tenants.css";

interface RegisteredUser {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  role: string;
}

interface PendingRoomRequest {
  id: number;
  user_id: number;
  full_name: string;
  phone: string;
  email: string;
  room_id: number;
  room_number: string;
  floor: number;
  monthly_rent: number;
  status: string;
  requested_at: string;
}

type TenantFormMode = "map" | "manual" | null;

const ELECTRICITY_RATE = 7;

function Tenants() {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    showSuccess,
    showError,
    showWarning,
    showConfirm,
  } = useModal();

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [registeredUsers, setRegisteredUsers] = useState<
    RegisteredUser[]
  >([]);

  const [pendingRequests, setPendingRequests] = useState<
    PendingRoomRequest[]
  >([]);

  const [processingRequestId, setProcessingRequestId] =
    useState<number | null>(null);

  const [showForm, setShowForm] = useState(false);

  const [formMode, setFormMode] =
    useState<TenantFormMode>(null);

  const [editId, setEditId] = useState<number | null>(null);

  const [selectedTenant, setSelectedTenant] =
    useState<Tenant | null>(null);

  const [meterReadings, setMeterReadings] = useState<{
    [key: number]: {
      previous_reading: number | "";
      current_reading: number | "";
    };
  }>({});

  const [extraBills, setExtraBills] = useState<{
    [key: number]: number | "";
  }>({});

  const [sendingReminderId, setSendingReminderId] =
    useState<number | null>(null);

  const [sendingAllReminders, setSendingAllReminders] =
    useState(false);

  const [savingAll, setSavingAll] = useState(false);

  const [updatingBillingId, setUpdatingBillingId] =
    useState<number | null>(null);

  const [formData, setFormData] = useState({
    user_id: null as number | null,
    full_name: "",
    phone: "",
    email: "",
    room_number: "",
    room_id: null as number | null,
    join_date: "",
    status: "Active",
  });

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

      fetchTenants();
      fetchRooms();
      fetchRegisteredUsers();
      fetchPendingRequests();
    } catch (error) {
      console.error(
        "Unable to read logged-in user:",
        error
      );

      localStorage.removeItem("user");

      navigate("/login", { replace: true });
    }
  }, [navigate]);

  const fetchTenants = async () => {
    try {
      const response = await api.get("/tenants/");

      setTenants(response.data);

      const readings: {
        [key: number]: {
          previous_reading: number;
          current_reading: number;
        };
      } = {};

      const extras: {
        [key: number]: number;
      } = {};

      response.data.forEach((tenant: Tenant) => {
        readings[tenant.id] = {
          previous_reading:
            tenant.previous_reading,
          current_reading:
            tenant.current_reading,
        };

        extras[tenant.id] =
          Number(tenant.extra_bill ?? 0);
      });

      setMeterReadings(readings);
      setExtraBills(extras);
    } catch (error) {
      console.error(
        "Unable to fetch tenants:",
        error
      );
    }
  };

  const fetchRooms = async () => {
    try {
      const response = await api.get("/rooms/");

      setRooms(response.data);
    } catch (error) {
      console.error(
        "Unable to fetch rooms:",
        error
      );
    }
  };

  const fetchRegisteredUsers = async () => {
    try {
      const response = await api.get(
        "/users/registered-tenants"
      );

      setRegisteredUsers(response.data);
    } catch (error) {
      console.error(
        "Unable to fetch registered users:",
        error
      );
    }
  };

  const fetchPendingRequests = async () => {
    try {
      const response = await api.get(
        "/room-requests/pending"
      );

      setPendingRequests(
        Array.isArray(response.data)
          ? response.data
          : []
      );
    } catch (error) {
      console.error(
        "Unable to fetch pending room requests:",
        error
      );
    }
  };

  const acceptRoomRequest = async (
    requestId: number
  ) => {
    const confirmAccept = await showConfirm(
      "Accept Room Request",
      "Accept this room request? The tenant will be added to Manage Tenants.",
      {
        confirmText: "Accept",
        cancelText: "Cancel",
      }
    );

    if (!confirmAccept) {
      return;
    }

    try {
      setProcessingRequestId(requestId);

      await api.post(
        `/room-requests/${requestId}/accept`
      );

      await fetchPendingRequests();
      await fetchTenants();
      await fetchRooms();
      await fetchRegisteredUsers();

      showSuccess(
        "Room Request Accepted",
        "Room request accepted. Tenant added."
      );
    } catch (error: any) {
      console.error(
        "Unable to accept room request:",
        error
      );

      const message =
        error?.response?.data?.detail ||
        "Unable to accept room request.";

      showError(
        "Request Failed",
        message
      );
    } finally {
      setProcessingRequestId(null);
    }
  };

  const rejectRoomRequest = async (
    requestId: number
  ) => {
    const confirmReject = await showConfirm(
      "Reject Room Request",
      "Reject this room request?",
      {
        confirmText: "Reject",
        cancelText: "Cancel",
      }
    );

    if (!confirmReject) {
      return;
    }

    try {
      setProcessingRequestId(requestId);

      await api.post(
        `/room-requests/${requestId}/reject`
      );

      await fetchPendingRequests();

      showSuccess(
        "Request Rejected",
        "Room request rejected."
      );
    } catch (error: any) {
      console.error(
        "Unable to reject room request:",
        error
      );

      const message =
        error?.response?.data?.detail ||
        "Unable to reject room request.";

      showError(
        "Request Failed",
        message
      );
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const openMapTenantForm = () => {
    setEditId(null);
    setFormMode("map");

    setFormData({
      user_id: null,
      full_name: "",
      phone: "",
      email: "",
      room_number: "",
      room_id: null,
      join_date: "",
      status: "Active",
    });

    setShowForm(true);
  };

  const openManualTenantForm = () => {
    setEditId(null);
    setFormMode("manual");

    setFormData({
      user_id: null,
      full_name: "",
      phone: "",
      email: "",
      room_number: "",
      room_id: null,
      join_date: "",
      status: "Active",
    });

    setShowForm(true);
  };

  const handleRegisteredUserChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const value = e.target.value;

    if (!value) {
      setFormData((prev) => ({
        ...prev,
        user_id: null,
        full_name: "",
        phone: "",
        email: "",
      }));

      return;
    }

    const userId = Number(value);

    const selectedUser =
      registeredUsers.find(
        (user) => user.id === userId
      );

    if (!selectedUser) {
      setFormData((prev) => ({
        ...prev,
        user_id: null,
        full_name: "",
        phone: "",
        email: "",
      }));

      return;
    }

    setFormData((prev) => ({
      ...prev,
      user_id: selectedUser.id,
      full_name: selectedUser.full_name,
      phone: selectedUser.phone,
      email: selectedUser.email,
    }));
  };

  const handleRoomChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const value = e.target.value;

    if (!value) {
      setFormData((prev) => ({
        ...prev,
        room_id: null,
        room_number: "",
      }));

      return;
    }

    const roomId = Number(value);

    const selectedRoom = rooms.find(
      (room) => room.id === roomId
    );

    if (!selectedRoom) {
      return;
    }

    setFormData((prev) => ({
      ...prev,
      room_id: selectedRoom.id,
      room_number: selectedRoom.room_number,
    }));
  };

  const handleReadingChange = (
    tenantId: number,
    field:
      | "previous_reading"
      | "current_reading",
    value: string
  ) => {
    setMeterReadings((prev) => ({
      ...prev,

      [tenantId]: {
        ...prev[tenantId],
        [field]:
          value === "" ? "" : Number(value),
      },
    }));
  };

  const handleExtraBillChange = (
    tenantId: number,
    value: string
  ) => {
    setExtraBills((prev) => ({
      ...prev,

      [tenantId]:
        value === "" ? "" : Number(value),
    }));
  };

  const getElectricityUnits = (
    tenantId: number
  ) => {
    const reading = meterReadings[tenantId];

    if (
      !reading ||
      reading.previous_reading === "" ||
      reading.current_reading === ""
    ) {
      return 0;
    }

    const units =
      Number(reading.current_reading) -
      Number(reading.previous_reading);

    return units >= 0 ? units : 0;
  };

  const getElectricityBill = (
    tenantId: number
  ) => {
    return (
      getElectricityUnits(tenantId) *
      ELECTRICITY_RATE
    );
  };

  const getExtraBillAmount = (
    tenantId: number
  ) => {
    const value = extraBills[tenantId];

    if (
      value === "" ||
      value === undefined ||
      value === null
    ) {
      return 0;
    }

    const amount = Number(value);

    return Number.isFinite(amount) &&
      amount >= 0
      ? amount
      : 0;
  };

  const getTotalAmount = (
    tenant: Tenant
  ) => {
    return (
      Number(tenant.monthly_rent) +
      getElectricityBill(tenant.id) +
      getExtraBillAmount(tenant.id)
    );
  };

  const validateFullName = (
    name: string
  ): string | null => {
    const value = name.trim();

    if (!value) {
      return "Please enter tenant full name.";
    }

    if (value.length < 2) {
      return "Full name must contain at least 2 characters.";
    }

    if (value.length > 50) {
      return "Full name cannot exceed 50 characters.";
    }

    if (!/^[A-Za-z][A-Za-z .']*$/.test(value)) {
      return (
        "Full name can contain only letters, spaces, dots and apostrophes."
      );
    }

    return null;
  };

  const validatePhone = (
    phone: string
  ): string | null => {
    const value = phone.trim();

    if (!value) {
      return "Please enter phone number.";
    }

    if (!/^[6-9]\d{9}$/.test(value)) {
      return (
        "Phone number must be a valid 10-digit Indian mobile number."
      );
    }

    return null;
  };

  const validateEmail = (
    email: string
  ): string | null => {
    const value = email.trim();

    if (!value) {
      return "Please enter email address.";
    }

    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(value)) {
      return "Please enter a valid email address.";
    }

    return null;
  };

  const validateTenantForm = (): boolean => {
    const nameError =
      validateFullName(
        formData.full_name
      );

    if (nameError) {
      showWarning(
        "Invalid Name",
        nameError
      );
      return false;
    }

    const phoneError =
      validatePhone(formData.phone);

    if (phoneError) {
      showWarning(
        "Invalid Phone Number",
        phoneError
      );
      return false;
    }

    const emailError =
      validateEmail(formData.email);

    if (emailError) {
      showWarning(
        "Invalid Email",
        emailError
      );
      return false;
    }

    if (!formData.room_id) {
      showWarning(
        "Room Required",
        "Please select a room."
      );
      return false;
    }

    if (!formData.join_date) {
      showWarning(
        "Join Date Required",
        "Please select join date."
      );
      return false;
    }

    if (
      formMode === "map" &&
      editId === null &&
      !formData.user_id
    ) {
      showWarning(
        "Registered User Required",
        "Please select a registered user."
      );

      return false;
    }

    return true;
  };

  const createTenant = async () => {
    if (!validateTenantForm()) {
      return;
    }

    try {
      const selectedRoom = rooms.find(
        (room) =>
          room.id === formData.room_id
      );

      if (!selectedRoom) {
        showError(
          "Room Not Found",
          "Selected room was not found."
        );

        return;
      }

      const tenantData: any = {
        full_name:
          formData.full_name.trim(),

        phone:
          formData.phone.trim(),

        email:
          formData.email
            .trim()
            .toLowerCase(),

        room_number:
          formData.room_number,

        room_id:
          formData.room_id,

        join_date:
          formData.join_date,

        status:
          formData.status,

        monthly_rent:
          selectedRoom.monthly_rent,
      };

      if (formMode === "map") {
        tenantData.user_id =
          formData.user_id;
      }

      await api.post(
        "/tenants/",
        tenantData
      );

      await fetchTenants();
      await fetchRooms();
      await fetchRegisteredUsers();

      if (formMode === "map") {
        showSuccess(
          "Tenant Assigned",
          "Tenant assigned successfully."
        );
      } else {
        showSuccess(
          "Tenant Added",
          "Tenant added manually successfully."
        );
      }

      closeForm();
    } catch (error: any) {
      console.error(
        "Unable to create tenant:",
        error
      );

      const detail =
        error?.response?.data?.detail;

      let message =
        "Unable to create tenant.";

      if (Array.isArray(detail)) {
        message = detail
          .map(
            (item: any) => item.msg
          )
          .join("\n");
      } else if (
        typeof detail === "string"
      ) {
        message = detail;
      }

      showError(
        "Unable to Create Tenant",
        message
      );
    }
  };

  const editTenant = (
    tenant: Tenant
  ) => {
    setEditId(tenant.id);
    setFormMode(null);

    setFormData({
      user_id: tenant.user_id,
      full_name: tenant.full_name,
      phone: tenant.phone,
      email: tenant.email,
      room_number: tenant.room_number,
      room_id: tenant.room_id,
      join_date: tenant.join_date,
      status: tenant.status,
    });

    setShowForm(true);
  };

  const updateTenant = async () => {
    if (editId === null) {
      return;
    }

    if (!validateTenantForm()) {
      return;
    }

    try {
      const updateData = {
        ...formData,

        full_name:
          formData.full_name.trim(),

        phone:
          formData.phone.trim(),

        email:
          formData.email
            .trim()
            .toLowerCase(),
      };

      await api.put(
        `/tenants/${editId}`,
        updateData
      );

      await fetchTenants();
      await fetchRooms();

      showSuccess(
        "Tenant Updated",
        "Tenant updated successfully."
      );

      closeForm();
    } catch (error: any) {
      console.error(
        "Unable to update tenant:",
        error
      );

      const detail =
        error?.response?.data?.detail;

      let message =
        "Unable to update tenant.";

      if (Array.isArray(detail)) {
        message = detail
          .map(
            (item: any) => item.msg
          )
          .join("\n");
      } else if (
        typeof detail === "string"
      ) {
        message = detail;
      }

      showError(
        "Unable to Update Tenant",
        message
      );
    }
  };

  const updateMeterReading = async (
    tenantId: number,
    showAlert = true
  ) => {
    const reading =
      meterReadings[tenantId];

    if (
      !reading ||
      reading.previous_reading === "" ||
      reading.current_reading === ""
    ) {
      if (showAlert) {
        showWarning(
          "Missing Readings",
          "Please enter both readings."
        );
      }

      return false;
    }

    const previous = Number(
      reading.previous_reading
    );

    const current = Number(
      reading.current_reading
    );

    if (
      Number.isNaN(previous) ||
      Number.isNaN(current)
    ) {
      if (showAlert) {
        showWarning(
          "Invalid Readings",
          "Please enter valid meter readings."
        );
      }

      return false;
    }

    if (current < previous) {
      if (showAlert) {
        showWarning(
          "Invalid Meter Reading",
          "Current reading cannot be less than previous reading."
        );
      }

      return false;
    }

    try {
      await api.put(
        `/tenants/${tenantId}/electricity`,
        {
          previous_reading: previous,
          current_reading: current,
        }
      );

      if (showAlert) {
        showSuccess(
          "Electricity Updated",
          "Electricity reading updated successfully."
        );
      }

      return true;
    } catch (error: any) {
      console.error(
        "Unable to update electricity:",
        error
      );

      if (showAlert) {
        const message =
          error?.response?.data?.detail ||
          "Unable to update electricity reading.";

        showError(
          "Electricity Update Failed",
          message
        );
      }

      return false;
    }
  };

  const updateExtraBill = async (
    tenantId: number,
    showAlert = true
  ) => {
    const value =
      extraBills[tenantId];

    if (value === "") {
      if (showAlert) {
        showWarning(
          "Extra Bill Required",
          "Please enter an extra bill amount."
        );
      }

      return false;
    }

    const amount = Number(value);

    if (
      Number.isNaN(amount) ||
      amount < 0
    ) {
      if (showAlert) {
        showWarning(
          "Invalid Extra Bill",
          "Please enter a valid extra bill amount."
        );
      }

      return false;
    }

    try {
      await api.put(
        `/tenants/${tenantId}/extra-bill`,
        {
          extra_bill: amount,
        }
      );

      if (showAlert) {
        showSuccess(
          "Extra Bill Updated",
          "Extra bill updated successfully."
        );
      }

      return true;
    } catch (error: any) {
      console.error(
        "Unable to update extra bill:",
        error
      );

      if (showAlert) {
        const message =
          error?.response?.data?.detail ||
          "Unable to update extra bill.";

        showError(
          "Extra Bill Update Failed",
          message
        );
      }

      return false;
    }
  };

  const saveAllElectricity = async () => {
    if (tenants.length === 0) {
      showWarning(
        "No Tenants",
        "No tenants available."
      );
      return;
    }

    try {
      setSavingAll(true);

      for (const tenant of tenants) {
        const reading =
          meterReadings[tenant.id];

        if (
          !reading ||
          reading.previous_reading === "" ||
          reading.current_reading === ""
        ) {
          continue;
        }

        const previous = Number(
          reading.previous_reading
        );

        const current = Number(
          reading.current_reading
        );

        if (
          Number.isNaN(previous) ||
          Number.isNaN(current)
        ) {
          showWarning(
            "Invalid Readings",
            `Please enter valid readings for ${tenant.full_name}.`
          );

          return;
        }

        if (current < previous) {
          showWarning(
            "Invalid Meter Reading",
            `Current reading cannot be less than previous reading for ${tenant.full_name}.`
          );

          return;
        }
      }

      for (const tenant of tenants) {
        const value =
          extraBills[tenant.id];

        if (
          value === "" ||
          value === undefined
        ) {
          continue;
        }

        const amount = Number(value);

        if (
          Number.isNaN(amount) ||
          amount < 0
        ) {
          showWarning(
            "Invalid Extra Bill",
            `Please enter a valid extra bill amount for ${tenant.full_name}.`
          );

          return;
        }
      }

      const tenantsToSave =
        tenants.filter((tenant) => {
          const reading =
            meterReadings[tenant.id];

          return (
            reading &&
            reading.previous_reading !== "" &&
            reading.current_reading !== ""
          );
        });

      const tenantsForExtraBill =
        tenants.filter((tenant) => {
          const value =
            extraBills[tenant.id];

          return (
            value !== "" &&
            value !== undefined
          );
        });

      if (
        tenantsToSave.length === 0 &&
        tenantsForExtraBill.length === 0
      ) {
        showWarning(
          "Nothing to Save",
          "There is no electricity or extra bill data to save."
        );

        return;
      }

      const electricityResults =
        await Promise.all(
          tenantsToSave.map((tenant) =>
            updateMeterReading(
              tenant.id,
              false
            )
          )
        );

      const extraBillResults =
        await Promise.all(
          tenantsForExtraBill.map((tenant) =>
            updateExtraBill(
              tenant.id,
              false
            )
          )
        );

      const failedCount =
        electricityResults.filter(
          (result) => result === false
        ).length +
        extraBillResults.filter(
          (result) => result === false
        ).length;

      await fetchTenants();

      if (failedCount > 0) {
        showWarning(
          "Save Completed with Errors",
          `Saved with ${failedCount} failure(s).`
        );
      } else {
        showSuccess(
          "Billing Data Saved",
          "All electricity readings and extra bills saved successfully."
        );
      }
    } catch (error) {
      console.error(
        "Failed to save tenant billing data:",
        error
      );

      showError(
        "Save Failed",
        "Failed to save tenant billing data."
      );
    } finally {
      setSavingAll(false);
    }
  };

  const sendReminder = async (
    tenant: Tenant
  ) => {
    if (sendingAllReminders) {
      return;
    }

    try {
      if (
        !tenant.email ||
        tenant.email.trim() === ""
      ) {
        showWarning(
          "Email Not Available",
          "This tenant does not have an email address."
        );

        return;
      }

      const confirmed = await showConfirm(
        "Send Payment Reminder",
        `Send payment reminder to ${tenant.email}?`,
        {
          confirmText: "Send",
          cancelText: "Cancel",
        }
      );

      if (!confirmed) {
        return;
      }

      setSendingReminderId(tenant.id);

      const response = await api.post(
        `/payments/send-reminder/${tenant.id}`
      );

      showSuccess(
        "Reminder Sent",
        response.data?.message ||
          `Payment reminder sent successfully to ${tenant.email}.`
      );
    } catch (error: any) {
      console.error(
        "Payment reminder error:",
        error
      );

      const message =
        error?.response?.data?.detail ||
        "Unable to send payment reminder.";

      showError(
        "Reminder Failed",
        message
      );
    } finally {
      setSendingReminderId(null);
    }
  };

  const sendRemindersToAll = async () => {
    if (sendingAllReminders) {
      return;
    }

    const activeTenants =
      tenants.filter(
        (tenant) =>
          tenant.status === "Active"
      );

    if (activeTenants.length === 0) {
      showWarning(
        "No Active Tenants",
        "There are no active tenants."
      );

      return;
    }

    const tenantsWithEmail =
      activeTenants.filter(
        (tenant) =>
          tenant.email &&
          tenant.email.trim() !== ""
      );

    if (tenantsWithEmail.length === 0) {
      showWarning(
        "No Email Addresses",
        "No active tenants have an email address."
      );

      return;
    }

    const tenantsWithoutEmail =
      activeTenants.filter(
        (tenant) =>
          !tenant.email ||
          tenant.email.trim() === ""
      );

    let confirmationMessage =
      `Send payment reminders to ${tenantsWithEmail.length} tenant(s)?`;

    if (
      tenantsWithoutEmail.length > 0
    ) {
      confirmationMessage +=
        `\n\n${tenantsWithoutEmail.length} tenant(s) will be skipped because they have no email address.`;
    }

    confirmationMessage +=
      "\n\nThe emails will be sent one by one.";

    const confirmed = await showConfirm(
      "Send Payment Reminders",
      confirmationMessage,
      {
        confirmText: "Send All",
        cancelText: "Cancel",
      }
    );

    if (!confirmed) {
      return;
    }

    setSendingAllReminders(true);

    let successCount = 0;
    let failedCount = 0;

    const failedTenants: string[] =
      [];

    try {
      for (
        const tenant of tenantsWithEmail
      ) {
        try {
          await api.post(
            `/payments/send-reminder/${tenant.id}`
          );

          successCount++;
        } catch (error: any) {
          failedCount++;

          const errorMessage =
            error?.response?.data?.detail ||
            "Failed";

          failedTenants.push(
            `${tenant.full_name} - ${errorMessage}`
          );

          console.error(
            `Failed to send reminder to ${tenant.full_name}:`,
            error
          );
        }
      }

      let resultMessage =
        "Payment reminders completed.\n\n";

      resultMessage +=
        `Sent: ${successCount}\n`;

      resultMessage +=
        `Failed: ${failedCount}`;

      if (
        tenantsWithoutEmail.length > 0
      ) {
        resultMessage +=
          `\nSkipped (no email): ${tenantsWithoutEmail.length}`;
      }

      if (
        failedTenants.length > 0
      ) {
        resultMessage +=
          "\n\nFailed tenants:\n";

        resultMessage +=
          failedTenants.join("\n");
      }

      if (failedCount > 0) {
        showWarning(
          "Payment Reminders Completed",
          resultMessage
        );
      } else {
        showSuccess(
          "Payment Reminders Completed",
          resultMessage
        );
      }
    } catch (error) {
      console.error(
        "Send all reminders error:",
        error
      );

      showError(
        "Reminder Process Failed",
        "Unable to complete sending reminders."
      );
    } finally {
      setSendingAllReminders(false);
    }
  };

  const toggleBilling = async (
    tenant: Tenant
  ) => {
    const newStatus =
      !tenant.billing_enabled;

    const confirmed = await showConfirm(
      newStatus
        ? "Enable Bill Generation"
        : "Disable Bill Generation",
      newStatus
        ? `Enable bill generation for ${tenant.full_name}?`
        : `Disable bill generation for ${tenant.full_name}? This tenant will be skipped when monthly bills are generated.`,
      {
        confirmText: newStatus
          ? "Enable"
          : "Disable",
        cancelText: "Cancel",
      }
    );

    if (!confirmed) {
      return;
    }

    try {
      setUpdatingBillingId(
        tenant.id
      );

      const response = await api.put(
        `/tenants/${tenant.id}/billing-status`,
        {
          billing_enabled:
            newStatus,
        }
      );

      setTenants((prev) =>
        prev.map((item) =>
          item.id === tenant.id
            ? {
                ...item,
                billing_enabled:
                  response.data
                    .billing_enabled,
              }
            : item
        )
      );

      if (newStatus) {
        showSuccess(
          "Bill Generation Enabled",
          `${tenant.full_name} will be included in future monthly bill generation.`
        );
      } else {
        showSuccess(
          "Bill Generation Disabled",
          `${tenant.full_name} will be skipped during future monthly bill generation.`
        );
      }
    } catch (error: any) {
      console.error(
        "Unable to update billing status:",
        error
      );

      const message =
        error?.response?.data?.detail ||
        "Unable to update bill generation status.";

      showError(
        "Billing Status Update Failed",
        message
      );
    } finally {
      setUpdatingBillingId(null);
    }
  };

  const deleteTenant = async (
    id: number
  ) => {
    const confirmDelete = await showConfirm(
      "Delete Tenant",
      "Are you sure you want to delete this tenant? This action cannot be undone.",
      {
        confirmText: "Delete",
        cancelText: "Cancel",
      }
    );

    if (!confirmDelete) {
      return;
    }

    try {
      await api.delete(
        `/tenants/${id}`
      );

      await fetchTenants();
      await fetchRooms();
      await fetchRegisteredUsers();

      if (selectedTenant?.id === id) {
        setSelectedTenant(null);
      }

      showSuccess(
        "Tenant Deleted",
        "Tenant deleted successfully."
      );
    } catch (error: any) {
      console.error(
        "Unable to delete tenant:",
        error
      );

      const message =
        error?.response?.data?.detail ||
        "Unable to delete tenant.";

      showError(
        "Delete Failed",
        message
      );
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setEditId(null);
    setFormMode(null);

    setFormData({
      user_id: null,
      full_name: "",
      phone: "",
      email: "",
      room_number: "",
      room_id: null,
      join_date: "",
      status: "Active",
    });
  };

  const openTenantDetails = (
    tenant: Tenant
  ) => {
    setSelectedTenant(tenant);
  };

  const closeTenantDetails = () => {
    setSelectedTenant(null);
  };

  const assignedUserIds = new Set(
    tenants
      .filter(
        (tenant) =>
          tenant.status === "Active" &&
          tenant.user_id !== null
      )
      .map(
        (tenant) =>
          tenant.user_id
      )
  );

  const availableRegisteredUsers =
    registeredUsers.filter(
      (user) =>
        !assignedUserIds.has(
          user.id
        )
    );

  const activeCount =
    tenants.filter(
      (tenant) =>
        tenant.status === "Active"
    ).length;

  const tenantsWithEmailCount =
    tenants.filter(
      (tenant) =>
        tenant.status === "Active" &&
        tenant.email &&
        tenant.email.trim() !== ""
    ).length;

  const goTo = (path: string) => {
    navigate(path);
  };

  const isActiveNav = (
    path: string
  ) => {
    return location.pathname === path;
  };

  return (
    <div className="tenants-container">

      <div className="tenants-top-navigation">

        <button
          type="button"
          className="back-dashboard-btn"
          onClick={() =>
            navigate("/owner-dashboard")
          }
        >
          <span className="back-arrow">
            ←
          </span>

          <span>
            Back to Dashboard
          </span>
        </button>

        <nav className="tenant-quick-nav">

          <button
            type="button"
            className={`quick-nav-btn ${
              isActiveNav("/owner-dashboard")
                ? "active"
                : ""
            }`}
            onClick={() =>
              goTo("/owner-dashboard")
            }
          >
            <span className="quick-nav-icon">
              🏠
            </span>

            <span>Home</span>
          </button>

          <button
            type="button"
            className={`quick-nav-btn ${
              isActiveNav("/rooms")
                ? "active"
                : ""
            }`}
            onClick={() =>
              goTo("/rooms")
            }
          >
            <span className="quick-nav-icon">
              🛏️
            </span>

            <span>Rooms</span>
          </button>

          <button
            type="button"
            className={`quick-nav-btn ${
              isActiveNav("/payments")
                ? "active"
                : ""
            }`}
            onClick={() =>
              goTo("/payments")
            }
          >
            <span className="quick-nav-icon">
              💳
            </span>

            <span>Payments</span>
          </button>

          <button
            type="button"
            className={`quick-nav-btn ${
              isActiveNav(
                "/generate-bills"
              )
                ? "active"
                : ""
            }`}
            onClick={() =>
              goTo("/generate-bills")
            }
          >
            <span className="quick-nav-icon">
              🧾
            </span>

            <span>Generate Bills</span>
          </button>

        </nav>
      </div>

      <div className="tenants-header">

        <div>
          <h1 className="page-title">

            <span className="page-title-icon">
              👥
            </span>

            Manage Tenants

          </h1>

          <p className="page-subtitle">
            {tenants.length} tenants total ·{" "}
            {activeCount} active
          </p>
        </div>

        <div className="tenant-actions">

          <button
            type="button"
            className="add-btn"
            onClick={
              openMapTenantForm
            }
          >
            🔗 Assign Tenant
          </button>

          <button
            type="button"
            className="add-btn add-btn-secondary"
            onClick={
              openManualTenantForm
            }
          >
            ➕ Add Manually
          </button>

        </div>

      </div>

      {pendingRequests.length > 0 && (
        <div
          className="table-card pending-request-card"
        >

          <div className="table-card-toolbar">

            <span className="table-card-title">
              🔔 Pending Room Requests (
              {pendingRequests.length})
            </span>

          </div>

          <div className="table-responsive">

            <table>

              <thead>

                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Requested Room</th>
                  <th>Rent</th>
                  <th>Requested On</th>
                  <th>Actions</th>
                </tr>

              </thead>

              <tbody>

                {pendingRequests.map(
                  (req) => (
                    <tr key={req.id}>

                      <td data-label="Name">
                        {req.full_name}
                      </td>

                      <td data-label="Phone">
                        {req.phone}
                      </td>

                      <td data-label="Email">
                        {req.email}
                      </td>

                      <td data-label="Requested Room">
                        {req.room_number}{" "}
                        (Floor {req.floor})
                      </td>

                      <td data-label="Rent">
                        ₹
                        {Number(
                          req.monthly_rent
                        ).toLocaleString(
                          "en-IN"
                        )}
                      </td>

                      <td data-label="Requested On">
                        {new Date(
                          req.requested_at
                        ).toLocaleDateString(
                          "en-GB",
                          {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          }
                        )}
                      </td>

                      <td data-label="Actions">

                        <div className="action-buttons">

                          <button
                            type="button"
                            className="edit-btn"
                            onClick={() =>
                              acceptRoomRequest(
                                req.id
                              )
                            }
                            disabled={
                              processingRequestId ===
                              req.id
                            }
                          >
                            {processingRequestId ===
                            req.id
                              ? "Processing..."
                              : "✅ Accept"}
                          </button>

                          <button
                            type="button"
                            className="delete-btn"
                            onClick={() =>
                              rejectRoomRequest(
                                req.id
                              )
                            }
                            disabled={
                              processingRequestId ===
                              req.id
                            }
                          >
                            {processingRequestId ===
                            req.id
                              ? "Processing..."
                              : "❌ Reject"}
                          </button>

                        </div>

                      </td>

                    </tr>
                  )
                )}

              </tbody>

            </table>

          </div>

        </div>
      )}

      {showForm && (
        <div className="form-card">

          <h2>
            {editId !== null
              ? "Edit Tenant"
              : formMode === "map"
              ? "Assign Tenant"
              : "Add Tenant Manually"}
          </h2>

          {editId === null &&
            formMode === "map" && (
              <p className="form-description">
                Select an existing registered
                user and assign them to a room.
              </p>
            )}

          {editId === null &&
            formMode === "manual" && (
              <p className="form-description">
                Create a tenant manually
                without requiring a registered
                user account.
              </p>
            )}

          <div className="form-grid">

            {editId === null &&
              formMode === "map" && (
                <select
                  value={
                    formData.user_id ?? ""
                  }
                  onChange={
                    handleRegisteredUserChange
                  }
                  required
                >
                  <option value="">
                    Select Registered User
                  </option>

                  {availableRegisteredUsers.map(
                    (user) => (
                      <option
                        key={user.id}
                        value={user.id}
                      >
                        {user.full_name} -{" "}
                        {user.email}
                      </option>
                    )
                  )}

                </select>
              )}

            <input
              name="full_name"
              type="text"
              placeholder="Full Name"
              value={
                formData.full_name
              }
              onChange={handleChange}
              maxLength={50}
              autoComplete="name"
              required
              readOnly={
                editId === null &&
                formMode === "map" &&
                formData.user_id !== null
              }
            />

            <input
              name="phone"
              type="tel"
              placeholder="10-digit Phone Number"
              value={formData.phone}
              onChange={(e) => {
                const value =
                  e.target.value;

                if (/^\d*$/.test(value)) {
                  setFormData((prev) => ({
                    ...prev,
                    phone: value,
                  }));
                }
              }}
              maxLength={10}
              inputMode="numeric"
              autoComplete="tel"
              required
              readOnly={
                editId === null &&
                formMode === "map" &&
                formData.user_id !== null
              }
            />

            <input
              name="email"
              type="email"
              placeholder="Email Address"
              value={formData.email}
              onChange={handleChange}
              maxLength={100}
              autoComplete="email"
              required
              readOnly={
                editId === null &&
                formMode === "map" &&
                formData.user_id !== null
              }
            />

            <select
              value={
                formData.room_id ?? ""
              }
              onChange={
                handleRoomChange
              }
              required
            >
              <option value="">
                Select Room
              </option>

              {rooms
                .filter(
                  (room) =>
                    room.status ===
                      "Vacant" ||
                    room.id ===
                      formData.room_id
                )
                .map((room) => (
                  <option
                    key={room.id}
                    value={room.id}
                  >
                    {room.room_number} - ₹
                    {Number(
                      room.monthly_rent
                    ).toLocaleString(
                      "en-IN"
                    )}
                  </option>
                ))}

            </select>

            <input
              name="join_date"
              type="date"
              value={
                formData.join_date
              }
              onChange={handleChange}
              required
            />

          </div>

          <div className="form-actions">

            <button
              type="button"
              className="save-btn"
              onClick={() => {
                if (editId !== null) {
                  updateTenant();
                } else {
                  createTenant();
                }
              }}
            >
              {editId !== null
                ? "Update Tenant"
                : formMode === "map"
                ? "Assign Tenant"
                : "Add Tenant"}
            </button>

            <button
              type="button"
              className="cancel-btn"
              onClick={closeForm}
            >
              Cancel
            </button>

          </div>

        </div>
      )}

      <div className="table-card">

        <div className="table-card-toolbar">

          <span className="table-card-title">
            Tenant Billing
          </span>

          <button
            type="button"
            className="email-all-btn"
            onClick={
              sendRemindersToAll
            }
            disabled={
              sendingAllReminders ||
              tenants.length === 0 ||
              tenantsWithEmailCount === 0
            }
          >
            {sendingAllReminders
              ? "📨 Sending..."
              : "📧 Send Reminders to All"}
          </button>

        </div>

        <div className="table-responsive tenant-billing-scroll">

          <table>

            <thead>

              <tr>

                <th>Name</th>
                <th>Phone</th>
                <th>Room</th>
                <th>Rent</th>
                <th>Previous</th>
                <th>Current</th>
                <th>Units</th>
                <th>Electricity</th>
                <th>Extra Bill</th>
                <th>Total Due</th>
                <th>Status</th>
                <th>Billing Status</th>
                <th>Bill Generation</th>

                <th className="actions-th">
                  Actions
                </th>

              </tr>

            </thead>

            <tbody>

              {tenants.map((tenant) => {

                const electricityUnits =
                  getElectricityUnits(
                    tenant.id
                  );

                const electricityBill =
                  getElectricityBill(
                    tenant.id
                  );

                const totalAmount =
                  getTotalAmount(
                    tenant
                  );

                const isSendingReminder =
                  sendingReminderId ===
                  tenant.id;

                const isUpdatingBilling =
                  updatingBillingId ===
                  tenant.id;

                return (
                  <tr key={tenant.id}>

                    <td
                      className="col-name"
                      data-label="Name"
                    >
                      <button
                        type="button"
                        className="tenant-name-btn"
                        onClick={() =>
                          openTenantDetails(
                            tenant
                          )
                        }
                        title="View tenant details"
                      >
                        {tenant.full_name}
                      </button>
                    </td>

                    <td data-label="Phone">
                      {tenant.phone}
                    </td>

                    <td data-label="Room">
                      {tenant.room_number}
                    </td>

                    <td data-label="Rent">
                      ₹
                      {Number(
                        tenant.monthly_rent
                      ).toLocaleString(
                        "en-IN"
                      )}
                    </td>

                    <td data-label="Previous">

                      <input
                        type="number"
                        min="0"
                        className="reading-input"
                        value={
                          meterReadings[
                            tenant.id
                          ]
                            ?.previous_reading ??
                          ""
                        }
                        onChange={(e) =>
                          handleReadingChange(
                            tenant.id,
                            "previous_reading",
                            e.target.value
                          )
                        }
                      />

                    </td>

                    <td data-label="Current">

                      <input
                        type="number"
                        min="0"
                        className="reading-input"
                        value={
                          meterReadings[
                            tenant.id
                          ]
                            ?.current_reading ??
                          ""
                        }
                        onChange={(e) =>
                          handleReadingChange(
                            tenant.id,
                            "current_reading",
                            e.target.value
                          )
                        }
                      />

                    </td>

                    <td data-label="Units">
                      {electricityUnits}
                    </td>

                    <td data-label="Electricity">
                      ₹
                      {electricityBill.toLocaleString(
                        "en-IN"
                      )}
                    </td>

                    <td data-label="Extra Bill">

                      <input
                        type="number"
                        min="0"
                        className="reading-input"
                        value={
                          extraBills[
                            tenant.id
                          ] ?? ""
                        }
                        onChange={(e) =>
                          handleExtraBillChange(
                            tenant.id,
                            e.target.value
                          )
                        }
                      />

                    </td>

                    <td
                      className="col-total"
                      data-label="Total Due"
                    >
                      ₹
                      {totalAmount.toLocaleString(
                        "en-IN"
                      )}
                    </td>

                    <td data-label="Status">

                      <span className="status-active">
                        {tenant.status}
                      </span>

                    </td>

                    <td data-label="Billing Status">

                      {tenant.billing_ready ? (
                        <span className="billing-ready">
                          ✅ Ready
                        </span>
                      ) : (
                        <span className="billing-needs-update">
                          ⏳ Needs Update
                        </span>
                      )}

                    </td>

                    <td data-label="Bill Generation">

                      <button
                        type="button"
                        className={`billing-toggle-btn ${
                          tenant.billing_enabled
                            ? "enabled"
                            : "disabled"
                        }`}
                        onClick={() =>
                          toggleBilling(
                            tenant
                          )
                        }
                        disabled={
                          isUpdatingBilling ||
                          sendingAllReminders
                        }
                      >
                        {isUpdatingBilling
                          ? "Updating..."
                          : tenant.billing_enabled
                          ? "🟢 Enabled"
                          : "🔴 Disabled"}
                      </button>

                    </td>

                    <td data-label="Actions">

                      <div className="action-buttons">

                        <button
                          type="button"
                          className="edit-btn"
                          onClick={() =>
                            editTenant(
                              tenant
                            )
                          }
                          disabled={
                            sendingAllReminders
                          }
                        >
                          ✏️ Edit
                        </button>

                        <button
                          type="button"
                          className="delete-btn"
                          onClick={() =>
                            deleteTenant(
                              tenant.id
                            )
                          }
                          disabled={
                            sendingAllReminders
                          }
                        >
                          🗑 Delete
                        </button>

                        <button
                          type="button"
                          className="email-btn"
                          onClick={() =>
                            sendReminder(
                              tenant
                            )
                          }
                          disabled={
                            isSendingReminder ||
                            sendingAllReminders ||
                            !tenant.email
                          }
                          title={
                            !tenant.email
                              ? "No email address available"
                              : "Send payment reminder by email"
                          }
                        >
                          {isSendingReminder
                            ? "📨 Sending..."
                            : "📧 Remind"}
                        </button>

                      </div>

                    </td>

                  </tr>
                );
              })}

            </tbody>

          </table>

          {tenants.length === 0 && (
            <p className="empty-text">
              No tenants found.
            </p>
          )}

        </div>

        <div className="save-all-container">

          <button
            type="button"
            className="save-all-btn"
            onClick={
              saveAllElectricity
            }
            disabled={savingAll}
          >
            {savingAll
              ? "💾 Saving..."
              : "💾 Save All"}
          </button>

        </div>

      </div>

      {selectedTenant && (
        <div
          className="tenant-details-overlay"
          onClick={closeTenantDetails}
        >
          <div
            className="tenant-details-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <div className="tenant-details-header">

              <div>
                <h2>
                  Tenant Details
                </h2>

                <p>
                  Complete information about
                  the selected tenant
                </p>
              </div>

              <button
                type="button"
                className="tenant-details-close"
                onClick={
                  closeTenantDetails
                }
                aria-label="Close"
              >
                ×
              </button>

            </div>

            <div className="tenant-details-body">

              <div className="tenant-detail-item">
                <span className="tenant-detail-label">
                  Name
                </span>

                <span className="tenant-detail-value">
                  {selectedTenant.full_name}
                </span>
              </div>

              <div className="tenant-detail-item">
                <span className="tenant-detail-label">
                  Phone Number
                </span>

                <span className="tenant-detail-value">
                  {selectedTenant.phone}
                </span>
              </div>

              <div className="tenant-detail-item">
                <span className="tenant-detail-label">
                  Email
                </span>

                <span className="tenant-detail-value">
                  {selectedTenant.email ||
                    "Not available"}
                </span>
              </div>

              <div className="tenant-detail-item">
                <span className="tenant-detail-label">
                  Room
                </span>

                <span className="tenant-detail-value">
                  {selectedTenant.room_number ||
                    "Not assigned"}
                </span>
              </div>

              <div className="tenant-detail-item">
                <span className="tenant-detail-label">
                  Monthly Rent
                </span>

                <span className="tenant-detail-value">
                  ₹
                  {Number(
                    selectedTenant.monthly_rent
                  ).toLocaleString(
                    "en-IN"
                  )}
                </span>
              </div>

              <div className="tenant-detail-item">
                <span className="tenant-detail-label">
                  Joined Date
                </span>

                <span className="tenant-detail-value">
                  {selectedTenant.join_date
                    ? new Date(
                        selectedTenant.join_date
                      ).toLocaleDateString(
                        "en-GB",
                        {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        }
                      )
                    : "Not available"}
                </span>
              </div>

              <div className="tenant-detail-item">
                <span className="tenant-detail-label">
                  Status
                </span>

                <span className="tenant-detail-value">
                  {selectedTenant.status}
                </span>
              </div>

              <div className="tenant-detail-item">
                <span className="tenant-detail-label">
                  Bill Generation
                </span>

                <span className="tenant-detail-value">
                  {selectedTenant.billing_enabled
                    ? "🟢 Enabled"
                    : "🔴 Disabled"}
                </span>
              </div>

            </div>

            <div className="tenant-details-footer">

              <button
                type="button"
                className="tenant-details-close-btn"
                onClick={
                  closeTenantDetails
                }
              >
                Close
              </button>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}

export default Tenants;

