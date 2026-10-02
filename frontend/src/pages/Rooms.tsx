import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import api from "../api/axios";
import PageNav from "../components/PageNav";
import { useModal } from "../context/ModalContext";

import "./Rooms.css";

interface Room {
  id: number;
  room_number: string;
  floor: number;
  room_type: string;
  capacity: number;
  monthly_rent: number;
  status: string;
}

interface UserSession {
  role?: string;
  [key: string]: unknown;
}

function Rooms() {
  const navigate = useNavigate();

  const {
    showSuccess,
    showError,
    showWarning,
    showConfirm,
  } = useModal();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const [roomNumber, setRoomNumber] = useState<string>("");
  const [floor, setFloor] = useState<string>("");
  const [roomType, setRoomType] = useState<string>("");
  const [capacity, setCapacity] = useState<string>("");
  const [monthlyRent, setMonthlyRent] = useState<string>("");
  const [editingRoomId, setEditingRoomId] = useState<number | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("All");

  useEffect(() => {
    const user = localStorage.getItem("user");

    if (!user) {
      navigate("/login", { replace: true });
      return;
    }

    try {
      const parsedUser: UserSession = JSON.parse(user);

      if (parsedUser.role !== "owner") {
        navigate("/dashboard", { replace: true });
        return;
      }

      loadRooms();
    } catch (error) {
      console.error("Invalid user session", error);
      localStorage.removeItem("user");
      navigate("/login", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const loadRooms = async () => {
    setIsLoading(true);

    try {
      const response = await api.get<Room[]>("/rooms/");

      const sortedRooms = [...response.data].sort((a, b) =>
        a.room_number.localeCompare(b.room_number, undefined, {
          numeric: true,
        })
      );

      setRooms(sortedRooms);
    } catch (error) {
      console.error("Error fetching rooms:", error);

      showError(
        "Failed to Load Rooms",
        "Failed to load rooms. Please check your connection."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const clearForm = () => {
    setRoomNumber("");
    setFloor("");
    setRoomType("");
    setCapacity("");
    setMonthlyRent("");
    setEditingRoomId(null);
  };

  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!roomNumber.trim()) {
      showWarning(
        "Room Number Required",
        "Please enter a Room Number."
      );
      return;
    }

    if (!floor.trim()) {
      showWarning(
        "Floor Number Required",
        "Please enter Floor Number."
      );
      return;
    }

    if (!roomType.trim()) {
      showWarning(
        "Room Type Required",
        "Please select Room Type."
      );
      return;
    }

    if (!capacity.trim()) {
      showWarning(
        "Capacity Required",
        "Please enter Room Capacity."
      );
      return;
    }

    if (!monthlyRent.trim()) {
      showWarning(
        "Monthly Rent Required",
        "Please enter Monthly Rent."
      );
      return;
    }

    const numericFloor = Number(floor);
    const numericCapacity = Number(capacity);
    const numericRent = Number(monthlyRent);

    if (!Number.isFinite(numericFloor) || numericFloor < 0) {
      showWarning(
        "Invalid Floor Number",
        "Please enter a valid floor number (0 or higher)."
      );
      return;
    }

    if (
      !Number.isFinite(numericCapacity) ||
      !Number.isInteger(numericCapacity) ||
      numericCapacity < 1
    ) {
      showWarning(
        "Invalid Capacity",
        "Please enter a valid capacity (1 or higher)."
      );
      return;
    }

    if (!Number.isFinite(numericRent) || numericRent <= 0) {
      showWarning(
        "Invalid Monthly Rent",
        "Please enter a valid monthly rent amount."
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        room_number: roomNumber.trim(),
        floor: numericFloor,
        room_type: roomType.trim(),
        capacity: numericCapacity,
        monthly_rent: numericRent,
      };

      if (editingRoomId !== null) {
        await api.put(`/rooms/${editingRoomId}`, payload);

        showSuccess(
          "Room Updated",
          "Room updated successfully!"
        );
      } else {
        await api.post("/rooms/", payload);

        showSuccess(
          "Room Added",
          "Room added successfully!"
        );
      }

      clearForm();
      await loadRooms();
    } catch (error: unknown) {
      console.error(error);

      if (axios.isAxiosError(error)) {
        const serverError = error.response?.data?.detail;

        showError(
          editingRoomId !== null
            ? "Failed to Update Room"
            : "Failed to Add Room",
          serverError ||
            (editingRoomId !== null
              ? "Failed to update room."
              : "Failed to add room.")
        );
      } else {
        showError(
          "Unexpected Error",
          "An unexpected error occurred."
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditRoom = (room: Room) => {
    setEditingRoomId(room.id);
    setRoomNumber(room.room_number);
    setFloor(room.floor.toString());
    setRoomType(room.room_type);
    setCapacity(room.capacity.toString());
    setMonthlyRent(room.monthly_rent.toString());

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const handleDeleteRoom = async (room: Room) => {
    const confirmDelete = await showConfirm(
      "Delete Room",
      `Are you sure you want to delete Room "${room.room_number}"? This action cannot be undone.`,
      {
        confirmText: "Delete",
        cancelText: "Cancel",
      }
    );

    if (!confirmDelete) {
      return;
    }

    try {
      await api.delete(`/rooms/${room.id}`);

      if (editingRoomId === room.id) {
        clearForm();
      }

      showSuccess(
        "Room Deleted",
        "Room deleted successfully."
      );

      await loadRooms();
    } catch (error: unknown) {
      console.error(error);

      if (axios.isAxiosError(error)) {
        showError(
          "Failed to Delete Room",
          error.response?.data?.detail ||
            "Failed to delete room."
        );
      } else {
        showError(
          "Failed to Delete Room",
          "Failed to delete room."
        );
      }
    }
  };

  const occupiedCount = useMemo(
    () =>
      rooms.filter(
        (r) => r.status?.toLowerCase() === "occupied"
      ).length,
    [rooms]
  );

  const vacantCount = useMemo(
    () =>
      rooms.filter(
        (r) => r.status?.toLowerCase() !== "occupied"
      ).length,
    [rooms]
  );

  const filteredRooms = useMemo(() => {
    const query = searchQuery.toLowerCase();

    return rooms.filter((room) => {
      const matchesSearch =
        room.room_number.toLowerCase().includes(query) ||
        room.floor.toString().includes(query) ||
        room.room_type.toLowerCase().includes(query) ||
        room.capacity.toString().includes(query) ||
        room.monthly_rent.toString().includes(query);

      const isOccupied =
        room.status?.toLowerCase() === "occupied";

      const matchesStatus =
        statusFilter === "All" ||
        (statusFilter === "Occupied" && isOccupied) ||
        (statusFilter === "Vacant" && !isOccupied);

      return matchesSearch && matchesStatus;
    });
  }, [rooms, searchQuery, statusFilter]);

  return (
    <div className="rooms-container">
      <PageNav current="rooms" />

      <header className="rooms-header">
        <div className="rooms-header-left">
          <div className="rooms-page-icon">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>

          <div>
            <h1 className="rooms-page-title">
              Manage Rooms
            </h1>

            <p className="rooms-page-subtitle">
              Monitor room assignments, monthly rental rates,
              and real-time occupancy.
            </p>
          </div>
        </div>

        <div className="rooms-header-badge">
          <span>{rooms.length} Total Registered</span>
        </div>
      </header>

      <div className="rooms-stats-grid">
        <div className="rooms-stat-card stat-total">
          <div className="stat-icon-wrapper">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect
                x="3"
                y="3"
                width="7"
                height="7"
                rx="1"
              />
              <rect
                x="14"
                y="3"
                width="7"
                height="7"
                rx="1"
              />
              <rect
                x="14"
                y="14"
                width="7"
                height="7"
                rx="1"
              />
              <rect
                x="3"
                y="14"
                width="7"
                height="7"
                rx="1"
              />
            </svg>
          </div>

          <div className="stat-content">
            <span className="stat-label">
              Total Inventory
            </span>

            <h2 className="stat-value">
              {rooms.length}
            </h2>
          </div>
        </div>

        <div className="rooms-stat-card stat-occupied">
          <div className="stat-icon-wrapper">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <polyline points="16 11 18 13 22 9" />
            </svg>
          </div>

          <div className="stat-content">
            <span className="stat-label">
              Occupied
            </span>

            <h2 className="stat-value">
              {occupiedCount}
            </h2>
          </div>
        </div>

        <div className="rooms-stat-card stat-vacant">
          <div className="stat-icon-wrapper">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
              />
              <line
                x1="12"
                y1="8"
                x2="12"
                y2="12"
              />
              <line
                x1="12"
                y1="16"
                x2="12.01"
                y2="16"
              />
            </svg>
          </div>

          <div className="stat-content">
            <span className="stat-label">
              Vacant
            </span>

            <h2 className="stat-value">
              {vacantCount}
            </h2>
          </div>
        </div>
      </div>

      <section
        className={`room-form-card ${
          editingRoomId !== null ? "is-editing" : ""
        }`}
      >
        <div className="room-form-header">
          <div className="form-header-icon">
            {editingRoomId !== null ? (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            ) : (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line
                  x1="12"
                  y1="5"
                  x2="12"
                  y2="19"
                />
                <line
                  x1="5"
                  y1="12"
                  x2="19"
                  y2="12"
                />
              </svg>
            )}
          </div>

          <div>
            <h2 className="form-title">
              {editingRoomId !== null
                ? "Edit Room Details"
                : "Create New Room"}
            </h2>

            <p className="form-subtitle">
              {editingRoomId !== null
                ? `Modifying configuration for Unit ID #${editingRoomId}`
                : "Fill in the required information below to register a unit."}
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSaveRoom}
          className="room-form"
        >
          <div className="room-form-grid">
            <div className="room-field">
              <label htmlFor="room-number">
                Room / Flat Number
              </label>

              <input
                id="room-number"
                type="text"
                placeholder="e.g. A-101"
                value={roomNumber}
                onChange={(e) =>
                  setRoomNumber(e.target.value)
                }
                required
              />
            </div>

            <div className="room-field">
              <label htmlFor="floor">
                Floor Level
              </label>

              <input
                id="floor"
                type="text"
                inputMode="numeric"
                placeholder="e.g. 1"
                value={floor}
                onChange={(e) =>
                  setFloor(
                    e.target.value.replace(/\D/g, "")
                  )
                }
                required
              />
            </div>

            <div className="room-field">
              <label htmlFor="room-type">
                Room Type
              </label>

              <select
                id="room-type"
                value={roomType}
                onChange={(e) =>
                  setRoomType(e.target.value)
                }
                required
              >
                <option value="">
                  Select Room Type
                </option>

                <option value="1 BHK">
                  1 BHK
                </option>

                <option value="2 BHK">
                  2 BHK
                </option>

                <option value="3 BHK">
                  3 BHK
                </option>

                <option value="4 BHK">
                  4 BHK
                </option>

                <option value="5 BHK">
                  5 BHK
                </option>
              </select>
            </div>

            <div className="room-field">
              <label htmlFor="capacity">
                Capacity
              </label>

              <input
                id="capacity"
                type="text"
                inputMode="numeric"
                placeholder="e.g. 2"
                value={capacity}
                onChange={(e) =>
                  setCapacity(
                    e.target.value.replace(/\D/g, "")
                  )
                }
                required
              />

              <span className="field-hint">
                Maximum people allowed
              </span>
            </div>

            <div className="room-field">
              <label htmlFor="monthly-rent">
                Monthly Rent
              </label>

              <div className="rent-input-wrapper">
                <span className="currency-prefix">
                  ₹
                </span>

                <input
                  id="monthly-rent"
                  type="text"
                  inputMode="numeric"
                  placeholder="e.g. 8500"
                  value={monthlyRent}
                  onChange={(e) =>
                    setMonthlyRent(
                      e.target.value.replace(/\D/g, "")
                    )
                  }
                  required
                />
              </div>
            </div>
          </div>

          <div className="room-form-actions">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rooms-save-btn"
            >
              {isSubmitting ? (
                <span className="btn-spinner" />
              ) : editingRoomId !== null ? (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <line
                    x1="12"
                    y1="5"
                    x2="12"
                    y2="19"
                  />
                  <line
                    x1="5"
                    y1="12"
                    x2="19"
                    y2="12"
                  />
                </svg>
              )}

              <span>
                {isSubmitting
                  ? "Saving..."
                  : editingRoomId !== null
                  ? "Save Changes"
                  : "Add Room"}
              </span>
            </button>

            {editingRoomId !== null && (
              <button
                type="button"
                className="rooms-cancel-btn"
                onClick={clearForm}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="rooms-table-card">
        <div className="rooms-table-toolbar">
          <div className="toolbar-left">
            <h2 className="table-title">
              Registered Rooms
            </h2>

            <p className="table-subtitle">
              Manage status, floor plans, and pricing
            </p>
          </div>

          <div className="toolbar-right">
            <div className="table-search-input">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle
                  cx="11"
                  cy="11"
                  r="8"
                />

                <line
                  x1="21"
                  y1="21"
                  x2="16.65"
                  y2="16.65"
                />
              </svg>

              <input
                type="text"
                placeholder="Search rooms..."
                value={searchQuery}
                onChange={(e) =>
                  setSearchQuery(e.target.value)
                }
              />
            </div>

            <div className="table-filter-pills">
              {["All", "Occupied", "Vacant"].map(
                (filter) => (
                  <button
                    key={filter}
                    type="button"
                    className={`filter-pill ${
                      statusFilter === filter
                        ? "active"
                        : ""
                    }`}
                    onClick={() =>
                      setStatusFilter(filter)
                    }
                  >
                    {filter}
                  </button>
                )
              )}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="rooms-skeleton-container">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="skeleton-row"
              />
            ))}
          </div>
        ) : filteredRooms.length > 0 ? (
          <div className="rooms-table-wrapper">
            <table className="rooms-table">
              <thead>
                <tr>
                  <th>Room / Unit</th>
                  <th>Floor</th>
                  <th>Room Type</th>
                  <th>Capacity</th>
                  <th>Monthly Rent</th>
                  <th>Status</th>
                  <th className="actions-header">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredRooms.map((room) => {
                  const isOccupied =
                    room.status?.toLowerCase() ===
                    "occupied";

                  return (
                    <tr
                      key={room.id}
                      className={
                        editingRoomId === room.id
                          ? "row-highlighted"
                          : ""
                      }
                    >
                      <td>
                        <div className="room-name-cell">
                          <div className="room-mini-icon">
                            <svg
                              width="18"
                              height="18"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                            </svg>
                          </div>

                          <div>
                            <strong className="room-title">
                              {room.room_number}
                            </strong>

                            <span className="room-id">
                              ID: #{room.id}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="floor-badge">
                          Floor {room.floor}
                        </span>
                      </td>

                      <td>
                        <span className="room-type-badge">
                          {room.room_type}
                        </span>
                      </td>

                      <td>
                        <span className="capacity-value">
                          {room.capacity}{" "}
                          {room.capacity === 1
                            ? "Person"
                            : "People"}
                        </span>
                      </td>

                      <td>
                        <span className="rent-value">
                          ₹
                          {Number(
                            room.monthly_rent || 0
                          ).toLocaleString("en-IN")}
                        </span>

                        <span className="rent-label">
                          / month
                        </span>
                      </td>

                      <td>
                        <span
                          className={`rooms-status ${
                            isOccupied
                              ? "occupied"
                              : "vacant"
                          }`}
                        >
                          <span className="status-dot" />

                          {isOccupied
                            ? "Occupied"
                            : "Vacant"}
                        </span>
                      </td>

                      <td>
                        <div className="rooms-action-buttons">
                          <button
                            type="button"
                            className="rooms-edit-btn"
                            onClick={() =>
                              handleEditRoom(room)
                            }
                            title="Edit Room"
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>

                            Edit
                          </button>

                          <button
                            type="button"
                            className="rooms-delete-btn"
                            onClick={() =>
                              handleDeleteRoom(room)
                            }
                            title="Delete Room"
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <polyline points="3 6 5 6 21 6" />

                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>

                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rooms-empty-state">
            <div className="rooms-empty-icon">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <circle
                  cx="11"
                  cy="11"
                  r="8"
                />

                <line
                  x1="21"
                  y1="21"
                  x2="16.65"
                  y2="16.65"
                />
              </svg>
            </div>

            <h3>No Rooms Found</h3>

            <p>
              {searchQuery ||
              statusFilter !== "All"
                ? "No units match your active filter criteria."
                : "Your inventory is currently empty. Add your first room using the form above."}
            </p>

            {searchQuery ||
            statusFilter !== "All" ? (
              <button
                type="button"
                className="rooms-reset-filter-btn"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("All");
                }}
              >
                Clear Filters
              </button>
            ) : (
              <button
                type="button"
                className="rooms-empty-btn"
                onClick={() => {
                  document
                    .getElementById("room-number")
                    ?.focus();
                }}
              >
                + Register First Room
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

export default Rooms;