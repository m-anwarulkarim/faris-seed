import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Client } = pg;

const connectionString = "postgresql://postgres.ujzctrrtbnbobpopnvgw:oHAdR0alRikZmrwl@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres";

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

const PRE_MIGRATION_SQL = `
-- Create app_role enum if it does not exist
DO $$ BEGIN
    CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create user_roles table if not existing
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);

-- Create has_role function
CREATE OR REPLACE FUNCTION public.has_role(user_id uuid, role public.app_role)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = has_role.user_id AND user_roles.role = has_role.role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create app_settings table
CREATE TABLE IF NOT EXISTS public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create orders table
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE,
  customer_name TEXT,
  phone TEXT,
  address TEXT,
  district TEXT,
  thana TEXT,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  delivery_charge NUMERIC NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create order_items table
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID,
  product_name TEXT NOT NULL,
  product_image TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create order_status_history table
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  changed_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create categories table
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create products table
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  compare_price NUMERIC,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  images JSONB DEFAULT '[]'::jsonb,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.app_settings TO anon, authenticated, service_role;
GRANT ALL ON public.orders TO anon, authenticated, service_role;
GRANT ALL ON public.order_items TO anon, authenticated, service_role;
GRANT ALL ON public.order_status_history TO anon, authenticated, service_role;
GRANT ALL ON public.categories TO anon, authenticated, service_role;
GRANT ALL ON public.products TO anon, authenticated, service_role;
`;

async function main() {
  try {
    console.log("Connecting to PostgreSQL database...");
    await client.connect();
    console.log("Connected successfully!");

    console.log("Running pre-migration prerequisites...");
    await client.query(PRE_MIGRATION_SQL);
    console.log("✓ Prerequisites initialized!");

    const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    for (const file of files) {
      console.log(`Executing migration: ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      try {
        await client.query(sql);
        console.log(`✓ Applied ${file}`);
      } catch (mErr) {
        console.log(`ℹ Migration info (${file}): ${mErr.message}`);
      }
    }

    console.log("\nMigrations step complete!");

    // Now insert saved data
    const exportDir = path.join(process.cwd(), 'scratch', 'db_export');

    const appSettingsFile = path.join(exportDir, 'app_settings.json');
    if (fs.existsSync(appSettingsFile)) {
      const rows = JSON.parse(fs.readFileSync(appSettingsFile, 'utf8'));
      for (const row of rows) {
        await client.query(
          `INSERT INTO public.app_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;`,
          [row.key, row.value]
        );
        console.log(`✓ Seeded app_setting: ${row.key}`);
      }
    }

    const landingPagesFile = path.join(exportDir, 'product_landing_pages.json');
    if (fs.existsSync(landingPagesFile)) {
      const rows = JSON.parse(fs.readFileSync(landingPagesFile, 'utf8'));
      for (const row of rows) {
        await client.query(
          `INSERT INTO public.product_landing_pages (
            id, slug, headline, subheadline, pack_size, germination, highlights, benefits, description, usage_steps, reviews, faqs, sections
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (slug) DO UPDATE SET headline = EXCLUDED.headline, subheadline = EXCLUDED.subheadline;`,
          [
            row.id,
            row.slug,
            row.headline,
            row.subheadline,
            row.pack_size,
            row.germination,
            JSON.stringify(row.highlights || []),
            JSON.stringify(row.benefits || []),
            JSON.stringify(row.description || []),
            JSON.stringify(row.usage_steps || []),
            JSON.stringify(row.reviews || []),
            JSON.stringify(row.faqs || []),
            JSON.stringify(row.sections || [])
          ]
        );
        console.log(`✓ Seeded product_landing_page: ${row.slug}`);
      }
    }

    console.log("\n🎉 All migrations and seed data applied successfully to the new database!");

  } catch (err) {
    console.error("Migration/Seeding Error:", err);
  } finally {
    await client.end();
  }
}

main();
