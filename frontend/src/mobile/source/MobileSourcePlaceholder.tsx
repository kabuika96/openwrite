import { IonContent } from "@ionic/react";
import type { MobileScreen } from "../shell/mobileScreenStack";

type MobileSourcePlaceholderProps = {
  screen: Extract<MobileScreen, { type: "source" }>;
};

export function MobileSourcePlaceholder({ screen }: MobileSourcePlaceholderProps) {
  return (
    <IonContent className="ow-mobile-content ow-mobile-source-content" fullscreen={false} scrollY={true}>
      <main className="ow-mobile-source-view" aria-label="Source">
        <p className="ow-mobile-surface-kicker">{screen.sourceId}</p>
        <h1>{screen.sourceTitle}</h1>
        <section className="ow-mobile-source-panel">
          <p>
            Source preview will render here with the same full-screen shell used by the production file viewer. The current
            spike keeps this screen separate from desktop explorer code.
          </p>
        </section>
      </main>
    </IonContent>
  );
}
