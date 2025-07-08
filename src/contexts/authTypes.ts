
import { Session, User } from '@supabase/supabase-js';

export interface AuthContextType {
  session: Session | null;
  user: User | null;
  userRole: string | null;
  isAdmin: boolean;
  isJadmin: boolean;
  isPrompter: boolean;
  canDeleteUsers: boolean;
  canCancelSubscriptions: boolean;
  canManagePrompts: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}
