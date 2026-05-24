/*
  # Create reviews table for user reviews

  1. New Tables
    - `reviews`
      - `id` (uuid, primary key)
      - `name` (text, reviewer name)
      - `rating` (integer, 1-5 stars)
      - `comment` (text, review content)
      - `created_at` (timestamp)
  
  2. Security
    - Enable RLS on `reviews` table
    - Allow authenticated users to read reviews
    - Allow anyone to insert reviews (anonymous reviews allowed)
*/

CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read reviews"
  ON reviews FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can submit reviews"
  ON reviews FOR INSERT
  TO anon, authenticated
  WITH CHECK (rating >= 1 AND rating <= 5);
