-- Allow authenticated users to read their own auth.users record
CREATE POLICY "users_read_own" ON auth.users
FOR SELECT USING (auth.uid() = id);
