
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface PromptFormFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  isTextarea?: boolean;
}

export function PromptFormField({ 
  id, 
  label, 
  value, 
  onChange, 
  isTextarea = false 
}: PromptFormFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      {isTextarea ? (
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[100px]"
        />
      ) : (
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
