-- Grant SELECT on auth.users to postgres role (already has it)
-- Ensure the function can read auth.users
GRANT USAGE ON SCHEMA auth TO public;
GRANT SELECT ON auth.users TO public;
