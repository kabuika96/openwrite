import { IonContent, IonHeader, IonPage } from "@ionic/react";
import { ArrowLeft, MessageCircle, RefreshCcw, Settings } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MobileFixtureMode } from "../MobileApp";
import { MobileChatScreen } from "../chat/MobileChatScreen";
import { MobileSettingsPlaceholder } from "../settings/MobileSettingsPlaceholder";
import { MobileSourcePlaceholder } from "../source/MobileSourcePlaceholder";
import {
  addMobileDurableTurn,
  loadMobileSessionSnapshot,
  recordMobileSessionActivity,
  restoreMobileSessionSnapshot,
  saveMobileSessionSnapshot,
  startNewMobileSession,
  type MobileDurableTurn,
  type MobileSessionSnapshot,
} from "../storage/mobileSessionStore";
import { MobileDiagnosticsOverlay } from "./MobileDiagnosticsOverlay";
import {
  canPopMobileScreen,
  createMobileScreenStack,
  getTopMobileScreen,
  popMobileScreen,
  pushMobileScreen,
  type MobileScreen,
} from "./mobileScreenStack";
import { useViewportDiagnostics } from "./useViewportDiagnostics";

type MobileShellProps = {
  initialMode: MobileFixtureMode;
};

export function MobileShell({ initialMode }: MobileShellProps) {
  const [mode, setMode] = useState(initialMode);
  const [screenStack, setScreenStack] = useState(createMobileScreenStack);
  const screenStackRef = useRef(screenStack);
  const [sessionSnapshot, setSessionSnapshot] = useState<MobileSessionSnapshot>(() => loadInitialSessionSnapshot());
  const topScreen = getTopMobileScreen(screenStack);
  const diagnostics = useViewportDiagnostics(topScreen);
  const diagnosticsEnabled = useMemo(readDiagnosticsEnabled, []);

  useEffect(() => {
    screenStackRef.current = screenStack;
  }, [screenStack]);

  const persistSnapshot = useCallback((updater: (snapshot: MobileSessionSnapshot) => MobileSessionSnapshot) => {
    setSessionSnapshot((current) => {
      const next = updater(current);
      if (typeof window !== "undefined") {
        saveMobileSessionSnapshot(window.localStorage, next);
      }
      return next;
    });
  }, []);

  const refreshExpiredSession = useCallback(() => {
    persistSnapshot((current) => restoreMobileSessionSnapshot(current, Date.now()));
  }, [persistSnapshot]);

  useEffect(() => {
    refreshExpiredSession();
    const onFocus = () => refreshExpiredSession();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshExpiredSession();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refreshExpiredSession]);

  useEffect(() => {
    const onPopState = () => {
      if (!canPopMobileScreen(screenStackRef.current)) return;
      setScreenStack((current) => popMobileScreen(current));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const recordActivity = useCallback(() => {
    persistSnapshot((current) => ({
      ...current,
      activeSession: recordMobileSessionActivity(current.activeSession, Date.now()),
    }));
  }, [persistSnapshot]);

  const addDurableTurn = useCallback(
    (turn: MobileDurableTurn) => {
      persistSnapshot((current) => ({
        ...current,
        activeSession: addMobileDurableTurn(current.activeSession, turn, Date.now()),
      }));
    },
    [persistSnapshot],
  );

  const startNewChat = useCallback(() => {
    persistSnapshot((current) => startNewMobileSession(current, Date.now()));
  }, [persistSnapshot]);

  const pushScreen = useCallback((screen: Exclude<MobileScreen, { type: "chat" }>) => {
    setScreenStack((current) => pushMobileScreen(current, screen));
    window.history.pushState({ openwriteMobileScreen: screen.type }, "", window.location.href);
  }, []);

  const popScreen = useCallback(() => {
    if (!canPopMobileScreen(screenStackRef.current)) return;
    window.history.back();
  }, []);

  if (mode === "connection") {
    return (
      <IonPage className="ow-mobile-page">
        <MobileConnectionState onRetry={() => setMode("ready")} />
        {diagnosticsEnabled ? <MobileDiagnosticsOverlay diagnostics={diagnostics} /> : null}
      </IonPage>
    );
  }

  return (
    <IonPage className="ow-mobile-page">
      <IonHeader className="ow-mobile-header" translucent={false}>
        <div className="ow-mobile-toolbar">
          <div className="ow-mobile-toolbar-side">
            {canPopMobileScreen(screenStack) ? (
              <div aria-label="Back" className="ow-mobile-icon-button" role="button" tabIndex={0} onClick={popScreen}>
                <ArrowLeft aria-hidden="true" size={20} strokeWidth={1.8} />
              </div>
            ) : topScreen.type === "chat" ? (
              <div
                aria-label="Settings"
                className="ow-mobile-icon-button"
                role="button"
                tabIndex={0}
                onClick={() => pushScreen({ focus: mode === "setup" ? "status" : undefined, type: "settings" })}
              >
                <Settings aria-hidden="true" size={20} strokeWidth={1.8} />
              </div>
            ) : null}
            {mode === "setup" && topScreen.type === "chat" ? (
              <span className="ow-mobile-setup-dot" aria-label="Setup required" />
            ) : null}
          </div>
          <strong className="ow-mobile-title">OpenWrite</strong>
          <div className="ow-mobile-toolbar-side ow-mobile-toolbar-end">
            {topScreen.type === "chat" ? (
              <div
                aria-label="New chat"
                className="ow-mobile-icon-button"
                role="button"
                tabIndex={0}
                onClick={startNewChat}
              >
                <MessageCircle aria-hidden="true" size={20} strokeWidth={1.8} />
              </div>
            ) : null}
          </div>
        </div>
      </IonHeader>

      {topScreen.type === "chat" ? (
        <MobileChatScreen
          key={sessionSnapshot.activeSession.id}
          session={sessionSnapshot.activeSession}
          setupRequired={mode === "setup"}
          onActivity={recordActivity}
          onDurableTurn={addDurableTurn}
          onOpenSettings={() => pushScreen({ focus: "status", type: "settings" })}
          onOpenSource={(source) => pushScreen({ sourceId: source.id, sourceTitle: source.title, type: "source" })}
        />
      ) : null}
      {topScreen.type === "source" ? <MobileSourcePlaceholder screen={topScreen} /> : null}
      {topScreen.type === "settings" ? (
        <MobileSettingsPlaceholder
          focus={topScreen.focus}
          setupRequired={mode === "setup"}
          onActivity={recordActivity}
        />
      ) : null}

      {diagnosticsEnabled ? <MobileDiagnosticsOverlay diagnostics={diagnostics} /> : null}
    </IonPage>
  );
}

function MobileConnectionState({ onRetry }: { onRetry: () => void }) {
  return (
    <IonContent className="ow-mobile-content ow-mobile-state-content" fullscreen={true} scrollY={false}>
      <section className="ow-mobile-state">
        <p className="ow-mobile-state-kicker">OpenWrite</p>
        <h1>Cannot reach the local server.</h1>
        <p className="ow-mobile-state-detail">http://localhost:5173</p>
        <div className="ow-mobile-state-actions">
          <button className="ow-mobile-action-button" type="button" onClick={onRetry}>
            <RefreshCcw aria-hidden="true" size={17} strokeWidth={1.8} />
            Retry
          </button>
        </div>
      </section>
    </IonContent>
  );
}

function loadInitialSessionSnapshot() {
  if (typeof window === "undefined") {
    return restoreMobileSessionSnapshot(null);
  }
  return loadMobileSessionSnapshot(window.localStorage, Date.now());
}

function readDiagnosticsEnabled() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("mobile_diag") === "1";
}
