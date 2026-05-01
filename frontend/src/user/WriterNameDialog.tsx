import { useEffect, useState } from "react";
import { AppDialog } from "../components/AppDialog";
import { isRandomWriterName } from "./localUserState";

type WriterNameDialogProps = {
  initialName: string;
  required: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
};

export function WriterNameDialog({ initialName, required, onClose, onSubmit }: WriterNameDialogProps) {
  const [name, setName] = useState(initialName);
  const trimmedName = name.trim();
  const randomName = isRandomWriterName(trimmedName);
  const canSave = Boolean(trimmedName && !randomName);

  useEffect(() => {
    setName(initialName);
  }, [initialName]);

  return (
    <AppDialog title="Writer name" onClose={required ? undefined : onClose}>
      <form
        className="writer-name-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSave) return;
          onSubmit(trimmedName);
        }}
      >
        <label>
          <span>Name</span>
          <input
            autoFocus
            required
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value)}
            onFocus={(event) => {
              if (randomName) event.currentTarget.select();
            }}
          />
          {randomName ? <span className="writer-name-error">Use your name.</span> : null}
        </label>
        <div className="writer-name-actions">
          {!required ? (
            <button type="button" className="secondary" onClick={onClose}>
              Cancel
            </button>
          ) : null}
          <button type="submit" disabled={!canSave}>
            Save
          </button>
        </div>
      </form>
    </AppDialog>
  );
}
