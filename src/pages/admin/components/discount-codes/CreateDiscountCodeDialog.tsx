
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Shuffle } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface CreateDiscountCodeDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateDiscountCodeDialog({ open, onClose, onSuccess }: CreateDiscountCodeDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    discount_type: 'percentage',
    discount_value: '',
    expiration_date: undefined as Date | undefined,
    usage_limit: '',
  });

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
      const { error } = await supabase
        .from("discount_codes")
        .insert({
          code: formData.code.toUpperCase(),
          discount_type: formData.discount_type,
          discount_value: discountValue,
          expiration_date: formData.expiration_date?.toISOString(),
          usage_limit: formData.usage_limit ? parseInt(formData.usage_limit) : null,
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
      });

      onSuccess();
    } catch (error: any) {
      console.error("Error creating discount code:", error);
      toast({
        title: "Error",
        description: error.message.includes('duplicate') ? 
          "A discount code with this name already exists" : 
          "Failed to create discount code",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Discount Code</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Code *</Label>
            <div className="flex gap-2">
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                placeholder="DISCOUNT10"
                className="font-mono"
                maxLength={20}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={generateRandomCode}
              >
                <Shuffle className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="discount_type">Discount Type *</Label>
            <Select
              value={formData.discount_type}
              onValueChange={(value) => setFormData(prev => ({ ...prev, discount_type: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">Percentage (%)</SelectItem>
                <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="discount_value">
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
            />
          </div>

          <div className="space-y-2">
            <Label>Expiration Date (Optional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.expiration_date ? format(formData.expiration_date, "PPP") : "No expiration"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
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
                      className="w-full"
                    >
                      Clear Date
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="usage_limit">Usage Limit (Optional)</Label>
            <Input
              id="usage_limit"
              type="number"
              value={formData.usage_limit}
              onChange={(e) => setFormData(prev => ({ ...prev, usage_limit: e.target.value }))}
              placeholder="100"
              min="1"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 bg-warm-gold hover:bg-warm-gold/90"
            >
              {loading ? "Creating..." : "Create Code"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
