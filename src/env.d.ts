/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly NG_APP_ENV?: string;
  readonly NG_APP_SUPABASE_URL?: string;
  readonly NG_APP_SUPABASE_ANON_KEY?: string;
  readonly NG_APP_SITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
