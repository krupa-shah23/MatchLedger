/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PROFILE?: string;
  readonly VITE_GRAFANA_URL?: string;
  readonly VITE_PENDING_HINT_MS?: string;
  readonly VITE_POLL_INTERVAL_MS?: string;
  readonly VITE_WS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
