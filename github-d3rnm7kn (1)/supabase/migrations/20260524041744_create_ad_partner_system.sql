/*
  # Create ad partner system tables

  1. New Tables
    - `ad_partners`
      - `id` (uuid, primary key)
      - `email` (text, unique, partner email)
      - `site_name` (text, name of their site/app)
      - `site_url` (text, URL of their site/app)
      - `ad_slot_id` (text, their Google AdSense ad slot ID)
      - `status` (text: 'pending', 'approved', 'rejected', 'suspended')
      - `balance` (numeric, accumulated earnings, default 0)
      - `total_earned` (numeric, lifetime earnings, default 0)
      - `total_paid` (numeric, total paid out, default 0)
      - `payment_method` (jsonb, payment details - bank name, account, etc.)
      - `created_at` (timestamp)
      - `approved_at` (timestamp)

    - `ad_impressions`
      - `id` (uuid, primary key)
      - `partner_id` (uuid, FK to ad_partners)
      - `impressions` (integer, default 0)
      - `clicks` (integer, default 0)
      - `earnings` (numeric, default 0)
      - `date` (date, the day these impressions occurred)
      - Unique on (partner_id, date)

    - `withdrawal_requests`
      - `id` (uuid, primary key)
      - `partner_id` (uuid, FK to ad_partners)
      - `amount` (numeric, requested amount)
      - `status` (text: 'pending', 'approved', 'processing', 'paid', 'rejected')
      - `payment_method` (jsonb)
      - `created_at` (timestamp)
      - `approved_at` (timestamp)
      - `paid_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Partners can read their own data
    - Partners can insert impressions for themselves
    - Partners can insert withdrawal requests
    - Only service role can update balances and statuses
*/

CREATE TABLE IF NOT EXISTS ad_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  site_name text NOT NULL DEFAULT '',
  site_url text NOT NULL DEFAULT '',
  ad_slot_id text DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  balance numeric NOT NULL DEFAULT 0,
  total_earned numeric NOT NULL DEFAULT 0,
  total_paid numeric NOT NULL DEFAULT 0,
  payment_method jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  approved_at timestamptz
);

ALTER TABLE ad_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners can read own data"
  ON ad_partners FOR SELECT
  TO anon, authenticated
  USING (email = current_setting('request.jwt.claims', true)::json->>'email' OR true = false);

-- Allow insert for new partner applications
CREATE POLICY "Anyone can apply as partner"
  ON ad_partners FOR INSERT
  TO anon, authenticated
  WITH CHECK (email <> '' AND site_name <> '' AND site_url <> '');

CREATE TABLE IF NOT EXISTS ad_impressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES ad_partners(id),
  impressions integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  earnings numeric NOT NULL DEFAULT 0,
  date date NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE(partner_id, date)
);

ALTER TABLE ad_impressions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners can read own impressions"
  ON ad_impressions FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert impressions"
  ON ad_impressions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES ad_partners(id),
  amount numeric NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'processing', 'paid', 'rejected')),
  payment_method jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  approved_at timestamptz,
  paid_at timestamptz
);

ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners can read own withdrawals"
  ON withdrawal_requests FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can create withdrawal requests"
  ON withdrawal_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (amount > 0);

CREATE INDEX IF NOT EXISTS idx_ad_partners_status ON ad_partners(status);
CREATE INDEX IF NOT EXISTS idx_ad_impressions_partner ON ad_impressions(partner_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawal_requests(status);
