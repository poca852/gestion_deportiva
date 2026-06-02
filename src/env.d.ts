declare interface Env {
  readonly NODE_ENV: string;
  readonly NG_APP_ENV: 'development' | 'production' | 'test';
  readonly NG_APP_SUPABASE_URL: string;
  readonly NG_APP_SUPABASE_ANON_KEY: string;
}

declare interface ImportMeta {
  readonly env: Env;
}

declare const _NGX_ENV_: Env;

declare namespace NodeJS {
  export interface ProcessEnv extends Env {}
}
