import { PlatformField } from '@/types/platform';

/**
 * Base props for all field components
 */
export interface BaseFieldProps {
  field: PlatformField;
  value: any;
  onChange: (value: any) => void;
  error?: string | string[];
  disabled?: boolean;
  className?: string;
}

/**
 * Extended props for field components with event handlers
 */
export interface FieldComponentProps extends BaseFieldProps {
  onBlur?: () => void;
  onFocus?: () => void;
}
