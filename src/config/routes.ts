/**
 * Centralized Route Configuration
 * 
 * This file contains all application routes with their protection levels,
 * making it easier to manage routing logic and access control.
 */

import { ComponentType, lazy } from "react";
import type { UserRole } from "@/contexts/roles";

// Lazy load components for better performance
const Index = lazy(() => import("@/pages/Index"));
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const ResetPasswordPage = lazy(() => import("@/pages/ResetPasswordPage"));
const SignupPage = lazy(() => import("@/pages/SignupPage"));
const EmailConfirmationPage = lazy(() => import("@/pages/EmailConfirmationPage"));
const PromptsPage = lazy(() => import("@/pages/PromptsPage"));
const ChatGPTPromptsPage = lazy(() => import("@/pages/prompts/ChatGPTPromptsPage"));
const MidjourneyPromptsPage = lazy(() => import("@/pages/prompts/MidjourneyPromptsPage"));
const WorkflowPromptsPage = lazy(() => import("@/pages/prompts/WorkflowPromptsPage"));
const FavoritesPage = lazy(() => import("@/pages/FavoritesPage"));
const SearchPage = lazy(() => import("@/pages/SearchPage"));
const PricingPage = lazy(() => import("@/pages/PricingPage"));
const CheckoutPage = lazy(() => import("@/pages/CheckoutPage"));
const PaymentCallbackPage = lazy(() => import("@/pages/PaymentCallbackPage"));
const MagicLoginPage = lazy(() => import("@/pages/MagicLoginPage").then(m => ({ default: m.MagicLoginPage })));
const UnsubscribePage = lazy(() => import("@/pages/UnsubscribePage"));
const PaymentSuccessPage = lazy(() => import("@/pages/PaymentSuccessPage"));
const PaymentFailedPage = lazy(() => import("@/pages/PaymentFailedPage"));
const PaymentDashboardPage = lazy(() => import("@/pages/PaymentDashboardPage"));
const PaymentRecoveryPage = lazy(() => import("@/pages/PaymentRecoveryPage"));
const UserDashboardPage = lazy(() => import("@/pages/UserDashboardPage"));
const SubscriptionDashboard = lazy(() => import("@/pages/dashboard/SubscriptionDashboard"));
const PrompterDashboard = lazy(() => import("@/pages/prompter/PrompterDashboard"));
const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
const PromptsManagement = lazy(() => import("@/pages/admin/PromptsManagement"));
const PromptGeneratorPage = lazy(() => import("@/pages/PromptGeneratorPage"));
const AboutPage = lazy(() => import("@/pages/AboutPage"));
const ContactPage = lazy(() => import("@/pages/ContactPage"));
const FAQPage = lazy(() => import("@/pages/FAQPage"));
const PrivacyPolicyPage = lazy(() => import("@/pages/PrivacyPolicyPage"));
const TermsOfServicePage = lazy(() => import("@/pages/TermsOfServicePage"));
const ExamplesPage = lazy(() => import("@/pages/ExamplesPage"));
const EnhancedPromptDemo = lazy(() => import("@/pages/EnhancedPromptDemo"));
const MagicLinkSentPage = lazy(() => import("@/pages/MagicLinkSentPage"));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));

/**
 * Route protection types
 */
export type RouteProtection = 
  | 'public'           // No authentication required
  | 'auth'            // Authentication required
  | 'premium'         // Authentication + subscription required
  | 'role'            // Authentication + specific role required
  | 'admin';          // Admin role required

/**
 * Route configuration interface
 */
export interface RouteConfig {
  path: string;
  component: ComponentType<any>;
  protection: RouteProtection;
  requiredRole?: UserRole;
  fallbackRoute?: string;
  index?: boolean;
}

/**
 * Application routes configuration
 */
