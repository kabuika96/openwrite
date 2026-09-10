import type { MobileViewportDiagnostics } from "./useViewportDiagnostics";

type MobileDiagnosticsOverlayProps = {
  diagnostics: MobileViewportDiagnostics;
};

export function MobileDiagnosticsOverlay({ diagnostics }: MobileDiagnosticsOverlayProps) {
  return (
    <aside className="ow-mobile-diagnostics" aria-label="Mobile diagnostics">
      <dl>
        <div>
          <dt>screen</dt>
          <dd>{diagnostics.activeScreen}</dd>
        </div>
        <div>
          <dt>scroll</dt>
          <dd>{diagnostics.scrollOwner}</dd>
        </div>
        <div>
          <dt>layout</dt>
          <dd>{Math.round(diagnostics.layoutViewportHeight)}px</dd>
        </div>
        <div>
          <dt>visual</dt>
          <dd>{diagnostics.visualViewportHeight === null ? "n/a" : `${Math.round(diagnostics.visualViewportHeight)}px`}</dd>
        </div>
        <div>
          <dt>safe</dt>
          <dd>
            {diagnostics.safeAreaTop}/{diagnostics.safeAreaBottom}
          </dd>
        </div>
        <div>
          <dt>focus</dt>
          <dd>{diagnostics.focusedElement}</dd>
        </div>
      </dl>
    </aside>
  );
}
