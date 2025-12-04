
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface PromptFormFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "input" | "textarea";
  placeholder?: string;
  error?: string;
}

export function PromptFormField({
  id,
  label,
  value,
  onChange,
  type = "input",
  placeholder,
  error
}: PromptFormFieldProps) {
  return (
    <div className="grid grid-cols-4 items-start gap-4">
      <Label htmlFor={id} className="text-right text-sm font-medium text-gray-700 mt-2">
        {label}
      </Label>
      <div className="col-span-3 space-y-1">
        {type === "textarea" ? (
          <Textarea
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={cn(
              "min-h-[100px] bg-white/60 border-gray-200 rounded-lg",
              error && "border-red-500 focus-visible:ring-red-500"
            )}
          />
        ) : (
          <Input
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={cn(
              "bg-white/60 border-gray-200 rounded-lg",
              error && "border-red-500 focus-visible:ring-red-500"
            )}
          />
        )}
        {error && (
          <div className="flex items-center gap-1 text-red-500 text-xs">
            <AlertCircle className="h-3 w-3" />
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
