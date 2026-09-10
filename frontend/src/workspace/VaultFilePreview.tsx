import { Download, ExternalLink, FileText, Image as ImageIcon, Music, Video } from "lucide-react";
import { formatFileSize } from "../editor/fileUploads";
import { type VaultExplorerFileNode, vaultFileHref } from "../sync/vaultExplorer";

type VaultFilePreviewProps = {
  file: VaultExplorerFileNode;
};

export function VaultFilePreview({ file }: VaultFilePreviewProps) {
  const href = vaultFileHref(file.path);

  return (
    <section className="file-preview-shell">
      <header className="file-preview-header">
        <div className="file-preview-title">
          <span className="file-preview-icon">{renderPreviewIcon(file)}</span>
          <div>
            <h1>{file.title}</h1>
            <p>
              {file.extension.toUpperCase()}
              {file.size ? ` - ${formatFileSize(file.size)}` : ""}
            </p>
          </div>
        </div>
        <div className="file-preview-actions">
          <a href={href} target="_blank" rel="noreferrer">
            <ExternalLink aria-hidden="true" size={16} />
            <span>Open</span>
          </a>
          <a href={href} download={file.name}>
            <Download aria-hidden="true" size={16} />
            <span>Download</span>
          </a>
        </div>
      </header>
      <div className={`file-preview-body ${file.kind}`}>{renderPreview(file, href)}</div>
    </section>
  );
}

function renderPreview(file: VaultExplorerFileNode, href: string) {
  if (file.kind === "image") {
    return <img src={href} alt={file.title} />;
  }

  if (file.kind === "audio") {
    return <audio src={href} controls />;
  }

  if (file.kind === "video") {
    return <video src={href} controls playsInline />;
  }

  if (file.kind === "pdf" || file.kind === "canvas") {
    return <iframe src={href} title={`${file.title} preview`} />;
  }

  return (
    <a className="file-preview-open-link" href={href} target="_blank" rel="noreferrer">
      Open file
    </a>
  );
}

function renderPreviewIcon(file: VaultExplorerFileNode) {
  if (file.kind === "image") return <ImageIcon aria-hidden="true" size={22} />;
  if (file.kind === "audio") return <Music aria-hidden="true" size={22} />;
  if (file.kind === "video") return <Video aria-hidden="true" size={22} />;
  return <FileText aria-hidden="true" size={22} />;
}
