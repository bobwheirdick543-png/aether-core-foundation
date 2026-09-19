-- Remove the obsolete product model-role layer.
-- Aether Ascension (AAX) remains the sole platform model registry/runtime.
-- Historical migrations are intentionally retained for schema history.

DROP TABLE IF EXISTS public.model_productivity_metrics CASCADE;
DROP TABLE IF EXISTS public.model_configs CASCADE;
