/**
 * Centralized Route Configuration — V2.
 *
 * Only surviving V2 customer/public/auth/legal/info surfaces are declared
 * here. Legacy V1 premium/subscription/payment-success/prompter/demo pages
 * have been removed from the active router; their sources may remain on
 * disk as archival, but they are not imported here and are therefore not
 * lazy-loaded, code-split, or reachable via the app router. Legacy paths
 * are handled by explicit client-side `<Navigate replace />` redirects in
 * `src/App.tsx` (see `LEGACY_REDIRECTS`).
 */

import { ComponentType, lazy } from "react";
import type { UserRole } from "@/contexts/roles";

// Public auth / legal / info
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const ResetPasswordPage = lazy(() => import("@/pages/ResetPasswordPage"));
const SignupPage = lazy(() => import("@/pages/SignupPage"));
const EmailConfirmationPage = lazy(() => import("@/pages/EmailConfirmationPage"));
const VerifyEmailPage = lazy(() => import("@/pages/auth/VerifyEmail"));
const MagicLoginPage = lazy(() =>
  import("@/pages/MagicLoginPage").then((m) => ({ default: m.MagicLoginPage })),
);
const MagicLinkSentPage = lazy(() => import("@/pages/MagicLinkSentPage"));
const UnsubscribePage = lazy(() => import("@/pages/UnsubscribePage"));

const AboutPage = lazy(() => import("@/pages/AboutPage"));
const ContactPage = lazy(() => import("@/pages/ContactPage"));
const FAQPage = lazy(() => import("@/pages/FAQPage"));
const PrivacyPolicyPage = lazy(() => import("@/pages/PrivacyPolicyPage"));
const TermsOfServicePage = lazy(() => import("@/pages/TermsOfServicePage"));

const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));

// V2 root + discovery + resource detail + library
const Index = lazy(() => import("@/pages/Index"));
const V2ExplorePage = lazy(() => import("@/pages/v2/ExplorePage"));
const V2SkillsPage = lazy(() => import("@/pages/v2/SkillsPage"));
const V2AutomationsPage = lazy(() => import("@/pages/v2/AutomationsPage"));
const V2PromptsCatalogPage = lazy(() => import("@/pages/v2/PromptsCatalogPage"));
const V2ImageStylesPage = lazy(() => import("@/pages/v2/ImageStylesPage"));
const V2BundlesPage = lazy(() => import("@/pages/v2/BundlesPage"));
const V2ResourceDetailPage = lazy(() => import("@/pages/v2/ResourceDetailPage"));
const V2LibraryPage = lazy(() => import("@/pages/v2/LibraryPage"));
const V2HowItWorksPage = lazy(() => import("@/pages/v2/HowItWorksPage"));

// V2 commerce
const V2CartPage = lazy(() => import("@/pages/v2/CartPage"));
const V2CheckoutPage = lazy(() => import("@/pages/v2/V2CheckoutPage"));
const V2CheckoutReturnPage = lazy(() => import("@/pages/v2/V2CheckoutReturnPage"));
const V2CheckoutCancelPage = lazy(() => import("@/pages/v2/V2CheckoutCancelPage"));
const V2OrdersPage = lazy(() => import("@/pages/v2/V2OrdersPage"));
const V2PricingPage = lazy(() => import("@/pages/v2/V2PricingPage"));
const V2AccountPage = lazy(() => import("@/pages/v2/AccountPage"));

/**
 * Route protection types.
 *
 * `premium` has been retired from V2. Acquisition is entitlement-based,
 * enforced server-side per resource — not by a subscription-plan gate on
 * the client router. The enum entry remains so existing callers of
 * `isPremiumRoute` compile, but no V2 route may use it.
 */
export type RouteProtection = "public" | "auth" | "premium" | "role" | "admin";

export interface RouteConfig {
  path: string;
  component: ComponentType<any>;
  protection: RouteProtection;
  requiredRole?: UserRole;
  fallbackRoute?: string;
  index?: boolean;
}

export const routes: RouteConfig[] = [
  { path: "/", component: Index, protection: "public", index: true },

  // Auth / legal / info
  { path: "login", component: LoginPage, protection: "public" },
  { path: "reset-password", component: ResetPasswordPage, protection: "public" },
  { path: "signup", component: SignupPage, protection: "public" },
  { path: "auth/magic-login", component: MagicLoginPage, protection: "public" },
  { path: "magic-link-sent", component: MagicLinkSentPage, protection: "public" },
  { path: "email-confirmation", component: EmailConfirmationPage, protection: "public" },
  { path: "auth/verify-email", component: VerifyEmailPage, protection: "public" },
  { path: "unsubscribe", component: UnsubscribePage, protection: "public" },
  { path: "about", component: AboutPage, protection: "public" },
  { path: "contact", component: ContactPage, protection: "public" },
  { path: "faq", component: FAQPage, protection: "public" },
  { path: "privacy", component: PrivacyPolicyPage, protection: "public" },
  { path: "terms", component: TermsOfServicePage, protection: "public" },

  // V2 discovery + resource detail + library
  { path: "explore", component: V2ExplorePage, protection: "public" },
  { path: "skills", component: V2SkillsPage, protection: "public" },
  { path: "automations", component: V2AutomationsPage, protection: "public" },
  { path: "prompts-catalog", component: V2PromptsCatalogPage, protection: "public" },
  { path: "image-styles", component: V2ImageStylesPage, protection: "public" },
  { path: "bundles", component: V2BundlesPage, protection: "public" },
  { path: "resources/:slug", component: V2ResourceDetailPage, protection: "public" },
  { path: "library", component: V2LibraryPage, protection: "public" },
  { path: "how-it-works", component: V2HowItWorksPage, protection: "public" },
  { path: "pricing", component: V2PricingPage, protection: "public" },

  // V2 commerce
  { path: "cart", component: V2CartPage, protection: "public" },
  { path: "checkout", component: V2CheckoutPage, protection: "public" },
  { path: "checkout/return", component: V2CheckoutReturnPage, protection: "public" },
  { path: "checkout/return/:orderId", component: V2CheckoutReturnPage, protection: "public" },
  { path: "checkout/cancel", component: V2CheckoutCancelPage, protection: "public" },
  { path: "checkout/cancel/:orderId", component: V2CheckoutCancelPage, protection: "public" },
  { path: "orders", component: V2OrdersPage, protection: "auth" },
  { path: "account", component: V2AccountPage, protection: "auth" },

  // 404 catch-all — rendered inside V2Layout when unlocked (see App.tsx).
  { path: "*", component: NotFoundPage, protection: "public" },
];

export function getRoutesByProtection(protection: RouteProtection): RouteConfig[] {
  return routes.filter((route) => route.protection === protection);
}

export function getRouteByPath(path: string): RouteConfig | undefined {
  return routes.find((route) => route.path === path);
}

export function isProtectedRoute(path: string): boolean {
  const route = getRouteByPath(path);
  return route ? route.protection !== "public" : false;
}

/**
 * Legacy helper kept only so external callers compile. V2 has no premium
 * routes; this will always return `false` against the current `routes`.
 */
export function isPremiumRoute(path: string): boolean {
  const route = getRouteByPath(path);
  return route ? route.protection === "premium" : false;
}

export function isAdminRoute(path: string): boolean {
  const route = getRouteByPath(path);
  return route ? route.protection === "admin" : false;
}
