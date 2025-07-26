
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { DiscountCodeFormFields } from "./DiscountCodeFormFields";

interface DiscountCode {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  expiration_date: string | null;
  usage_limit: number | null;
  applies_to_all_plans?: boolean;
  applicable_plans?: string[];
}

interface DiscountCodeFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  initialData?: DiscountCode;
  isEditing?: boolean;
}

export function DiscountCodeForm({ onSuccess, onCancel, initialData, isEditing = false }: DiscountCodeFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    discount_type: 'percentage',
    discount_value: '',
    expiration_date: undefined as Date | undefined,
    usage_limit: '',
    applies_to_all_plans: true,
    applicable_plans: [] as string[],
  });

  // Initialize form data when editing
  useEffect(() => {
    if (initialData && isEditing) {
      setFormData({
        code: initialData.code,
        discount_type: initialData.discount_type,
        discount_value: initialData.discount_value.toString(),
        expiration_date: initialData.expiration_date ? new Date(initialData.expiration_date) : undefined,
        usage_limit: initialData.usage_limit?.toString() || '',
        applies_to_all_plans: initialData.applies_to_all_plans ?? true,
        applicable_plans: initialData.applicable_plans || [],
      });
    }
  }, [initialData, isEditing]);

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, code: result }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.code || !formData.discount_value) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (!formData.applies_to_all_plans && formData.applicable_plans.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one plan or choose 'Apply to all plans'",
        variant: "destructive",
      });
      return;
    }

    const discountValue = parseFloat(formData.discount_value);
    if (isNaN(discountValue) || discountValue <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid discount value",
        variant: "destructive",
      });
      return;
    }

    if (formData.discount_type === 'percentage' && discountValue > 100) {
      toast({
        title: "Error",
        description: "Percentage discount cannot exceed 100%",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      if (isEditing && initialData) {
        // Update existing discount code
        const { error } = await supabase
          .from("discount_codes")
          .update({
            code: formData.code.toUpperCase(),
            discount_type: formData.discount_type,
            discount_value: discountValue,
            expiration_date: formData.expiration_date?.toISOString(),
            usage_limit: formData.usage_limit ? parseInt(formData.usage_limit) : null,
            applies_to_all_plans: formData.applies_to_all_plans,
            applicable_plans: formData.applies_to_all_plans ? [] : formData.applicable_plans,
            updated_at: new Date().toISOString(),
          })
          .eq("id", initialData.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Discount code updated successfully",
        });
      } else {
        // Create new discount code
        const { error } = await supabase
          .from("discount_codes")
          .insert({
            code: formData.code.toUpperCase(),
            discount_type: formData.discount_type,
            discount_value: discountValue,
            expiration_date: formData.expiration_date?.toISOString(),
            usage_limit: formData.usage_limit ? parseInt(formData.usage_limit) : null,
            applies_to_all_plans: formData.applies_to_all_plans,
            applicable_plans: formData.applies_to_all_plans ? [] : formData.applicable_plans,
            created_by: user.id,
          });

        if (error) throw error;

        toast({
          title: "Success",
          description: "Discount code created successfully",
        });

        setFormData({
          code: '',
          discount_type: 'percentage',
          discount_value: '',
          expiration_date: undefined,
          usage_limit: '',
          applies_to_all_plans: true,
          applicable_plans: [],
        });
      }

      onSuccess();
    } catch (error: any) {
      console.error("Error creating discount code:", error);
      toast({
        title: "Error",
        description: error.message.includes('duplicate') ? 
          "A discount code with this name already exists" : 
          `Failed to ${isEditing ? 'update' : 'create'} discount code`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white/40 p-4 sm:p-6 rounded-xl border border-gray-200">
        <DiscountCodeFormFields
          formData={formData}
          setFormData={setFormData}
          onGenerateRandomCode={generateRandomCode}
        />
      </div>
      
      <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 pb-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
          className="px-6 py-3 text-base font-semibold rounded-xl border-warm-gold/30 hover:bg-warm-gold/10 order-2 sm:order-1"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={loading}
          className="bg-[#c49d68] hover:bg-[#c49d68]/90 text-white px-6 py-3 text-base font-semibold rounded-xl shadow-md order-1 sm:order-2"
        >
          {loading ? (isEditing ? "Updating..." : "Creating...") : (isEditing ? "Update Code" : "Create Code")}
        </Button>
      </div>
    </form>
  );
}
