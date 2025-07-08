
import { InputValidator } from "@/utils/inputValidation";

interface PasswordStrengthIndicatorProps {
  password: string;
  className?: string;
}

export function PasswordStrengthIndicator({ password, className = "" }: PasswordStrengthIndicatorProps) {
  if (!password) return null;

  const validation = InputValidator.validatePassword(password);
  const { strength } = validation;

  const getStrengthColor = () => {
    switch (strength) {
      case 'weak': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'strong': return 'bg-green-500';
      default: return 'bg-gray-300';
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

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-gray-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${getStrengthColor()} ${getStrengthWidth()}`}
          />
        </div>
        <span className={`text-xs font-medium ${
          strength === 'weak' ? 'text-red-600' :
          strength === 'medium' ? 'text-yellow-600' :
          'text-green-600'
        }`}>
          {strength.charAt(0).toUpperCase() + strength.slice(1)}
        </span>
      </div>
      
      <div className="text-xs text-gray-600">
        <p>Password should contain:</p>
        <ul className="list-disc list-inside space-y-1 mt-1">
          <li className={/[a-z]/.test(password) ? 'text-green-600' : ''}>
            Lowercase letter
          </li>
          <li className={/[A-Z]/.test(password) ? 'text-green-600' : ''}>
            Uppercase letter
          </li>
          <li className={/[0-9]/.test(password) ? 'text-green-600' : ''}>
            Number
          </li>
          <li className={/[^a-zA-Z0-9]/.test(password) ? 'text-green-600' : ''}>
            Special character
          </li>
          <li className={password.length >= 8 ? 'text-green-600' : ''}>
            At least 8 characters
          </li>
        </ul>
      </div>
    </div>
  );
}
