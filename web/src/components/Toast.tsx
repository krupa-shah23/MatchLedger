/**
 * Global toast notifications. Friendly, plain-language messages only -
 * never raw error objects or status codes. Purely additive UI: existing
 * inline error text in forms is untouched, this just adds a visible,
 * auto-dismissing heads-up in the corner of the screen.
 */
import React, { createContext, useCallback, useContext, useRef, useState } from "react";

type ToastKind = "error" | "success" | "info";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  showToast: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICON: Record<ToastKind, string> = { error: "!", success: "✓", info: "i" };
const TOAST_DURATION_MS = 15_000;


export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const showToast = useCallback((message: string, kind: ToastKind = "error") => {
    const id = ++nextId.current;
    setToasts((prev) => [...prev, { id, kind, message }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), TOAST_DURATION_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-stack">
        {toasts.map(t => <div key={t.id} role="alert" className={`toast toast-${t.kind}`} style={{ "--toast-duration": `${TOAST_DURATION_MS}ms` } as React.CSSProperties}><span className="toast-icon" aria-hidden="true">{ICON[t.kind]}</span><span>{t.message}</span><button className="toast-close" onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))} aria-label="Dismiss">×</button><span className="toast-progress" aria-hidden="true" /></div>)}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

/** Turns a raw error into one plain sentence a non-technical user can act on. */
export function friendlyMessage(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err);
  if (/network|fetch|failed to fetch/i.test(text)) return "We couldn't reach the server. Check your connection and try again.";
  if (/409/.test(text) || /already used/i.test(text)) return "That request was already submitted. No need to send it again.";
  if (/429|rate limit/i.test(text)) return "You're going a bit fast - please wait a moment and try again.";
  if (/503|unavailable/i.test(text)) return "The service is temporarily busy. Nothing was lost - please try again shortly.";
  if (/401|unauthenticated|unauthorized/i.test(text)) return "Your session needs a fresh login. Please sign in again.";
  if (/403|forbidden/i.test(text)) return "You don't have permission to do that.";
  return "Something went wrong on our end. Please try again.";
}
