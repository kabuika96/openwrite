import { X } from "lucide-react";
import { useEffect, useId, type ReactNode } from "react";

type AppDialogProps = {
  title: string;
  children: ReactNode;
  onClose?: () => void;
};

export function AppDialog({ title, children, onClose }: AppDialogProps) {
  const titleId = useId();

  useEffect(() => {
    if (!onClose) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose?.();
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div
      className="app-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <section className="app-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="app-dialog-header">
          <h2 id={titleId}>{title}</h2>
          {onClose ? (
            <button type="button" className="app-dialog-close" aria-label="Close dialog" onClick={onClose}>
              <X aria-hidden="true" size={18} />
            </button>
          ) : null}
        </header>
        {children}
      </section>
    </div>
  );
}
