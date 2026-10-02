import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import AppModal from "../components/AppModal";

type ModalType =
  | "success"
  | "error"
  | "warning"
  | "info"
  | "confirm";

interface ConfirmOptions {
  confirmText?: string;
  cancelText?: string;
}

interface ModalState {
  isOpen: boolean;
  type: ModalType;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  showCancel: boolean;
}

interface ModalContextValue {
  showSuccess: (title: string, message: string) => void;
  showError: (title: string, message: string) => void;
  showWarning: (title: string, message: string) => void;
  showInfo: (title: string, message: string) => void;
  showConfirm: (
    title: string,
    message: string,
    options?: ConfirmOptions
  ) => Promise<boolean>;
  closeModal: () => void;
}

const ModalContext = createContext<ModalContextValue | undefined>(
  undefined
);

const initialModalState: ModalState = {
  isOpen: false,
  type: "info",
  title: "",
  message: "",
  confirmText: "OK",
  cancelText: "Cancel",
  showCancel: false,
};

export function ModalProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [modal, setModal] = useState<ModalState>(
    initialModalState
  );

  const confirmResolver =
    useRef<((result: boolean) => void) | null>(null);

  const closeModal = useCallback(() => {
    setModal(initialModalState);
  }, []);

  const showSuccess = useCallback(
    (title: string, message: string) => {
      setModal({
        isOpen: true,
        type: "success",
        title,
        message,
        confirmText: "OK",
        cancelText: "Cancel",
        showCancel: false,
      });
    },
    []
  );

  const showError = useCallback(
    (title: string, message: string) => {
      setModal({
        isOpen: true,
        type: "error",
        title,
        message,
        confirmText: "OK",
        cancelText: "Cancel",
        showCancel: false,
      });
    },
    []
  );

  const showWarning = useCallback(
    (title: string, message: string) => {
      setModal({
        isOpen: true,
        type: "warning",
        title,
        message,
        confirmText: "OK",
        cancelText: "Cancel",
        showCancel: false,
      });
    },
    []
  );

  const showInfo = useCallback(
    (title: string, message: string) => {
      setModal({
        isOpen: true,
        type: "info",
        title,
        message,
        confirmText: "OK",
        cancelText: "Cancel",
        showCancel: false,
      });
    },
    []
  );

  const showConfirm = useCallback(
    (
      title: string,
      message: string,
      options?: ConfirmOptions
    ): Promise<boolean> => {
      return new Promise((resolve) => {
        confirmResolver.current = resolve;

        setModal({
          isOpen: true,
          type: "confirm",
          title,
          message,
          confirmText: options?.confirmText ?? "Confirm",
          cancelText: options?.cancelText ?? "Cancel",
          showCancel: true,
        });
      });
    },
    []
  );

  const handleConfirm = useCallback(() => {
    if (modal.type === "confirm") {
      confirmResolver.current?.(true);
      confirmResolver.current = null;
    }

    closeModal();
  }, [modal.type, closeModal]);

  const handleCancel = useCallback(() => {
    if (modal.type === "confirm") {
      confirmResolver.current?.(false);
      confirmResolver.current = null;
    }

    closeModal();
  }, [modal.type, closeModal]);

  return (
    <ModalContext.Provider
      value={{
        showSuccess,
        showError,
        showWarning,
        showInfo,
        showConfirm,
        closeModal,
      }}
    >
      {children}

      <AppModal
        isOpen={modal.isOpen}
        type={modal.type}
        title={modal.title}
        message={modal.message}
        confirmText={modal.confirmText}
        cancelText={modal.cancelText}
        showCancel={modal.showCancel}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ModalContext.Provider>
  );
}

export function useModal(): ModalContextValue {
  const context = useContext(ModalContext);

  if (!context) {
    throw new Error(
      "useModal must be used inside a ModalProvider"
    );
  }

  return context;
}