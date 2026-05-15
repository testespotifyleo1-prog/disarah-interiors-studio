UPDATE public.fiscal_documents
SET nfe_number = ltrim(substring(regexp_replace(access_key, '\\D', '', 'g') from 26 for 9), '0')
WHERE purpose = 'normal'
  AND access_key IS NOT NULL
  AND coalesce(nfe_number, '') = ''
  AND length(regexp_replace(access_key, '\\D', '', 'g')) >= 34;