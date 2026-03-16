import { useEffect, useRef } from 'react';

export default function ConfirmDialog({ open, title, message, confirmLabel, cancelLabel, onConfirm, onCancel, danger = false }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (open) {
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [open]);

  if (!open) return null;

  return (
    <dialog ref={dialogRef} className="confirm-dialog" onClose={onCancel}>
      <div className="confirm-dialog-content">
        {title && <h3 className="confirm-dialog-title">{title}</h3>}
        <p className="confirm-dialog-message">{message}</p>
        <div className="confirm-dialog-actions">
          <button className="btn btn-outline btn-sm" onClick={onCancel}>
            {cancelLabel || 'Cancel'}
          </button>
          <button
            className={`btn btn-sm ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            autoFocus
          >
            {confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
