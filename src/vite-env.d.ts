/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DATAGOV_API_KEY: string;
  readonly VITE_MISTRAL_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
