/*
  # Create feedback table

  1. New Tables
    - `feedback`
      - `id` (uuid, primary key)
      - `category` (text - bug, feature, support, faq, other)
      - `email` (text - user email, optional)
      - `message` (text - feedback content)
      - `user_agent` (text - browser info)
      - `created_at` (timestamptz)
      - `resolved` (boolean, default false)
  2. Security
    - Enable RLS on `feedback` table
    - Only service role can read/write (no public access)
*/

CREATE TABLE IF NOT EXISTS feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL DEFAULT 'other',
  email text DEFAULT '',
  message text NOT NULL,
  user_agent text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  resolved boolean DEFAULT false
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage feedback"
  ON feedback FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
