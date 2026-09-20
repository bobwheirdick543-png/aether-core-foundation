-- Keep the OpenRouter provider contract and AAX secret uniqueness aligned
-- across fresh installs and existing environments.
UPDATE public.aether_provider_credentials
SET base_url = 'https://openrouter.ai/api/v1',
    updated_at = now()
WHERE provider = 'openrouter'
  AND purpose = 'aax_inference'
  AND (base_url IS NULL OR btrim(base_url) = '');

CREATE UNIQUE INDEX IF NOT EXISTS aether_api_keys_key_hash_key
  ON public.aether_api_keys (key_hash);
