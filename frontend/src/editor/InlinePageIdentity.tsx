import { useEffect, useMemo, useRef, useState } from "react";
import { PageIconGlyph } from "./PageIconGlyph";
import { getSystemPageIconOptions } from "./systemIcons";

export function InlinePageIdentity({
  icon,
  title,
  onRenamePage,
  onSetPageIcon,
}: {
  icon: string;
  title: string;
  onRenamePage: (title: string) => void;
  onSetPageIcon: (icon: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [iconQuery, setIconQuery] = useState("");
  const iconControlRef = useRef<HTMLDivElement | null>(null);
  const systemIcons = useMemo(() => getSystemPageIconOptions(iconQuery), [iconQuery]);

  useEffect(() => {
    if (!pickerOpen) return;

    function closeOnPointerDown(event: PointerEvent) {
      if (!iconControlRef.current?.contains(event.target as Node)) {
        setPickerOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setPickerOpen(false);
    }

    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [pickerOpen]);

  return (
    <div className="page-identity">
      <div className="page-icon-control" ref={iconControlRef}>
        <button
          type="button"
          className="page-icon-button"
          aria-label="Page icon"
          aria-expanded={pickerOpen}
          onClick={() => setPickerOpen((open) => !open)}
        >
          <PageIconGlyph icon={icon} size={44} />
        </button>
        {pickerOpen ? (
          <div className="page-icon-picker" role="menu" aria-label="Page icon options">
            <input
              autoFocus
              aria-label="Search icons"
              placeholder="Search icons"
              value={iconQuery}
              onChange={(event) => setIconQuery(event.target.value)}
            />
            <div className="page-icon-grid">
              {systemIcons.map((option) => (
                <button
                  type="button"
                  role="menuitem"
                  key={option.id}
                  title={option.label}
                  aria-label={option.label}
                  className={option.id === icon ? "active" : ""}
                  onClick={() => {
                    onSetPageIcon(option.id);
                    setPickerOpen(false);
                    setIconQuery("");
                  }}
                >
                  <PageIconGlyph icon={option.id} size={19} />
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <InlinePageTitle title={title} onRenamePage={onRenamePage} />
    </div>
  );
}

function InlinePageTitle({ title, onRenamePage }: { title: string; onRenamePage: (title: string) => void }) {
  const [draftTitle, setDraftTitle] = useState(title);

  useEffect(() => {
    setDraftTitle(title);
  }, [title]);

  function commit() {
    const nextTitle = draftTitle.trim();
    if (!nextTitle) {
      setDraftTitle(title);
      return;
    }

    if (nextTitle !== title) onRenamePage(nextTitle);
    setDraftTitle(nextTitle);
  }

  return (
    <>
      <input
        className="page-title-input"
        aria-label="Page title"
        value={draftTitle}
        onChange={(event) => setDraftTitle(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
          if (event.key === "Escape") {
            setDraftTitle(title);
            event.currentTarget.blur();
          }
        }}
      />
      <h1 className="page-title-print" aria-hidden="true">
        {draftTitle.trim() || title}
      </h1>
    </>
  );
}
