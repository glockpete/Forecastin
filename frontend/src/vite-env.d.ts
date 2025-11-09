/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_PORT: string;
  readonly VITE_WS_PORT: string;
  readonly VITE_API_URL_OVERRIDE: string;
  readonly VITE_WS_URL_OVERRIDE: string;
  readonly DEV: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}