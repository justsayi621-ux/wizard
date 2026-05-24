/*
  # Enable pg_net and setup email notification for feedback

  1. Changes
    - Enable pg_net extension for outbound HTTP requests
    - Create a function that sends feedback notifications via email
    - Add a trigger on the feedback table to notify on new inserts
  
  The pg_net extension allows making HTTP requests from PostgreSQL.
  We'll create a trigger function that calls the send-feedback-email
  edge function whenever new feedback is inserted.
*/

-- Enable pg_net for outbound HTTP
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- Create function to notify on new feedback
CREATE OR REPLACE FUNCTION notify_feedback_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id bigint;
  payload jsonb;
BEGIN
  payload := jsonb_build_object(
    'record', jsonb_build_object(
      'id', NEW.id,
      'category', NEW.category,
      'email', NEW.email,
      'message', NEW.message,
      'user_agent', NEW.user_agent,
      'created_at', NEW.created_at
    )
  );

  -- Call the email notification edge function via pg_net
  SELECT INTO request_id net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-feedback-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := payload
  );

  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS on_feedback_insert ON feedback;
CREATE TRIGGER on_feedback_insert
  AFTER INSERT ON feedback
  FOR EACH ROW
  EXECUTE FUNCTION notify_feedback_email();
