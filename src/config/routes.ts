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
const VerifyEmailPage = lazy(() => import("@/pages/auth/VerifyEmail"));
const PromptsPage = lazy(() => import("@/pages/PromptsPage"));
const ChatGPTPromptsPage = lazy(() => import("@/pages/prompts/ChatGPTPromptsPage"));
const MidjourneyPromptsPage = lazy(() => import("@/pages/prompts/MidjourneyPromptsPage"));
const WorkflowPromptsPage = lazy(() => import("@/pages/prompts/WorkflowPromptsPage"));
const GPTsBuilderPage = lazy(() => import("@/pages/prompts/GPTsBuilderPage"));
const FavoritesPage = lazy(() => import("@/pages/FavoritesPage"));
const SearchPage = lazy(() => import("@/pages/SearchPage"));
const PricingPage = lazy(() => import("@/pages/PricingPage"));
const CheckoutPage = lazy(() => import("@/pages/CheckoutPage"));
const PaymentCallbackPage = lazy(() => import("@/pages/PaymentCallbackPage"));
const UpaymentCallbackPage = lazy(() => import("@/pages/UpaymentCallbackPage"));
const MagicLoginPage = lazy(() => import("@/pages/MagicLoginPage").then(m => ({ default: m.MagicLoginPage })));
const UnsubscribePage = lazy(() => import("@/pages/UnsubscribePage"));
const PaymentSuccessPage = lazy(() => import("@/pages/PaymentSuccessPage"));
const PaymentFailedPage = lazy(() => import("@/pages/PaymentFailedPage"));
const PaymentDashboardPage = lazy(() => import("@/pages/PaymentDashboardPage"));
const PaymentRecoveryPage = lazy(() => import("@/pages/PaymentRecoveryPage"));
const UserDashboardPage = lazy(() => import("@/pages/UserDashboardPage"));
const SubscriptionDashboard = lazy(() => import("@/pages/dashboard/SubscriptionDashboard"));
const PrompterDashboard = lazy(() => import("@/pages/prompter/PrompterDashboard"));

const PlatformTest = lazy(() => import("@/pages/PlatformTest"));
const AboutPage = lazy(() => import("@/pages/AboutPage"));
const ContactPage = lazy(() => import("@/pages/ContactPage"));
const FAQPage = lazy(() => import("@/pages/FAQPage"));
const PrivacyPolicyPage = lazy(() => import("@/pages/PrivacyPolicyPage"));
const TermsOfServicePage = lazy(() => import("@/pages/TermsOfServicePage"));
const ExamplesPage = lazy(() => import("@/pages/ExamplesPage"));
const EnhancedPromptDemo = lazy(() => import("@/pages/EnhancedPromptDemo"));
const MagicLinkSentPage = lazy(() => import("@/pages/MagicLinkSentPage"));
const DemoHub = lazy(() => import("@/pages/demos"));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));

// V2 pages (Phase C) — anonymous discovery + auth-only library
const V2ExplorePage = lazy(() => import("@/pages/v2/ExplorePage"));
const V2SkillsPage = lazy(() => import("@/pages/v2/SkillsPage"));
const V2AutomationsPage = lazy(() => import("@/pages/v2/AutomationsPage"));
const V2PromptsCatalogPage = lazy(() => import("@/pages/v2/PromptsCatalogPage"));
const V2ImageStylesPage = lazy(() => import("@/pages/v2/ImageStylesPage"));
const V2BundlesPage = lazy(() => import("@/pages/v2/BundlesPage"));
const V2ResourceDetailPage = lazy(() => import("@/pages/v2/ResourceDetailPage"));
const V2LibraryPage = lazy(() => import("@/pages/v2/LibraryPage"));
const V2CartPage = lazy(() => import("@/pages/v2/CartPage"));
const V2CheckoutPage = lazy(() => import("@/pages/v2/V2CheckoutPage"));
const V2CheckoutReturnPage = lazy(() => import("@/pages/v2/V2CheckoutReturnPage"));
const V2CheckoutCancelPage = lazy(() => import("@/pages/v2/V2CheckoutCancelPage"));
const V2OrdersPage = lazy(() => import("@/pages/v2/V2OrdersPage"));
const V2PricingPage = lazy(() => import("@/pages/v2/V2PricingPage"));


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
    path: "auth/verify-email",
    component: VerifyEmailPage,
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
    protection: "premium"  // Require subscription to access prompts catalog
  },
  {
    path: "prompts/chatgpt",
    component: ChatGPTPromptsPage,
    protection: "premium"
  },
  {
    path: "prompts/midjourney",
    component: MidjourneyPromptsPage,
    protection: "premium"
  },
  {
    path: "prompts/workflow",
    component: WorkflowPromptsPage,
    protection: "premium"
  },
  {
    path: "prompts/gpts-builder",
    component: GPTsBuilderPage,
    protection: "premium"
  },
  {
    path: "search",
    component: SearchPage,
    protection: "public"
  },
  {
    path: "pricing",
    component: V2PricingPage,
    protection: "public"
  },
  {
    path: "checkout",
    component: V2CheckoutPage,
    protection: "public"
  },
  {
    path: "payment/callback",
    component: PaymentCallbackPage,
    protection: "public"
  },
  {
    path: "payment/upayments-callback",
    component: UpaymentCallbackPage,
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

  // Admin routes are mounted as nested routes directly in App.tsx
  // (see <Route path="admin/*"> with AdminLayout). Standalone admin
  // utility routes still live here:
  {
    path: "admin/platform-test",
    component: PlatformTest,
    protection: "admin",
    fallbackRoute: "/prompts"
  },
  {
    path: "demos",
    component: DemoHub,
    protection: "admin",
    fallbackRoute: "/prompts"
  },

  // V2 discovery + resource detail + library (Phase C)
  { path: "explore", component: V2ExplorePage, protection: "public" },
  { path: "skills", component: V2SkillsPage, protection: "public" },
  { path: "automations", component: V2AutomationsPage, protection: "public" },
  { path: "prompts-catalog", component: V2PromptsCatalogPage, protection: "public" },
  { path: "image-styles", component: V2ImageStylesPage, protection: "public" },
  { path: "bundles", component: V2BundlesPage, protection: "public" },
  { path: "resources/:slug", component: V2ResourceDetailPage, protection: "public" },
  { path: "library", component: V2LibraryPage, protection: "public" },

  // V2 Commerce (Phase 4A) — customer experience.
  // Overrides prior V1 checkout/pricing UI. V1 page components remain in source.
  { path: "cart", component: V2CartPage, protection: "public" },
  { path: "checkout/return", component: V2CheckoutReturnPage, protection: "public" },
  { path: "checkout/return/:orderId", component: V2CheckoutReturnPage, protection: "public" },
  { path: "checkout/cancel", component: V2CheckoutCancelPage, protection: "public" },
  { path: "checkout/cancel/:orderId", component: V2CheckoutCancelPage, protection: "public" },
  { path: "orders", component: V2OrdersPage, protection: "auth" },

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