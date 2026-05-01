import { ChevronDown, Copy, FolderOpen, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PageTreeController } from "../sync/usePageTree";
import { getVaultAccessContext } from "./vaultAccessContext";

type VaultProfileMenuProps = {
  pageCount: number;
  pageTree: PageTreeController;
  onOpenVaultManager: () => void;
};

export function VaultProfileMenu({ pageCount, pageTree, onOpenVaultManager }: VaultProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const vaultName = pageTree.vaultName ?? "No vault";
  const vaultPath = pageTree.vaultPath ?? "";
  const accessContext = getVaultAccessContext(window.location.hostname);

  useEffect(() => {
    if (!open) return;

    function closeOnPointerDown(event: PointerEvent) {
      if (menuRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("pointerdown", closeOnPointerDown);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOnPointerDown);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  async function copyVaultPath() {
    if (!vaultPath) return;

    const copied = await copyText(vaultPath);
    setStatus(copied ? accessContext.copiedStatus : "Copy unavailable");
  }

  async function revealVault() {
    if (!vaultPath) return;

    try {
      await pageTree.revealVault();
      setOpen(false);
    } catch {
      setStatus("Could not reveal folder");
    }
  }

  function openVaultManager() {
    setOpen(false);
    onOpenVaultManager();
  }

  return (
    <div className="vault-profile" ref={menuRef}>
      <button
        type="button"
        className="vault-profile-button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setStatus(null);
          setOpen((current) => !current);
        }}
      >
        <span className="app-logo vault-profile-logo" aria-hidden="true">
          🦉
        </span>
        <span className="vault-profile-copy">
          <span className="vault-profile-name">{vaultName}</span>
          <span className="vault-profile-meta">{pageCount === 1 ? "1 page" : `${pageCount} pages`}</span>
        </span>
        <ChevronDown aria-hidden="true" size={15} />
      </button>

      {open ? (
        <div className="vault-profile-menu" role="menu">
          {accessContext.canRevealInSystem ? (
            <button type="button" role="menuitem" disabled={!vaultPath} onClick={() => void revealVault()}>
              <FolderOpen aria-hidden="true" size={15} />
              Reveal in Finder
            </button>
          ) : null}
          <button type="button" role="menuitem" disabled={!vaultPath} onClick={() => void copyVaultPath()}>
            <Copy aria-hidden="true" size={15} />
            {status ?? accessContext.copyLabel}
          </button>
          {accessContext.remotePathWarning ? <p className="vault-profile-note">{accessContext.remotePathWarning}</p> : null}
          <button type="button" role="menuitem" onClick={openVaultManager}>
            <RotateCcw aria-hidden="true" size={15} />
            Switch vault...
          </button>
        </div>
      ) : null}
    </div>
  );
}

async function copyText(value: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    return false;
  }

  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.append(input);
  input.select();

  try {
    return document.execCommand("copy");
  } finally {
    input.remove();
  }
}
