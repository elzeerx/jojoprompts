
export interface Category {
  id: string;
  name: string;
  description: string | null;
  image_path: string | null;
  required_plan: string;
  icon_name: string;
  icon_image_path?: string | null;
  features: string[];
  bg_gradient: string;
  link_path: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface CategoryFormData {
  name: string;
  description: string;
  image_path: string;
  required_plan: string;
  icon_name: string;
  icon_image_path?: string;
  features: string[];
  bg_gradient: string;
  link_path: string;
  is_active: boolean;
}
