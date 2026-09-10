import CodeBlock from "@tiptap/extension-code-block";
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { useEffect, useMemo, useState } from "react";

let renderSequence = 0;

export const OpenWriteCodeBlock = CodeBlock.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView);
  },
});

export function isMermaidLanguage(language: unknown) {
  return String(language ?? "").trim().toLowerCase() === "mermaid";
}

function CodeBlockView({ node, selected }: ReactNodeViewProps) {
  const language = String(node.attrs.language ?? "");

  if (!isMermaidLanguage(language)) {
    return (
      <NodeViewWrapper as="pre" className={selected ? "ProseMirror-selectednode" : ""}>
        <NodeViewContent<"code"> as="code" spellCheck={false} />
      </NodeViewWrapper>
    );
  }

  return <MermaidCodeBlockView code={node.textContent} selected={selected} />;
}

function MermaidCodeBlockView({ code, selected }: { code: string; selected: boolean }) {
  const source = useMemo(() => code.trim(), [code]);
  const [state, setState] = useState<MermaidRenderState>({ status: "idle", svg: "" });

  useEffect(() => {
    let canceled = false;

    async function renderDiagram() {
      if (!source) {
        setState({ status: "idle", svg: "" });
        return;
      }

      setState({ status: "loading", svg: "" });

      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize(getMermaidConfig());

        const renderId = `openwrite-mermaid-${renderSequence++}`;
        const rendered = await mermaid.render(renderId, source);
        if (!canceled) setState({ status: "ready", svg: rendered.svg });
      } catch (error) {
        if (!canceled) setState({ status: "error", svg: "", message: mermaidErrorMessage(error) });
      }
    }

    renderDiagram();

    return () => {
      canceled = true;
    };
  }, [source]);

  return (
    <NodeViewWrapper className={`mermaid-code-block${selected ? " ProseMirror-selectednode" : ""}`}>
      <div className="mermaid-code-preview" contentEditable={false}>
        {state.status === "ready" ? (
          <div className="mermaid-code-svg" dangerouslySetInnerHTML={{ __html: state.svg }} />
        ) : (
          <div className={`mermaid-code-message ${state.status === "error" ? "error" : ""}`}>
            {state.status === "error" ? state.message : source ? "Rendering diagram..." : "Write Mermaid to render a diagram."}
          </div>
        )}
      </div>
      <div className="mermaid-code-editor" data-language="Mermaid">
        <NodeViewContent<"code"> as="code" spellCheck={false} />
      </div>
    </NodeViewWrapper>
  );
}

type MermaidRenderState =
  | { status: "idle" | "loading"; svg: "" }
  | { status: "ready"; svg: string }
  | { status: "error"; svg: ""; message: string };

function mermaidErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Unable to render Mermaid diagram.";
}

function getMermaidConfig() {
  const token = (name: string, fallback: string) => {
    if (typeof document === "undefined") return fallback;
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  };

  return {
    startOnLoad: false,
    securityLevel: "strict" as const,
    theme: "base" as const,
    themeVariables: {
      background: token("--editor-bg", "#fffaf0"),
      edgeLabelBackground: token("--editor-bg", "#fffaf0"),
      fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      lineColor: token("--text-muted", "#667085"),
      mainBkg: token("--surface-detail", "#f8f1e5"),
      nodeBorder: token("--border-divider", "#cfc6b8"),
      noteBkgColor: token("--surface-detail", "#f8f1e5"),
      noteTextColor: token("--text-body", "#1f2937"),
      primaryBorderColor: token("--border-divider", "#cfc6b8"),
      primaryColor: token("--surface-detail", "#f8f1e5"),
      primaryTextColor: token("--text-body", "#1f2937"),
      secondaryBorderColor: token("--border-divider", "#cfc6b8"),
      secondaryColor: token("--surface-elevated", "#fffdf8"),
      secondaryTextColor: token("--text-body", "#1f2937"),
      tertiaryBorderColor: token("--border-divider", "#cfc6b8"),
      tertiaryColor: token("--surface-note", "#f7f1e8"),
      tertiaryTextColor: token("--text-body", "#1f2937"),
    },
  };
}
