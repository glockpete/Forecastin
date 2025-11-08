/// <reference types="vite/client" />

interface ImportMetaEnv {
  // API Configuration
  readonly VITE_API_URL?: string;
  readonly VITE_API_PORT?: string;
  readonly VITE_WS_PORT?: string;
  readonly VITE_API_URL_OVERRIDE?: string;
  readonly VITE_WS_URL_OVERRIDE?: string;
  readonly VITE_WS_URL?: string;

  // Feature Flags
  readonly VITE_FF_GEOSPATIAL?: string;
  readonly VITE_FF_POINT_LAYER?: string;
  readonly VITE_FF_CLUSTERING?: string;
  readonly VITE_FF_WS_LAYERS?: string;
  readonly VITE_FF_CORE_ROLLOUT?: string;
  readonly VITE_FF_POINT_ROLLOUT?: string;
  readonly VITE_FF_WS_ROLLOUT?: string;
  readonly VITE_FF_VISUAL_ROLLOUT?: string;

  // Environment Mode
  readonly MODE: 'development' | 'production' | 'test';
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly SSR: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
