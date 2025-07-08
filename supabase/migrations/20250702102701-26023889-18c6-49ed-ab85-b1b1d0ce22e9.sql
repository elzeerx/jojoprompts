-- Add icon_image_path column to categories table for custom icon images
ALTER TABLE public.categories 
ADD COLUMN icon_image_path TEXT;