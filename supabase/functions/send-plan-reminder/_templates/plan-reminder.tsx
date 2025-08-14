import { Body, Container, Head, Heading, Html, Link, Preview, Text, Button, Hr } from 'npm:@react-email/components@0.0.22';
import * as React from 'npm:react@18.3.1';

interface PlanReminderEmailProps {
  firstName: string;
  personalizedMessage: string;
  recommendedPlan: string;
  recommendationReason: string;
  daysSinceSignup: number;
  urgencyLevel: 'low' | 'medium' | 'high';
  pricingLink: string;
  unsubscribeLink: string;
  fallbackLoginLink?: string;
}

export const PlanReminderEmail = ({
  firstName,
  personalizedMessage,
  recommendedPlan,
  recommendationReason,
  daysSinceSignup,
  urgencyLevel,
  pricingLink,
  unsubscribeLink,
}: PlanReminderEmailProps) => (
  <Html>
    <Head />
    <Preview>Unlock Premium Features - Choose Your Plan 🎯</Preview>
    <Body style={main}>
      <Container style={container}>
        <div style={header}>
          <Heading style={h1}>JojoPrompts</Heading>
          <Text style={headerSubtext}>Premium AI Prompts Await You</Text>
        </div>
        
        <div style={content}>
          <Heading style={h2}>Hi {firstName},</Heading>
          
          <Text style={text}>{personalizedMessage}</Text>
          
          <div style={planHighlight}>
            <Heading style={planTitle}>🎯 {recommendedPlan} Plan - Perfect for You!</Heading>
            <Text style={planDescription}>{recommendationReason}</Text>
            <ul style={featureList}>
              <li>Access to thousands of high-quality AI prompts</li>
              <li>Exclusive prompt collections for different AI models</li>
              <li>Regular updates with new prompt categories</li>
              <li>Priority support and feature requests</li>
              <li>Commercial usage rights</li>
            </ul>
          </div>
          
          <div style={buttonContainer}>
            <Button href={pricingLink} style={button}>
              Choose Your Plan Now
            </Button>
          </div>

          <Text style={hintText}>
            Trouble with the button?{' '}
            <Link href={fallbackLoginLink || `${pricingLink}`} style={secondaryLink}>
              Sign in first
            </Link>{' '}then continue to pricing.
          </Text>
          
          <Hr style={hr} />
          
          <Text style={footer}>
            Don't want to receive these emails?{' '}
            <Link href={unsubscribeLink} style={unsubscribeLink}>
              Unsubscribe here
            </Link>
          </Text>
        </div>
      </Container>
    </Body>
  </Html>
);

export default PlanReminderEmail;

const main = {
  backgroundColor: '#ffffff',
  fontFamily: 'Arial, sans-serif',
};

const container = {
  maxWidth: '600px',
  margin: '0 auto',
  lineHeight: 1.6,
  color: '#333',
};

const header = {
  background: 'linear-gradient(135deg, #c49d68, #7a9e9f)',
  padding: '30px',
  textAlign: 'center' as const,
  color: 'white',
};

const h1 = {
  margin: '0',
  fontSize: '28px',
  fontWeight: 'bold',
};

const headerSubtext = {
  margin: '10px 0 0 0',
  fontSize: '16px',
  opacity: 0.9,
};

const content = {
  padding: '30px',
  background: '#fff',
};

const h2 = {
  color: '#c49d68',
  marginBottom: '20px',
  fontSize: '24px',
};

const text = {
  color: '#333',
  lineHeight: 1.6,
  marginBottom: '20px',
  fontSize: '16px',
};

const planHighlight = {
  background: '#f8f9fa',
  padding: '20px',
  borderRadius: '8px',
  margin: '20px 0',
};

const planTitle = {
  color: '#c49d68',
  marginTop: '0',
  fontSize: '20px',
  fontWeight: 'bold',
};

const planDescription = {
  margin: '10px 0',
  color: '#555',
  fontSize: '15px',
};

const featureList = {
  margin: '0',
  paddingLeft: '20px',
  color: '#555',
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '30px 0',
};

const button = {
  display: 'inline-block',
  padding: '15px 30px',
  background: '#c49d68',
  color: 'white',
  textDecoration: 'none',
  borderRadius: '8px',
  fontWeight: 'bold',
  fontSize: '16px',
};

const hr = {
  borderColor: '#eee',
  margin: '30px 0',
};

const footer = {
  fontSize: '14px',
  color: '#666',
  marginTop: '30px',
  textAlign: 'center' as const,
};

const unsubscribeLink = {
  color: '#c49d68',
  textDecoration: 'none',
};

const hintText = {
  fontSize: '14px',
  color: '#666',
  marginTop: '8px',
  textAlign: 'center' as const,
};

const secondaryLink = {
  color: '#7a9e9f',
  textDecoration: 'underline',
};