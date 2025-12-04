import { InputValidator } from "@/utils/inputValidation";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

interface PasswordStrengthIndicatorProps {
  password: string;
  className?: string;
}

export function PasswordStrengthIndicator({ password, className = "" }: PasswordStrengthIndicatorProps) {
  const { t, isRTL } = useTranslation();
  
  if (!password) return null;

  const validation = InputValidator.validatePassword(password);
  const { strength } = validation;

  const getStrengthColor = () => {
    switch (strength) {
      case 'weak': return 'bg-destructive';
      case 'medium': return 'bg-yellow-500';
      case 'strong': return 'bg-green-500';
      default: return 'bg-muted';
    }
  };

  const getStrengthWidth = () => {
    switch (strength) {
      case 'weak': return 'w-1/3';
      case 'medium': return 'w-2/3';
      case 'strong': return 'w-full';
      default: return 'w-0';
    }
  };

  const getStrengthLabel = () => {
    switch (strength) {
      case 'weak': return t('auth.passwordWeak');
      case 'medium': return t('auth.passwordMedium');
      case 'strong': return t('auth.passwordStrong');
      default: return '';
    }
  };

  const checks = [
    { test: password.length >= 8, label: t('auth.passwordLength') },
    { test: /[A-Z]/.test(password), label: t('auth.passwordUppercase') },
    { test: /[a-z]/.test(password), label: t('auth.passwordLowercase') },
    { test: /[0-9]/.test(password), label: t('auth.passwordNumber') },
  ];

  return (
    <div className={cn("space-y-2 mt-2", className, isRTL && "rtl-text")}>
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-muted rounded-full h-2">
          <div 
            className={cn(
              "h-2 rounded-full transition-all duration-300",
              getStrengthColor(),
              getStrengthWidth()
            )}
          />
        </div>
        <span className={cn(
          "text-xs font-medium",
          strength === 'weak' && 'text-destructive',
          strength === 'medium' && 'text-yellow-600',
          strength === 'strong' && 'text-green-600'
        )}>
          {getStrengthLabel()}
        </span>
      </div>
      
      <div className="grid grid-cols-2 gap-1 text-xs">
        {checks.map((check, index) => (
          <div 
            key={index} 
            className={cn(
              "flex items-center gap-1",
              check.test ? "text-green-600" : "text-muted-foreground"
            )}
          >
            <span className={cn(
              "w-1.5 h-1.5 rounded-full",
              check.test ? "bg-green-500" : "bg-muted"
            )} />
            <span>{check.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
