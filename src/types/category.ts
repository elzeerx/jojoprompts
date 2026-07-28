
export interface Category {
  id: string;
  name: string;
  description: string | null;
  image_path: string | null;
  required_plan: string;
  icon_name: string;
  icon_image_path?: string | null;
  features: string[];
  subcategories: string[];
  bg_gradient: string;
  link_path: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

/** Fields the active V2 taxonomy editor is allowed to create or update. */
export interface CategoryWriteInput {
  name: string;
  description: string | null;
  link_path: string;
  subcategories: string[];
  display_order: number;
  is_active: boolean;
}
