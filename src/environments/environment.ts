const supabaseUrl = import.meta.env.NG_APP_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.NG_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Faltan variables NG_APP_SUPABASE_URL o NG_APP_SUPABASE_ANON_KEY. Copia .env.example a .env.'
  );
}

export const environment = {
  production: import.meta.env.NG_APP_ENV === 'production',
  staging: import.meta.env.NG_APP_ENV === 'staging',
  supabaseUrl,
  supabaseAnonKey,
  /** URL base de la aplicación para redirects de Supabase Auth */
  siteUrl: import.meta.env.NG_APP_SITE_URL || window.location.origin,
};
