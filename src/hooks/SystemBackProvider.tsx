import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useId,
  type ReactNode,
} from "react";
import { isTauri } from "@tauri-apps/api/core";

type Entry = { id: string; priority: number; order: number; handler: () => void };
type BackContextValue = { register: (id: string, priority: number, handler: () => void) => () => void };
const BackContext = createContext<BackContextValue | null>(null);

export function SystemBackProvider({ children }: { children: ReactNode }) {
  const entries = useRef(new Map<string, Entry>());
  const order = useRef(0);
  const historyGuard = useRef(false);
  const ignoreNextPop = useRef(false);
  const removeGuardTimer = useRef<number | undefined>(undefined);
  const [activeCount, setActiveCount] = useState(0);

  const pushHistoryGuard = useCallback(() => {
    if (historyGuard.current || entries.current.size === 0) return;
    window.history.pushState({ __kanittOverlayBack: true }, "");
    historyGuard.current = true;
  }, []);

  const removeHistoryGuard = useCallback(() => {
    if (!historyGuard.current) return;
    removeGuardTimer.current = window.setTimeout(() => {
      removeGuardTimer.current = undefined;
      if (entries.current.size > 0 || !historyGuard.current) return;
      historyGuard.current = false;
      ignoreNextPop.current = true;
      window.history.back();
      window.setTimeout(() => { ignoreNextPop.current = false; }, 500);
    }, 0);
  }, []);

  const dispatchBack = useCallback(() => {
    const top = [...entries.current.values()].sort(
      (a, b) => b.priority - a.priority || b.order - a.order,
    )[0];
    if (!top) return false;
    top.handler();
    return true;
  }, []);

  const register = useCallback((id: string, priority: number, handler: () => void) => {
    if (removeGuardTimer.current !== undefined) {
      window.clearTimeout(removeGuardTimer.current);
      removeGuardTimer.current = undefined;
    }
    entries.current.set(id, { id, priority, order: ++order.current, handler });
    setActiveCount(entries.current.size);
    pushHistoryGuard();
    return () => {
      entries.current.delete(id);
      setActiveCount(entries.current.size);
      if (entries.current.size === 0) removeHistoryGuard();
    };
  }, [pushHistoryGuard, removeHistoryGuard]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !dispatchBack()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const onPopState = () => {
      if (ignoreNextPop.current) {
        ignoreNextPop.current = false;
        return;
      }
      historyGuard.current = false;
      if (!dispatchBack()) return;
      window.setTimeout(pushHistoryGuard, 0);
    };
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, [dispatchBack, pushHistoryGuard]);

  useEffect(() => {
    if (!activeCount || !isTauri()) return;
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    void import("@tauri-apps/api/app")
      .then(({ onBackButtonPress }) => onBackButtonPress(({ canGoBack }) => {
        if (dispatchBack()) return;
        if (canGoBack) window.history.back();
      }))
      .then((listener) => {
        if (cancelled) void listener.unregister();
        else unlisten = () => { void listener.unregister(); };
      })
      .catch((error) => {
        console.warn("Could not register the Android back handler:", error);
      });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [activeCount, dispatchBack]);

  const value = useMemo(() => ({ register }), [register]);
  return <BackContext.Provider value={value}>{children}</BackContext.Provider>;
}

export function useSystemBack(active: boolean, onBack: () => void, priority = 0) {
  const context = useContext(BackContext);
  if (!context) throw new Error("useSystemBack must be used inside SystemBackProvider.");
  const { register } = context;
  const reactId = useId();
  const id = useRef(`kanitt-back-${reactId}`);
  const handlerRef = useRef(onBack);
  handlerRef.current = onBack;
  useEffect(() => {
    if (!active) return;
    return register(id.current, priority, () => handlerRef.current());
  }, [active, priority, register]);
}
