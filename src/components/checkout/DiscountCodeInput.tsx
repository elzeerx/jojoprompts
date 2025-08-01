
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, Percent, X } from "lucide-react";

interface DiscountCodeInputProps {
  onDiscountApplied: (discount: {
    id: string;
    code: string;
    discount_type: string;
    discount_value: number;
  }) => void;
  onDiscountRemoved: () => void;
  appliedDiscount?: {
    id: string;
    code: string;
    discount_type: string;
    discount_value: number;
  } | null;
  disabled?: boolean;
  planId?: string;
}

export function DiscountCodeInput({
  onDiscountApplied,
  onDiscountRemoved,
  appliedDiscount,
  disabled = false,
  planId
}: DiscountCodeInputProps) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionDiscountApplied, setSessionDiscountApplied] = useState(false);

  const validateDiscountCode = async () => {
    if (!code.trim()) {
      toast({
        title: "Error",
        description: "Please enter a discount code",
        variant: "destructive"
      });
      return;
    }

    // Prevent multiple discount applications in same session
    if (sessionDiscountApplied) {
      toast({
        title: "Error",
        description: "A discount has already been applied to this session",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Validating discount code

      // Call the function with plan validation and user_id
      const { data, error } = await supabase.rpc('validate_discount_code', {
        code_text: code.trim().toUpperCase(),
        plan_id_param: planId || null,
        user_id_param: null // Let the function use auth.uid() automatically
      });

      if (error) {
        console.error('Discount validation error:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        toast({
          title: "Invalid Code",
          description: "The discount code you entered does not exist",
          variant: "destructive"
        });
        return;
      }

      const discount = data[0];
      
      // Discount validation completed
      
      if (!discount.is_valid) {
        toast({
          title: "Invalid Code",
          description: discount.error_message || "This discount code cannot be used",
          variant: "destructive"
        });
        return;
      }

      // Apply the discount
      onDiscountApplied({
        id: discount.id,
        code: code.trim().toUpperCase(),
        discount_type: discount.discount_type,
        discount_value: discount.discount_value
      });

      // Mark that a discount has been applied in this session
      setSessionDiscountApplied(true);

      toast({
        title: "Discount Applied!",
        description: `${discount.discount_type === 'percentage' ? `${discount.discount_value}%` : `$${discount.discount_value}`} discount has been applied`,
      });

      setCode("");
    } catch (error: any) {
      console.error("Error validating discount code:", error);
      toast({
        title: "Error",
        description: "Failed to validate discount code. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const removeDiscount = () => {
    onDiscountRemoved();
    setSessionDiscountApplied(false); // Reset session flag
    toast({
      title: "Discount Removed",
      description: "The discount code has been removed from your order",
    });
  };

  if (appliedDiscount) {
    return (
      <div className="border border-green-200 bg-green-50 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Percent className="h-4 w-4 text-green-600" />
            <div>
              <p className="font-medium text-green-800">
                Discount Applied: {appliedDiscount.code}
              </p>
              <p className="text-sm text-green-600">
                {appliedDiscount.discount_type === 'percentage' 
                  ? `${appliedDiscount.discount_value}% off` 
                  : `$${appliedDiscount.discount_value} off`
                }
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={removeDiscount}
            disabled={disabled}
            className="text-green-700 hover:text-green-800"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Discount Code</label>
      <div className="flex gap-2">
        <Input
          type="text"
          placeholder={sessionDiscountApplied ? "Discount already applied" : "Enter discount code"}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          disabled={loading || disabled || sessionDiscountApplied}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !sessionDiscountApplied) {
              e.preventDefault();
              validateDiscountCode();
            }
          }}
        />
        <Button
          onClick={validateDiscountCode}
          disabled={loading || !code.trim() || disabled || sessionDiscountApplied}
          variant="outline"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Apply"
          )}
        </Button>
      </div>
    </div>
  );
}
