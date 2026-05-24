/*
  # Create community submissions tables for games and web apps

  1. New Tables
    - `community_submissions`
      - `id` (uuid, primary key)
      - `type` (text: 'game' or 'webapp')
      - `name` (text, submission name)
      - `description` (text)
      - `url` (text, link to game/app)
      - `company` (text, optional developer/company name)
      - `icon_url` (text, optional icon image URL)
      - `image_url` (text, optional screenshot image URL)
      - `submitter_email` (text, optional)
      - `status` (text: 'pending', 'approved', 'rejected', default 'pending')
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `community_submissions`
    - Anyone can insert (submit games/apps)
    - Only authenticated can read approved items
    - No one can update or delete without service role

  3. Analytics Table
    - `tool_analytics`
      - `id` (uuid, primary key)
      - `tool_id` (text, which tool was used)
      - `action` (text, what action was performed)
      - `session_id` (text, anonymous session identifier)
      - `created_at` (timestamp)
*/

CREATE TABLE IF NOT EXISTS community_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('game', 'webapp')),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  url text NOT NULL,
  company text DEFAULT '',
  icon_url text DEFAULT '',
  image_url text DEFAULT '',
  submitter_email text DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE community_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit games and apps"
  ON community_submissions FOR INSERT
  TO anon, authenticated
  WITH CHECK (type IN ('game', 'webapp') AND name <> '' AND url <> '');

CREATE POLICY "Authenticated users can view approved items"
  ON community_submissions FOR SELECT
  TO authenticated
  USING (status = 'approved');

CREATE POLICY "Anyone can view approved items"
  ON community_submissions FOR SELECT
  TO anon
  USING (status = 'approved');

CREATE TABLE IF NOT EXISTS tool_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id text NOT NULL DEFAULT '',
  action text NOT NULL DEFAULT 'open',
  session_id text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tool_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert analytics"
  ON tool_analytics FOR INSERT
  TO anon, authenticated
  WITH CHECK (tool_id <> '');

CREATE INDEX IF NOT EXISTS idx_submissions_status ON community_submissions(status);
CREATE INDEX IF NOT EXISTS idx_analytics_tool ON tool_analytics(tool_id);
CREATE INDEX IF NOT EXISTS idx_analytics_created ON tool_analytics(created_at);
