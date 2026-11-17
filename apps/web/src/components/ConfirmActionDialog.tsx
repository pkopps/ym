"use client";
import type { ReactNode } from "react";
import { JourneyDialog } from "./JourneyDialog";

/** A centered confirmation for actions that commit the customer or can't be undone. */
export function ConfirmActionDialog({ title, children, confirmLabel, cancelLabel, busy = false, destructive = false, onConfirm, onClose }: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  busy?: boolean;
  destructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return <JourneyDialog title={title} className="journey-dialog--confirm" onClose={() => { if (!busy) onClose(); }}>
    <div className="journey-dialog__header"><h2>{title}</h2></div>
    <div className="confirm-action__body">{children}</div>
    <div className="confirm-action__actions">
      <button className={destructive ? "button-danger" : "button"} type="button" disabled={busy} onClick={onConfirm}>{confirmLabel}</button>
      <button className="button-secondary" type="button" disabled={busy} onClick={onClose}>{cancelLabel}</button>
    </div>
  </JourneyDialog>;
}
