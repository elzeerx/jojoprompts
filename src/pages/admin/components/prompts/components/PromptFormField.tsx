
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface PromptFormFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "input" | "textarea";
  placeholder?: string;
}

export function PromptFormField({
  id,
  label,
  value,
  onChange,
  type = "input",
  placeholder
}: PromptFormFieldProps) {
  return (
    <div className="grid grid-cols-4 items-start gap-4">
      <Label htmlFor={id} className="text-right text-sm font-medium text-gray-700 mt-2">
        {label}
      </Label>
      {type === "textarea" ? (
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="col-span-3 min-h-[100px] bg-white/60 border-gray-200 rounded-lg"
        />
      ) : (
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="col-span-3 bg-white/60 border-gray-200 rounded-lg"
        />
      )}
    </div>
  );
}
