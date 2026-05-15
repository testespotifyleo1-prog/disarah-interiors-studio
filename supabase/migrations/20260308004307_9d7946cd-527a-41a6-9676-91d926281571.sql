
-- Create storage bucket for fiscal files
INSERT INTO storage.buckets (id, name, public) VALUES ('fiscal-files', 'fiscal-files', false);

-- RLS policies for fiscal-files bucket
CREATE POLICY "Authenticated users can upload fiscal files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'fiscal-files');

CREATE POLICY "Authenticated users can read fiscal files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'fiscal-files');

CREATE POLICY "Authenticated users can delete fiscal files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'fiscal-files');
