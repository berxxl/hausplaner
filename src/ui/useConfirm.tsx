import { useCallback, useState } from "react";
import { ConfirmDialog, type ConfirmRequest } from "./ConfirmDialog";

interface Pending extends ConfirmRequest {
  resolve(ok: boolean): void;
}

/** Modale Rückfrage; `confirm()` liefert ein Promise mit der Antwort. */
export function useConfirm() {
  const [pending, setPending] = useState<Pending | null>(null);
  const confirm = useCallback(
    (request: ConfirmRequest) =>
      new Promise<boolean>((resolve) => setPending({ ...request, resolve })),
    [],
  );
  const close = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };
  const dialog = pending ? <ConfirmDialog request={pending} onClose={close} /> : null;
  return { confirm, dialog };
}