export const routes: RouteConfig[] = [
  // Public routes - no authentication required
  {
    path: "/",
    component: Index,
    protection: "public",
    index: true
  },
  {
    path: "login",
    component: LoginPage,
    protection: "public"
  },
  {
    path: "reset-password",
    component: ResetPasswordPage,
    protection: "public"
  },
  {
    path: "reset-password",
    component: ResetPasswordPage,
    protection: "public"
  },
  {
    path: "auth/magic-login",
    component: MagicLoginPage,
    protection: "public"
  },
  {
    path: "unsubscribe",
    component: UnsubscribePage,
    protection: "public"
  },
  {
    path: "signup",
    component: SignupPage,
    protection: "public"
  },
  {
    path: "magic-link-sent",
    component: MagicLinkSentPage,
    protection: "public"
  },
  {
    path: "email-confirmation",
    component: EmailConfirmationPage,
    protection: "public"
  },
  {
    path: "examples",
    component: ExamplesPage,
    protection: "public"
  },
  {
    path: "demo/enhanced-prompt",
    component: EnhancedPromptDemo,
    protection: "public"
  },
  {
    path: "prompts",
    component: PromptsPage,
    protection: "public"
  },
  {
    path: "prompts/chatgpt",
    component: ChatGPTPromptsPage,
    protection: "public"
  },
  {
    path: "prompts/midjourney",
    component: MidjourneyPromptsPage,
    protection: "public"
  },
  {
    path: "prompts/workflow",
    component: WorkflowPromptsPage,
    protection: "public"
  },
  {
    path: "search",
    component: SearchPage,
    protection: "public"
  },
  {
    path: "pricing",
    component: PricingPage,
    protection: "public"
  },
  {
    path: "checkout",
    component: CheckoutPage,
    protection: "public"
  },
  {
    path: "payment/callback",
    component: PaymentCallbackPage,
    protection: "public"
  },
  {
    path: "payment-success",
    component: PaymentSuccessPage,
    protection: "public"
  },
  {
    path: "payment-failed",
    component: PaymentFailedPage,
    protection: "public"
  },
  {
    path: "payment-recovery",
    component: PaymentRecoveryPage,
    protection: "public"
  },
  {
    path: "prompt-generator",
    component: PromptGeneratorPage,
    protection: "public"
  },
  {
    path: "about",
    component: AboutPage,
    protection: "public"
  },
  {
    path: "contact",
    component: ContactPage,
    protection: "public"
  },
  {
    path: "faq",
    component: FAQPage,
    protection: "public"
  },
  {
    path: "privacy",
    component: PrivacyPolicyPage,
    protection: "public"
  },
  {
    path: "terms",
    component: TermsOfServicePage,
    protection: "public"
  },

  // Premium routes - authentication + subscription required
  {
    path: "favorites",
    component: FavoritesPage,
    protection: "premium"
  },
  {
    path: "payment-dashboard",
    component: PaymentDashboardPage,
    protection: "premium"
  },
  {
    path: "dashboard",
    component: UserDashboardPage,
    protection: "premium"
  },
  {
    path: "dashboard/subscription",
    component: SubscriptionDashboard,
    protection: "premium"
  },

  // Role-based routes
  {
    path: "dashboard/prompter",
    component: PrompterDashboard,
    protection: "role",
    requiredRole: "prompter"
  },
  {
    path: "prompter",
    component: PrompterDashboard,
    protection: "role",
    requiredRole: "prompter"
  },

  // Admin routes
  {
    path: "admin",
    component: AdminDashboard,
    protection: "admin",
    fallbackRoute: "/prompts"
  },
  {
    path: "admin/prompts",
    component: PromptsManagement,
    protection: "admin",
    fallbackRoute: "/prompts"
  },

  // 404 catch-all route
  {
    path: "*",
    component: NotFoundPage,
    protection: "public"
  }
];

/**
 * Helper function to get routes by protection level
 */
export function getRoutesByProtection(protection: RouteProtection): RouteConfig[] {
  return routes.filter(route => route.protection === protection);
}

/**
 * Helper function to get route configuration by path
 */
export function getRouteByPath(path: string): RouteConfig | undefined {
  return routes.find(route => route.path === path);
}

/**
 * Helper function to check if a route requires authentication
 */
export function isProtectedRoute(path: string): boolean {
  const route = getRouteByPath(path);
  return route ? route.protection !== 'public' : false;
}

/**
 * Helper function to check if a route requires subscription
 */
export function isPremiumRoute(path: string): boolean {
  const route = getRouteByPath(path);
  return route ? route.protection === 'premium' : false;
}

/**
 * Helper function to check if a route requires admin role
 */
export function isAdminRoute(path: string): boolean {
  const route = getRouteByPath(path);
  return route ? route.protection === 'admin' : false;
}