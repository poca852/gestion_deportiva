-- Drop existing problematic policies for super_admin
DROP POLICY IF EXISTS "Super admin can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super admin can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super admin can update all profiles" ON public.profiles;

-- Create new policies that avoid recursion by checking auth.users.is_super_admin
CREATE POLICY "super_admin_insert" ON public.profiles
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.is_super_admin = true
  )
);

CREATE POLICY "super_admin_select" ON public.profiles
FOR SELECT USING (
  auth.uid() = id OR
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.is_super_admin = true
  )
);

CREATE POLICY "super_admin_update" ON public.profiles
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.is_super_admin = true
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.is_super_admin = true
  )
);

-- Keep existing user policies (they are fine)
-- "Users can read own profile" and "Users can update own profile" remain
