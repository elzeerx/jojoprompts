import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
  Hr,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'

interface AbandonedCartStep3Props {
  userName: string;
  planName: string;
  planPrice: string;
  currency: string;
  checkoutUrl: string;
  supportEmail: string;
  discountCode?: string;
  discountPercent?: string;
}

export const AbandonedCartStep3 = ({
  userName = 'there',
  planName = 'Premium Plan',
  planPrice = '$80',
  currency = 'USD',
  checkoutUrl = 'https://jojoprompts.com/checkout',
  supportEmail = 'info@jojoprompts.com',
  discountCode,
  discountPercent = '10',
}: AbandonedCartStep3Props) => {
  const hasDiscount = !!discountCode;
  const previewText = hasDiscount 
    ? `Final reminder: Get ${discountPercent}% off your ${planName}!`
    : `Last chance to get your ${planName} - we're keeping it ready for you`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header with Urgency Banner */}
          <Section style={urgencyBanner}>
            <Text style={urgencyBannerText}>
              ⏰ FINAL REMINDER {hasDiscount && `- ${discountPercent}% OFF INSIDE`}
            </Text>
          </Section>

          <Section style={header}>
            <Img
              src="https://fxkqgjakbyrxkmevkglv.supabase.co/storage/v1/object/public/default-prompt-images/jojo-logo.png"
              width="120"
              height="40"
              alt="JoJo Prompts"
              style={logo}
            />
          </Section>

          {/* Main Content */}
          <Section style={content}>
            <Heading style={h1}>
              {userName}, this is your last chance! 🚨
            </Heading>
            
            <Text style={paragraph}>
              We've been holding your spot, but we wanted to reach out one more time 
              before removing your pending order.
            </Text>

            {/* Discount Section (if applicable) */}
            {hasDiscount && (
              <Section style={discountBox}>
                <Text style={discountLabel}>EXCLUSIVE OFFER FOR YOU</Text>
                <Text style={discountValue}>{discountPercent}% OFF</Text>
                <Text style={discountCodeText}>
                  Use code: <span style={codeHighlight}>{discountCode}</span>
                </Text>
                <Text style={discountExpiry}>Valid for 48 hours only</Text>
              </Section>
            )}

            {/* Plan Summary */}
            <Section style={planBox}>
              <Text style={planLabel}>YOUR RESERVED PLAN</Text>
              <Text style={planNameText}>{planName}</Text>
              {hasDiscount ? (
                <>
                  <Text style={originalPrice}>{currency === 'KWD' ? `${planPrice} KWD` : planPrice}</Text>
                  <Text style={discountedPrice}>
                    After {discountPercent}% discount
                  </Text>
                </>
              ) : (
                <Text style={planPriceText}>
                  {currency === 'KWD' ? `${planPrice} KWD` : planPrice}
                </Text>
              )}
            </Section>

            {/* What's Included Checklist */}
            <Text style={subheading}>Everything you'll get:</Text>
            
            <Section style={checklistBox}>
              <Text style={checkItem}>✅ Lifetime access to premium prompts</Text>
              <Text style={checkItem}>✅ All future updates included</Text>
              <Text style={checkItem}>✅ Midjourney, ChatGPT, DALL-E & more</Text>
              <Text style={checkItem}>✅ Priority support</Text>
              <Text style={checkItem}>✅ 30-day money-back guarantee</Text>
            </Section>

            {/* CTA Button */}
            <Section style={buttonContainer}>
              <Button style={ctaButton} href={checkoutUrl}>
                {hasDiscount ? `Claim Your ${discountPercent}% Discount` : 'Complete Purchase Now'}
              </Button>
            </Section>

            {/* Guarantee Badge */}
            <Section style={guaranteeBox}>
              <Text style={guaranteeIcon}>🛡️</Text>
              <Text style={guaranteeText}>
                <strong>30-Day Money-Back Guarantee</strong><br />
                Try it risk-free. If you're not satisfied, we'll refund you.
              </Text>
            </Section>

            <Text style={smallText}>
              This is our final reminder. If you have any questions or concerns 
              that prevented you from completing your purchase, please let us know at{' '}
              <Link href={`mailto:${supportEmail}`} style={link}>
                {supportEmail}
              </Link>
            </Text>
          </Section>

          <Hr style={hr} />

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              © {new Date().getFullYear()} JoJo Prompts. All rights reserved.
            </Text>
            <Text style={footerText}>
              You're receiving this email because you started a checkout on JoJo Prompts.
            </Text>
            <Link href="https://jojoprompts.com/unsubscribe" style={unsubscribeLink}>
              Unsubscribe from marketing emails
            </Link>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default AbandonedCartStep3;

// Styles
const main = {
  backgroundColor: '#f6f6f6',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
};

const container = {
  margin: '0 auto',
  padding: '20px 0',
  maxWidth: '600px',
};

