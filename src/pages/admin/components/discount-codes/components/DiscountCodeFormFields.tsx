
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarIcon, Shuffle } from "lucide-react";
import { format } from "date-fns";
import { useSubscriptionPlans } from "../hooks/useSubscriptionPlans";

interface FormData {
  code: string;
  discount_type: string;
  discount_value: string;
  expiration_date: Date | undefined;
  usage_limit: string;
  applies_to_all_plans: boolean;
  applicable_plans: string[];
}

interface DiscountCodeFormFieldsProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  onGenerateRandomCode: () => void;
}

export function DiscountCodeFormFields({ 
  formData, 
  setFormData, 
  onGenerateRandomCode 
}: DiscountCodeFormFieldsProps) {
  const { plans, loading: plansLoading } = useSubscriptionPlans();

  const handlePlanToggle = (planId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      applicable_plans: checked 
        ? [...prev.applicable_plans, planId]
        : prev.applicable_plans.filter(id => id !== planId)
    }));
  };

  const handleAllPlansToggle = (checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      applies_to_all_plans: checked,
      applicable_plans: checked ? [] : prev.applicable_plans
    }));
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="code" className="text-base font-semibold text-gray-900">
          Code *
        </Label>
        <div className="flex gap-2">
          <Input
            id="code"
            value={formData.code}
            onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
            placeholder="DISCOUNT10"
            className="font-mono text-base border-gray-300 focus:border-warm-gold focus:ring-warm-gold rounded-lg"
            maxLength={20}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onGenerateRandomCode}
            className="border-warm-gold/30 hover:bg-warm-gold/10 rounded-lg"
          >
            <Shuffle className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="discount_type" className="text-base font-semibold text-gray-900">
          Discount Type *
        </Label>
        <Select
          value={formData.discount_type}
          onValueChange={(value) => setFormData(prev => ({ ...prev, discount_type: value }))}
        >
          <SelectTrigger className="text-base border-gray-300 focus:border-warm-gold focus:ring-warm-gold rounded-lg">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-lg">
            <SelectItem value="percentage">Percentage (%)</SelectItem>
            <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="discount_value" className="text-base font-semibold text-gray-900">
          Discount Value * {formData.discount_type === 'percentage' ? '(%)' : '($)'}
        </Label>
        <Input
          id="discount_value"
          type="number"
          value={formData.discount_value}
          onChange={(e) => setFormData(prev => ({ ...prev, discount_value: e.target.value }))}
          placeholder={formData.discount_type === 'percentage' ? '10' : '5.00'}
          min="0.01"
          max={formData.discount_type === 'percentage' ? '100' : undefined}
          step="0.01"
          className="text-base border-gray-300 focus:border-warm-gold focus:ring-warm-gold rounded-lg"
        />
      </div>

      <div className="space-y-3">
        <Label className="text-base font-semibold text-gray-900">
          Applicable Plans *
        </Label>
        
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="all-plans"
              checked={formData.applies_to_all_plans}
              onCheckedChange={handleAllPlansToggle}
              className="border-warm-gold data-[state=checked]:bg-warm-gold"
            />
            <Label htmlFor="all-plans" className="text-sm font-medium">
              Apply to all plans
            </Label>
          </div>

          {!formData.applies_to_all_plans && (
            <div className="space-y-2 pl-6">
              <Label className="text-sm text-gray-600">Select specific plans:</Label>
              {plansLoading ? (
                <div className="text-sm text-gray-500">Loading plans...</div>
              ) : (
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {plans.map((plan) => (
                    <div key={plan.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`plan-${plan.id}`}
                        checked={formData.applicable_plans.includes(plan.id)}
                        onCheckedChange={(checked) => handlePlanToggle(plan.id, !!checked)}
                        className="border-warm-gold data-[state=checked]:bg-warm-gold"
                      />
                      <Label htmlFor={`plan-${plan.id}`} className="text-sm">
                        {plan.name} (${plan.price_usd})
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-base font-semibold text-gray-900">
          Expiration Date (Optional)
        </Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-start text-left font-normal text-base border-gray-300 hover:bg-warm-gold/10 rounded-lg"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {formData.expiration_date ? format(formData.expiration_date, "PPP") : "No expiration"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 rounded-lg" align="start">
            <Calendar
              mode="single"
              selected={formData.expiration_date}
              onSelect={(date) => setFormData(prev => ({ ...prev, expiration_date: date }))}
              disabled={(date) => date < new Date()}
              initialFocus
            />
            {formData.expiration_date && (
              <div className="p-3 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFormData(prev => ({ ...prev, expiration_date: undefined }))}
                  className="w-full rounded-lg"
                >
                  Clear Date
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-2">
        <Label htmlFor="usage_limit" className="text-base font-semibold text-gray-900">
          Usage Limit (Optional)
        </Label>
        <Input
          id="usage_limit"
          type="number"
          value={formData.usage_limit}
          onChange={(e) => setFormData(prev => ({ ...prev, usage_limit: e.target.value }))}
          placeholder="100"
          min="1"
          className="text-base border-gray-300 focus:border-warm-gold focus:ring-warm-gold rounded-lg"
        />
      </div>
    </div>
  );
}
