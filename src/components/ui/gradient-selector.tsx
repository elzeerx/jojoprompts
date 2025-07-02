import React from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

interface GradientSelectorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

const gradientOptions = [
  {
    name: "Warm Gold",
    value: "from-warm-gold/20 via-warm-gold/10 to-transparent",
    preview: "bg-gradient-to-r from-yellow-400 via-yellow-200 to-transparent"
  },
  {
    name: "Muted Teal", 
    value: "from-muted-teal/20 via-muted-teal/10 to-transparent",
    preview: "bg-gradient-to-r from-teal-400 via-teal-200 to-transparent"
  },
  {
    name: "Blue",
    value: "from-blue-500/20 via-blue-500/10 to-transparent",
    preview: "bg-gradient-to-r from-blue-500 via-blue-300 to-transparent"
  },
  {
    name: "Green",
    value: "from-green-500/20 via-green-500/10 to-transparent", 
    preview: "bg-gradient-to-r from-green-500 via-green-300 to-transparent"
  },
  {
    name: "Purple",
    value: "from-purple-500/20 via-purple-500/10 to-transparent",
    preview: "bg-gradient-to-r from-purple-500 via-purple-300 to-transparent"
  },
  {
    name: "Red",
    value: "from-red-500/20 via-red-500/10 to-transparent",
    preview: "bg-gradient-to-r from-red-500 via-red-300 to-transparent"
  },
  {
    name: "Orange",
    value: "from-orange-500/20 via-orange-500/10 to-transparent",
    preview: "bg-gradient-to-r from-orange-500 via-orange-300 to-transparent"
  },
  {
    name: "Pink",
    value: "from-pink-500/20 via-pink-500/10 to-transparent",
    preview: "bg-gradient-to-r from-pink-500 via-pink-300 to-transparent"
  },
  {
    name: "Indigo",
    value: "from-indigo-500/20 via-indigo-500/10 to-transparent",
    preview: "bg-gradient-to-r from-indigo-500 via-indigo-300 to-transparent"
  }
];

export function GradientSelector({ value, onChange, label = "Background Gradient" }: GradientSelectorProps) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="grid grid-cols-3 gap-2">
        {gradientOptions.map((option) => (
          <Button
            key={option.value}
            type="button"
            variant="outline"
            className={`relative h-16 p-1 border-2 transition-colors ${
              value === option.value 
                ? 'border-primary ring-2 ring-primary/20' 
                : 'border-muted hover:border-muted-foreground/50'
            }`}
            onClick={() => onChange(option.value)}
          >
            <div className={`w-full h-full rounded ${option.preview}`} />
            {value === option.value && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/10 rounded">
                <Check className="h-4 w-4 text-white drop-shadow-lg" />
              </div>
            )}
            <span className="absolute bottom-0 left-0 right-0 text-xs bg-black/70 text-white px-1 py-0.5 rounded-b truncate">
              {option.name}
            </span>
          </Button>
        ))}
      </div>
    </div>
  );
}