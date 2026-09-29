-- Fix RLS policies for likes table to resolve 406 errors

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view likes" ON public.likes;
DROP POLICY IF EXISTS "Users can insert their own likes" ON public.likes;
DROP POLICY IF EXISTS "Users can delete their own likes" ON public.likes;

-- Enable RLS on likes table
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can view likes (needed for counting and checking)
CREATE POLICY "Users can view likes"
  ON public.likes
  FOR SELECT
  USING (true);

-- Policy: Users can insert their own likes
CREATE POLICY "Users can insert their own likes"
  ON public.likes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own likes
CREATE POLICY "Users can delete their own likes"
  ON public.likes
  FOR DELETE
  USING (auth.uid() = user_id);
