
import { Session, User } from '@supabase/supabase-js';

export interface AuthContextType {
  session: Session | null;
  user: User | null;
  userRole: string | null;
  isAdmin: boolean;
  isJadmin: boolean;
  isPrompter: boolean;
  isSuperAdmin: boolean;
  canDeleteUsers: boolean;
  canCancelSubscriptions: boolean;
  canManagePrompts: boolean;
  canChangePasswords: boolean;
  canFullCRUD: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}
