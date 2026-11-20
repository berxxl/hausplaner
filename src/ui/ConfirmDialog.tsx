import { useEffect, useRef } from "react";

export interface ConfirmRequest {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
}

export function ConfirmDialog({
  request,
  onClose,
}: {
  request: ConfirmRequest;
  onClose(ok: boolean): void;
}) {
  const confirmButton = useRef<HTMLButtonElement>(null);
  useEffect(() => confirmButton.current?.focus(), []);
  return (
    <div className="dialog-backdrop">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="dialog"
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose(false);
        }}
      >
        <h2 id="confirm-title">{request.title}</h2>
        {request.message && <p>{request.message}</p>}
        <div className="dialog__buttons">
          <button type="button" onClick={() => onClose(false)}>
            {request.cancelLabel ?? "Abbrechen"}
          </button>
          <button type="button" ref={confirmButton} onClick={() => onClose(true)}>
            {request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
