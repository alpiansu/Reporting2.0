/// <reference types="vite/client" />
declare module '*.vue';

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_APP_TITLE?: string;
  readonly VITE_APP_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
