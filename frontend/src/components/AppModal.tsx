import React, { useEffect, useRef } from "react";
import "./AppModal.css";

type ModalType =
  | "success"
  | "error"
  | "warning"
  | "info"
  | "confirm";

interface AppModalProps {
  isOpen: boolean;
  type?: ModalType;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  showCancel?: boolean;
}

const modalIcons: Record<ModalType, string> = {
  success: "✓",
  error: "!",
  warning: "!",
  info: "i",
  confirm: "?",
};

function AppModal({
  isOpen,
  type = "info",
  title,
  message,
  confirmText = "OK",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  showCancel = false,
}: AppModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();

        onConfirm();
        return;
      }

      if (event.key === "Escape" && onCancel) {
        event.preventDefault();
        event.stopPropagation();

        onCancel();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);

    setTimeout(() => {
      modalRef.current?.focus();
    }, 0);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isOpen, onConfirm, onCancel]);

  if (!isOpen) {
    return null;
  }

  const handleOverlayClick = (
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    if (event.target === event.currentTarget && onCancel) {
      onCancel();
    }
  };

  return (
    <div
      className="app-modal-overlay"
      onClick={handleOverlayClick}
    >
      <div
        ref={modalRef}
        className={`app-modal app-modal-${type}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-modal-title"
        tabIndex={-1}
      >
        <div className="app-modal-icon">
          {modalIcons[type]}
        </div>

        <div className="app-modal-content">
          <h2 id="app-modal-title">
            {title}
          </h2>

          <p>
            {message}
          </p>
        </div>

        <div className="app-modal-actions">
          {showCancel && (
            <button
              type="button"
              className="app-modal-cancel-btn"
              onClick={onCancel}
            >
              {cancelText}
            </button>
          )}

          <button
            type="button"
            className={`app-modal-confirm-btn app-modal-confirm-${type}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AppModal;