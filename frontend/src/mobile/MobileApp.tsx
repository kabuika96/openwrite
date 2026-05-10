import { IonApp, setupIonicReact } from "@ionic/react";
import { useMemo } from "react";
import { MobileShell } from "./shell/MobileShell";
import { useMobileDocumentMetadata } from "./pwaMetadata";
import "@ionic/react/css/core.css";
import "@ionic/react/css/normalize.css";
import "@ionic/react/css/structure.css";
import "@ionic/react/css/typography.css";
import "./styles/mobile.css";

setupIonicReact({
  animated: false,
  mode: "ios",
});

export type MobileFixtureMode = "connection" | "ready" | "setup";

export function MobileApp() {
  useMobileDocumentMetadata();
  const fixtureMode = useMemo(readMobileFixtureMode, []);

  return (
    <IonApp className="ow-mobile-app">
      <MobileShell initialMode={fixtureMode} />
    </IonApp>
  );
}

function readMobileFixtureMode(): MobileFixtureMode {
  if (typeof window === "undefined") return "ready";
  const fixture = new URLSearchParams(window.location.search).get("mobile_fixture");
  if (fixture === "connection" || fixture === "setup") return fixture;
  return "ready";
}
