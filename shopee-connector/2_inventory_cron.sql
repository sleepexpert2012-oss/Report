-- Chạy trong Supabase SQL Editor sau khi deploy Edge Function inventory-responder.
-- 23:25 / 05:25 / 13:25 UTC = 06:25 / 12:25 / 20:25 Việt Nam.

select cron.unschedule(jobid)
from cron.job
where jobname = 'shopee-inventory-daily';

select cron.schedule(
  'shopee-inventory-daily',
  '25 23,5,13 * * *',
  $$
  select net.http_post(
    url := 'https://jkrczsrhonmqxwzzdgen.supabase.co/functions/v1/inventory-responder',
    headers := '{"content-type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
