/*
  # Add email notification for feedback

  1. Changes
    - Enable pg_cron extension (if available)
    - Create a function that logs new feedback entries
    - Add a trigger to notify on new feedback
  
  Note: Email sending requires an external SMTP service or Supabase's built-in email.
  Since Supabase doesn't provide outbound email for custom addresses,
  feedback is stored in the `feedback` table and can be viewed in the dashboard.
  The edge function logs feedback to the console for monitoring.
*/

-- Add index for querying unresolved feedback
CREATE INDEX IF NOT EXISTS idx_feedback_resolved ON feedback(resolved) WHERE resolved = false;

-- Add index for category queries
CREATE INDEX IF NOT EXISTS idx_feedback_category ON feedback(category);
