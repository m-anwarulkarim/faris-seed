CREATE TABLE public.product_landing_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  headline TEXT,
  subheadline TEXT,
  pack_size TEXT,
  germination TEXT,
  highlights JSONB NOT NULL DEFAULT '[]'::jsonb,
  benefits JSONB NOT NULL DEFAULT '[]'::jsonb,
  description JSONB NOT NULL DEFAULT '[]'::jsonb,
  usage_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  reviews JSONB NOT NULL DEFAULT '[]'::jsonb,
  faqs JSONB NOT NULL DEFAULT '[]'::jsonb,
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.product_landing_pages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_landing_pages TO authenticated;
GRANT ALL ON public.product_landing_pages TO service_role;

ALTER TABLE public.product_landing_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view product landing pages"
  ON public.product_landing_pages FOR SELECT
  USING (true);

CREATE POLICY "Admins manage product landing pages"
  ON public.product_landing_pages FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_product_landing_pages_updated_at
  BEFORE UPDATE ON public.product_landing_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();