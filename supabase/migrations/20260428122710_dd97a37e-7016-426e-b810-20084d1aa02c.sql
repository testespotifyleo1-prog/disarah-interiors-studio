
ALTER TABLE public.plans REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.plans;
