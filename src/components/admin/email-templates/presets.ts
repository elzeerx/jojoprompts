// Email template presets and building blocks for the editor
// Focused on email-client-safe HTML (table-based, inline styles)

export type PresetKey = "branded" | "minimal";

interface TemplatePreset {
  key: PresetKey;
  name: string;
  description: string;
  subject: string;
  html: string;
  text?: string;
  exampleVars?: Record<string, any>;
}

const brand = {
  gold: "#c49d68",
  teal: "#7a9e9f",
  dark: "#262626",
  soft: "#efeee9",
};

const baseStyles = {
  bodyBg: "#f4f5f7",
  cardBg: "#ffffff",
  text: brand.dark,
  muted: "#6b7280",
  border: "#e5e7eb",
  link: brand.teal,
  ctaBg: brand.gold,
  ctaText: "#1f2937",
  soft: brand.soft,
};

const emailContainerStart = (maxWidth = 600) => `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:${baseStyles.bodyBg};padding:24px 0;margin:0;">
    <tr>
      <td align="center">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:${maxWidth}px;background:${baseStyles.cardBg};border-radius:12px;border:1px solid ${baseStyles.border};overflow:hidden;">
`;

const emailContainerEnd = `
        </table>
      </td>
    </tr>
  </table>
`;

const headerSection = `
  <tr>
    <td style="padding:20px 24px;border-bottom:1px solid ${baseStyles.border};">
      <table width="100%" cellspacing="0" cellpadding="0" role="presentation">
        <tr>
          <td align="left" style="font-size:14px;color:${baseStyles.muted}">JojoPrompts</td>
          <td align="right" style="font-size:12px;color:${baseStyles.muted}">{{date}}</td>
        </tr>
      </table>
    </td>
  </tr>
`;

const footerSection = `
  <tr>
    <td style="padding:20px 24px;border-top:1px solid ${baseStyles.border};background:${baseStyles.soft}">
      <div style="font-size:12px;color:${baseStyles.muted};line-height:1.6;">
        You are receiving this email because you registered at JojoPrompts.
        <br />
        <a href="{{unsubscribe_url}}" style="color:${baseStyles.link};text-decoration:underline;">Unsubscribe</a>
      </div>
    </td>
  </tr>
`;

const brandedPresetHtml = `
${emailContainerStart()}
${headerSection}
  <tr>
    <td style="padding:28px 24px 8px 24px;">
      <h1 style="margin:0 0 12px 0;font-size:22px;line-height:1.3;color:${baseStyles.text};">{{headline}}</h1>
      <p style="margin:0 0 16px 0;font-size:14px;line-height:1.7;color:${baseStyles.muted};">Hi {{user.first_name}},</p>
      <p style="margin:0 0 16px 0;font-size:14px;line-height:1.7;color:${baseStyles.text};">{{intro}}</p>

      <!-- highlight panel -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${brand.soft};border:1px solid ${baseStyles.border};border-radius:10px;margin:16px 0;">
        <tr>
          <td style="padding:16px;">
            <div style="font-size:14px;color:${baseStyles.text};line-height:1.6;">
              {{highlight}}
            </div>
          </td>
        </tr>
      </table>

      <!-- CTA button -->
      <table role="presentation" cellspacing="0" cellpadding="0" style="margin:18px 0 10px 0;">
        <tr>
          <td style="background:${baseStyles.ctaBg};border-radius:8px;">
            <a href="{{cta_url}}" style="display:inline-block;padding:12px 18px;color:${baseStyles.ctaText};font-weight:600;text-decoration:none;">
              {{cta_label}}
            </a>
          </td>
        </tr>
      </table>

      <p style="margin:12px 0 0 0;font-size:12px;color:${baseStyles.muted};">If the button doesn\'t work, copy and paste this link into your browser:</p>
      <p style="margin:6px 0 0 0;font-size:12px;color:${baseStyles.link};word-break:break-all;">
        <a href="{{cta_url}}" style="color:${baseStyles.link};text-decoration:underline;">{{cta_url}}</a>
      </p>

      <p style="margin:18px 0 0 0;font-size:14px;color:${baseStyles.text};">Best regards,<br/>The JojoPrompts Team</p>
    </td>
  </tr>
${footerSection}
${emailContainerEnd}
`;

const minimalPresetHtml = `
${emailContainerStart(600)}
  <tr>
    <td style="padding:28px 24px;">
      <h2 style="margin:0 0 12px 0;font-size:20px;color:${baseStyles.text};">{{headline}}</h2>
      <p style="margin:0 0 14px 0;font-size:14px;color:${baseStyles.text};line-height:1.7;">{{intro}}</p>
      <hr style="border:none;border-top:1px solid ${baseStyles.border};margin:16px 0;"/>
      <p style="margin:0 0 14px 0;font-size:14px;color:${baseStyles.text};line-height:1.7;">{{body}}</p>
      <p style="margin:18px 0 0 0;font-size:12px;color:${baseStyles.muted};">Thanks,<br/>JojoPrompts</p>
    </td>
  </tr>
${emailContainerEnd}
`;

export const templatePresets: TemplatePreset[] = [
  {
    key: "branded",
    name: "Branded (Recommended)",
    description: "600px card, highlight panel, CTA button, unsubscribe footer",
    subject: "{{subject}}",
    html: brandedPresetHtml,
    text: `{{headline}}\n\n{{intro}}\n\n{{highlight}}\n\n{{cta_label}}: {{cta_url}}\n\nBest,\nJojoPrompts`,
    exampleVars: {
      subject: "Welcome to JojoPrompts",
      headline: "Get the most out of your plan",
      intro: "We\'ve curated tips to help you start fast.",
      highlight: "Save 20% on annual plans this week only.",
      cta_label: "Explore Tips",
      cta_url: "https://jojoprompts.app/pricing",
      user: { first_name: "Alex" },
      unsubscribe_url: "https://jojoprompts.app/unsubscribe?e={{user.email}}",
      date: "{{today}}"
    },
  },
  {
    key: "minimal",
    name: "Minimal",
    description: "Simple 600px content card with divider",
    subject: "{{subject}}",
    html: minimalPresetHtml,
    text: `{{headline}}\n\n{{intro}}\n\n{{body}}\n\n— JojoPrompts`,
    exampleVars: {
      subject: "Your weekly summary",
      headline: "Highlights of the week",
      intro: "Here\'s what\'s new.",
      body: "Several improvements have shipped...",
    },
  },
];

// Quick-insert building blocks
export const blocks = {
  cta: `
  <table role="presentation" cellspacing="0" cellpadding="0" style="margin:16px 0;">
    <tr>
      <td style="background:${baseStyles.ctaBg};border-radius:8px;">
        <a href="{{cta_url}}" style="display:inline-block;padding:12px 18px;color:${baseStyles.ctaText};font-weight:600;text-decoration:none;">{{cta_label}}</a>
      </td>
    </tr>
  </table>
`,
  highlight: `
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${brand.soft};border:1px solid ${baseStyles.border};border-radius:10px;margin:16px 0;">
    <tr>
      <td style="padding:16px;">
        <div style="font-size:14px;color:${baseStyles.text};line-height:1.6;">{{highlight}}</div>
      </td>
    </tr>
  </table>
`,
  divider: `<hr style="border:none;border-top:1px solid ${baseStyles.border};margin:16px 0;"/>`,
  spacer: `<div style="line-height:1px;height:16px">&#8202;</div>`,
};