const urgencyBanner = {
  backgroundColor: '#c49d68',
  padding: '12px',
  textAlign: 'center' as const,
  borderRadius: '8px 8px 0 0',
};

const urgencyBannerText = {
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: '700',
  letterSpacing: '1px',
  margin: '0',
};

const header = {
  backgroundColor: '#262626',
  padding: '24px',
  textAlign: 'center' as const,
};

const logo = {
  margin: '0 auto',
};

const content = {
  backgroundColor: '#ffffff',
  padding: '40px 32px',
};

const h1 = {
  color: '#262626',
  fontSize: '24px',
  fontWeight: '700',
  lineHeight: '1.4',
  margin: '0 0 24px',
};

const paragraph = {
  color: '#4a4a4a',
  fontSize: '16px',
  lineHeight: '1.6',
  margin: '0 0 20px',
};

const discountBox = {
  background: 'linear-gradient(135deg, #c49d68 0%, #dbb896 100%)',
  borderRadius: '12px',
  padding: '32px',
  margin: '24px 0',
  textAlign: 'center' as const,
};

const discountLabel = {
  color: '#ffffff',
  fontSize: '12px',
  fontWeight: '600',
  letterSpacing: '2px',
  margin: '0 0 8px',
};

const discountValue = {
  color: '#ffffff',
  fontSize: '48px',
  fontWeight: '800',
  margin: '0 0 12px',
};

const discountCodeText = {
  color: '#ffffff',
  fontSize: '16px',
  margin: '0 0 8px',
};

const codeHighlight = {
  backgroundColor: 'rgba(255,255,255,0.2)',
  padding: '4px 12px',
  borderRadius: '4px',
  fontFamily: 'monospace',
  fontWeight: '700',
};

const discountExpiry = {
  color: 'rgba(255,255,255,0.8)',
  fontSize: '13px',
  margin: '8px 0 0',
};

const planBox = {
  backgroundColor: '#f8f5f0',
  borderRadius: '8px',
  padding: '24px',
  margin: '24px 0',
  textAlign: 'center' as const,
  border: '2px solid #c49d68',
};

const planLabel = {
  color: '#7a9e9f',
  fontSize: '12px',
  fontWeight: '600',
  letterSpacing: '1px',
  margin: '0 0 8px',
};

const planNameText = {
  color: '#262626',
  fontSize: '20px',
  fontWeight: '700',
  margin: '0 0 8px',
};

const planPriceText = {
  color: '#c49d68',
  fontSize: '28px',
  fontWeight: '700',
  margin: '0',
};

const originalPrice = {
  color: '#888888',
  fontSize: '18px',
  textDecoration: 'line-through',
  margin: '0 0 4px',
};

const discountedPrice = {
  color: '#c49d68',
  fontSize: '14px',
  fontWeight: '600',
  margin: '0',
};

const subheading = {
  color: '#262626',
  fontSize: '18px',
  fontWeight: '600',
  margin: '24px 0 16px',
};

const checklistBox = {
  backgroundColor: '#f8f8f8',
  borderRadius: '8px',
  padding: '20px 24px',
  margin: '0 0 24px',
};

const checkItem = {
  color: '#4a4a4a',
  fontSize: '15px',
  lineHeight: '2',
  margin: '0',
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const ctaButton = {
  backgroundColor: '#262626',
  borderRadius: '8px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '16px',
  fontWeight: '600',
  padding: '18px 36px',
  textDecoration: 'none',
  textAlign: 'center' as const,
};

const guaranteeBox = {
  backgroundColor: '#f0f9f0',
  borderRadius: '8px',
  padding: '20px',
  margin: '24px 0',
  textAlign: 'center' as const,
  border: '1px solid #c8e6c9',
};

const guaranteeIcon = {
  fontSize: '24px',
  margin: '0 0 8px',
};

const guaranteeText = {
  color: '#4a4a4a',
  fontSize: '14px',
  lineHeight: '1.5',
  margin: '0',
};

const smallText = {
  color: '#666666',
  fontSize: '14px',
  lineHeight: '1.5',
  margin: '24px 0 0',
  textAlign: 'center' as const,
};

const link = {
  color: '#c49d68',
  textDecoration: 'underline',
};

const hr = {
  borderColor: '#e6e6e6',
  margin: '0',
};

const footer = {
  backgroundColor: '#f8f8f8',
  padding: '24px 32px',
  borderRadius: '0 0 8px 8px',
};

const footerText = {
  color: '#888888',
  fontSize: '12px',
  lineHeight: '1.5',
  margin: '0 0 8px',
  textAlign: 'center' as const,
};

const unsubscribeLink = {
  color: '#888888',
  fontSize: '12px',
  textDecoration: 'underline',
  display: 'block',
  textAlign: 'center' as const,
};
