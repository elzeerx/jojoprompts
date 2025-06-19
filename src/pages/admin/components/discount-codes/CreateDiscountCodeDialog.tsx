
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
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
      <DialogContent className="w-full max-w-2xl h-[90vh] flex flex-col p-0">
        {/* Fixed Header */}
        <div className="flex-shrink-0 p-6 border-b border-gray-200">
          <span 
            className="inline-block rounded-lg text-white px-3 py-1 text-xs font-medium mb-3"
            style={{ backgroundColor: '#c49d68' }}
          >
            Discount
          </span>
          <DialogHeader className="text-left p-0">
            <DialogTitle className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">
              Create Discount Code
            </DialogTitle>
          </DialogHeader>
        </div>
        
        {/* Scrollable Content */}
        <ScrollArea className="flex-1 px-6">
          <div className="py-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="bg-white/40 p-4 sm:p-6 rounded-xl border border-gray-200">
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
                        onClick={generateRandomCode}
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
              </div>
              
              {/* Fixed Footer Buttons */}
              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 pb-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
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
                  {loading ? "Creating..." : "Create Code"}
                </Button>
              </div>
            </form>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
