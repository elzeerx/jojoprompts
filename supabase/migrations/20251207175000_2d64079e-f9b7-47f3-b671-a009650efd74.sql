-- Add subcategories column to categories table for mapping prompt metadata values
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS subcategories text[] DEFAULT '{}';

-- Add comment explaining the field
COMMENT ON COLUMN public.categories.subcategories IS 'Array of subcategory values that map to this category (e.g., ["midjourney-style", "midjourney-full"] for Midjourney category)';