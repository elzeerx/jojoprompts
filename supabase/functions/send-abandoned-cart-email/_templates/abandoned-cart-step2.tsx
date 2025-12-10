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

interface AbandonedCartStep2Props {
  userName: string;
  planName: string;
  planPrice: string;
  currency: string;
  checkoutUrl: string;
  supportEmail: string;
}

export const AbandonedCartStep2 = ({
  userName = 'there',
  planName = 'Premium Plan',
  planPrice = '$80',
  currency = 'USD',
  checkoutUrl = 'https://jojoprompts.com/checkout',
  supportEmail = 'info@jojoprompts.com',
}: AbandonedCartStep2Props) => {
  const previewText = `Your prompts are waiting! Don't miss out on ${planName}`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
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
              {userName}, your prompts are still waiting! 🎯
            </Heading>
            
            <Text style={paragraph}>
              Just a friendly reminder - you're one step away from unlocking
              powerful AI prompts that will transform your creative workflow.
            </Text>

            {/* Social Proof Section */}
            <Section style={socialProofBox}>
              <Text style={quoteText}>
                "JoJo Prompts has completely changed how I work with AI. 
                The prompts are incredibly well-crafted and save me hours every day."
              </Text>
              <Text style={authorText}>— Sarah K., Content Creator</Text>
            </Section>

            {/* Plan Summary */}
            <Section style={planBox}>
              <Text style={planLabel}>YOUR PLAN IS READY</Text>
              <Text style={planNameText}>{planName}</Text>
              <Text style={planPriceText}>
                {currency === 'KWD' ? `${planPrice} KWD` : planPrice}
              </Text>
            </Section>

            {/* What You're Missing */}
            <Text style={subheading}>Here's what you're missing out on:</Text>
            
            <Section style={benefitGrid}>
              <Section style={benefitItem}>
                <Text style={benefitIcon}>🎨</Text>
                <Text style={benefitText}>Midjourney prompts for stunning visuals</Text>
              </Section>
              <Section style={benefitItem}>
                <Text style={benefitIcon}>💬</Text>
                <Text style={benefitText}>ChatGPT prompts for any task</Text>
              </Section>
              <Section style={benefitItem}>
                <Text style={benefitIcon}>🔄</Text>
                <Text style={benefitText}>Regular updates with new prompts</Text>
              </Section>
              <Section style={benefitItem}>
                <Text style={benefitIcon}>⚡</Text>
                <Text style={benefitText}>Instant access after purchase</Text>
              </Section>
            </Section>

            {/* CTA Button */}
            <Section style={buttonContainer}>
              <Button style={ctaButton} href={checkoutUrl}>
                Get Your Prompts Now
              </Button>
            </Section>

            <Text style={urgencyText}>
              ⏰ Don't let this opportunity slip away!
            </Text>

            <Text style={smallText}>
              Questions? We're here to help:{' '}
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

export default AbandonedCartStep2;

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

const header = {
  backgroundColor: '#262626',
  padding: '24px',
  textAlign: 'center' as const,
  borderRadius: '8px 8px 0 0',
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

const socialProofBox = {
  backgroundColor: '#f8f5f0',
  borderRadius: '8px',
  padding: '24px',
  margin: '24px 0',
  borderLeft: '4px solid #c49d68',
};

const quoteText = {
  color: '#4a4a4a',
  fontSize: '15px',
  fontStyle: 'italic' as const,
  lineHeight: '1.6',
  margin: '0 0 12px',
};

const authorText = {
  color: '#7a9e9f',
  fontSize: '13px',
  fontWeight: '600',
  margin: '0',
};

const planBox = {
  backgroundColor: '#262626',
  borderRadius: '8px',
  padding: '24px',
  margin: '24px 0',
  textAlign: 'center' as const,
};

const planLabel = {
  color: '#c49d68',
  fontSize: '12px',
  fontWeight: '600',
  letterSpacing: '1px',
  margin: '0 0 8px',
};

const planNameText = {
  color: '#ffffff',
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

const subheading = {
  color: '#262626',
  fontSize: '18px',
  fontWeight: '600',
  margin: '24px 0 16px',
};

const benefitGrid = {
  margin: '0 0 24px',
};

const benefitItem = {
  padding: '8px 0',
};

const benefitIcon = {
  display: 'inline',
  fontSize: '16px',
  margin: '0 8px 0 0',
};

const benefitText = {
  display: 'inline',
  color: '#4a4a4a',
  fontSize: '15px',
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const ctaButton = {
  backgroundColor: '#c49d68',
  borderRadius: '8px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '16px',
  fontWeight: '600',
  padding: '16px 32px',
  textDecoration: 'none',
  textAlign: 'center' as const,
};

const urgencyText = {
  color: '#c49d68',
  fontSize: '16px',
  fontWeight: '600',
  textAlign: 'center' as const,
  margin: '0 0 24px',
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
