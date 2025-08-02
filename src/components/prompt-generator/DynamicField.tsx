import { UseFormReturn } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";
import { QuickAddModal } from "./QuickAddModal";

interface DynamicFieldProps {
  field: {
    id: string;
    field_name: string;
    field_type: string;
    options: string[];
  };
  form: UseFormReturn<any>;
  fieldPath: string;
}

export function DynamicField({ field, form, fieldPath }: DynamicFieldProps) {
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const fieldLabel = field.field_name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  const handleAddOption = (newOption: string) => {
    // This would call an API to add the option to the database
    // For now, we'll just close the modal
    setShowQuickAdd(false);
  };

  const renderField = () => {
    switch (field.field_type) {
      case "dropdown":
        return (
          <FormField
            control={form.control}
            name={fieldPath}
            render={({ field: formField }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>{fieldLabel}</FormLabel>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowQuickAdd(true)}
                    className="h-8 px-2"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <Select onValueChange={formField.onChange} value={formField.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={`Select ${fieldLabel.toLowerCase()}`} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {field.options.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        );

      case "multiselect":
        return (
          <FormField
            control={form.control}
            name={fieldPath}
            render={({ field: formField }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>{fieldLabel}</FormLabel>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowQuickAdd(true)}
                    className="h-8 px-2"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {field.options.map((option) => (
                    <div key={option} className="flex items-center space-x-2">
                      <Checkbox
                        id={`${fieldPath}-${option}`}
                        checked={(formField.value || []).includes(option)}
                        onCheckedChange={(checked) => {
                          const currentValue = formField.value || [];
                          if (checked) {
                            formField.onChange([...currentValue, option]);
                          } else {
                            formField.onChange(currentValue.filter((v: string) => v !== option));
                          }
                        }}
                      />
                      <label
                        htmlFor={`${fieldPath}-${option}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {option}
                      </label>
                    </div>
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        );

      case "textarea":
        return (
          <FormField
            control={form.control}
            name={fieldPath}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel>{fieldLabel}</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder={`Enter ${fieldLabel.toLowerCase()}`}
                    {...formField}
                    rows={3}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );

      case "text":
      default:
        return (
          <FormField
            control={form.control}
            name={fieldPath}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel>{fieldLabel}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={`Enter ${fieldLabel.toLowerCase()}`}
                    {...formField}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );
    }
  };

  return (
    <>
      {renderField()}
      <QuickAddModal
        isOpen={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        onAdd={handleAddOption}
        fieldName={fieldLabel}
        fieldId={field.id}
      />
    </>
  );
}