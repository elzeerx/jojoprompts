import { UseFormReturn } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";

interface ModelParametersEditorProps {
  model: {
    id: string;
    name: string;
    parameters: Record<string, any>;
  };
  form: UseFormReturn<any>;
  fieldPath: string;
}

export function ModelParametersEditor({ model, form, fieldPath }: ModelParametersEditorProps) {
  const parameters = model.parameters as Record<string, any>;

  const renderParameterField = (paramName: string, paramConfig: any) => {
    const fullFieldPath = `${fieldPath}.${paramName}`;

    // Handle array parameters (like aspect_ratio, version)
    if (Array.isArray(paramConfig)) {
      return (
        <FormField
          key={paramName}
          control={form.control}
          name={fullFieldPath}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="capitalize">
                {paramName.replace(/_/g, ' ')}
              </FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={`Select ${paramName.replace(/_/g, ' ')}`} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {paramConfig.map((option: string) => (
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
    }

    // Handle range parameters (like stylize, chaos)
    if (typeof paramConfig === 'object' && paramConfig.min !== undefined && paramConfig.max !== undefined) {
      return (
        <FormField
          key={paramName}
          control={form.control}
          name={fullFieldPath}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="capitalize">
                {paramName.replace(/_/g, ' ')}
                {field.value !== undefined && (
                  <span className="ml-2 text-sm text-muted-foreground">
                    ({field.value})
                  </span>
                )}
              </FormLabel>
              <FormControl>
                <div className="px-3">
                  <Slider
                    min={paramConfig.min}
                    max={paramConfig.max}
                    step={1}
                    value={[field.value || paramConfig.default || paramConfig.min]}
                    onValueChange={(values) => field.onChange(values[0])}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>{paramConfig.min}</span>
                    <span>{paramConfig.max}</span>
                  </div>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );
    }

    // Handle simple string/number parameters
    return (
      <FormField
        key={paramName}
        control={form.control}
        name={fullFieldPath}
        render={({ field }) => (
          <FormItem>
            <FormLabel className="capitalize">
              {paramName.replace(/_/g, ' ')}
            </FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder={`Enter ${paramName.replace(/_/g, ' ')}`}
                type={typeof paramConfig === 'number' ? 'number' : 'text'}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    );
  };

  if (!parameters || Object.keys(parameters).length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        <p>No parameters available for this model.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {Object.entries(parameters).map(([paramName, paramConfig]) =>
        renderParameterField(paramName, paramConfig)
      )}
    </div>
  );
}