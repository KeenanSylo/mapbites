-- Debug script to check RLS policies and user authentication
-- Run this in your Supabase SQL editor to verify the setup

-- Check if RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('restaurants', 'media');

-- Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename IN ('restaurants', 'media');

-- Test if we can see the auth.users table
SELECT COUNT(*) as user_count FROM auth.users;

-- Check if the restaurants table exists and has the right structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'restaurants' 
ORDER BY ordinal_position;

-- Check if the media table exists and has the right structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'media' 
ORDER BY ordinal_position;
