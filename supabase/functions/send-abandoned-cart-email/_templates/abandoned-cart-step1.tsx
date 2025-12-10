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

interface AbandonedCartStep1Props {
  userName: string;
  planName: string;
  planPrice: string;
  currency: string;
  checkoutUrl: string;
  supportEmail: string;
}

export const AbandonedCartStep1 = ({
  userName = 'there',
  planName = 'Premium Plan',
  planPrice = '$80',
  currency = 'USD',
  checkoutUrl = 'https://jojoprompts.com/checkout',
  supportEmail = 'info@jojoprompts.com',
}: AbandonedCartStep1Props) => {
  const previewText = `Complete your ${planName} purchase - your prompts are waiting!`;

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
              Hi {userName}, you left something behind! 👋
            </Heading>
            
            <Text style={paragraph}>
              We noticed you started checking out but didn't complete your purchase.
              No worries - your selected plan is still waiting for you!
            </Text>

            {/* Plan Summary Box */}
            <Section style={planBox}>
              <Text style={planLabel}>YOUR SELECTED PLAN</Text>
              <Text style={planNameText}>{planName}</Text>
              <Text style={planPriceText}>
                {currency === 'KWD' ? `${planPrice} KWD` : planPrice}
              </Text>
            </Section>

            <Text style={paragraph}>
              With the {planName}, you'll get:
            </Text>
            
            <ul style={featureList}>
              <li style={featureItem}>✓ Access to premium AI prompts</li>
              <li style={featureItem}>✓ Multiple AI platform support</li>
              <li style={featureItem}>✓ Regular updates with new prompts</li>
              <li style={featureItem}>✓ Priority customer support</li>
            </ul>

            {/* CTA Button - Bulletproof for Outlook */}
            <Section style={buttonContainer}>
              <Button style={ctaButton} href={checkoutUrl}>
                Complete Your Purchase
              </Button>
            </Section>

            <Text style={smallText}>
              Having trouble? Simply reply to this email or contact us at{' '}
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

export default AbandonedCartStep1;

// Styles - All inline for email client compatibility
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

const featureList = {
  padding: '0',
  margin: '0 0 24px',
  listStyleType: 'none' as const,
};

const featureItem = {
  color: '#4a4a4a',
  fontSize: '15px',
  lineHeight: '1.8',
  paddingLeft: '8px',
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

const smallText = {
  color: '#666666',
  fontSize: '14px',
  lineHeight: '1.5',
  margin: '24px 0 0',
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
