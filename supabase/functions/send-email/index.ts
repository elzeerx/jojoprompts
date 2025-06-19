
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

async function sendSMTPEmail(to: string, subject: string, html: string, text?: string) {
  const smtpHost = 'hs14.name.tools';
  const smtpPort = 587;
  const smtpUsername = Deno.env.get('SMTP_USERNAME');
  const smtpPassword = Deno.env.get('SMTP_PASSWORD');
  const fromEmail = Deno.env.get('SMTP_FROM_EMAIL');

  if (!smtpUsername || !smtpPassword || !fromEmail) {
    throw new Error('SMTP credentials not configured');
  }

  console.log(`Connecting to SMTP server: ${smtpHost}:${smtpPort}`);

  try {
    const conn = await Deno.connect({
      hostname: smtpHost,
      port: smtpPort,
    });

    const textEncoder = new TextEncoder();
    const textDecoder = new TextDecoder();

    // Helper function to send command and read response
    async function sendCommand(command: string): Promise<string> {
      await conn.write(textEncoder.encode(command + '\r\n'));
      const buffer = new Uint8Array(1024);
      const bytesRead = await conn.read(buffer);
      const response = textDecoder.decode(buffer.subarray(0, bytesRead || 0));
      console.log(`Command: ${command.trim()}, Response: ${response.trim()}`);
      return response;
    }

    // SMTP conversation
    let response = await sendCommand('');
    if (!response.startsWith('220')) {
      throw new Error(`SMTP connection failed: ${response}`);
    }

    response = await sendCommand(`EHLO ${smtpHost}`);
    if (!response.startsWith('250')) {
      throw new Error(`EHLO failed: ${response}`);
    }

    response = await sendCommand('STARTTLS');
    if (!response.startsWith('220')) {
      throw new Error(`STARTTLS failed: ${response}`);
    }

    // Upgrade to TLS
    const tlsConn = await Deno.startTls(conn, { hostname: smtpHost });

    // Helper for TLS commands
    async function sendTLSCommand(command: string): Promise<string> {
      await tlsConn.write(textEncoder.encode(command + '\r\n'));
      const buffer = new Uint8Array(1024);
      const bytesRead = await tlsConn.read(buffer);
      const response = textDecoder.decode(buffer.subarray(0, bytesRead || 0));
      console.log(`TLS Command: ${command.trim()}, Response: ${response.trim()}`);
      return response;
    }

    response = await sendTLSCommand(`EHLO ${smtpHost}`);
    if (!response.startsWith('250')) {
      throw new Error(`TLS EHLO failed: ${response}`);
    }

    response = await sendTLSCommand('AUTH LOGIN');
    if (!response.startsWith('334')) {
      throw new Error(`AUTH LOGIN failed: ${response}`);
    }

    // Send username (base64 encoded)
    const usernameB64 = btoa(smtpUsername);
    response = await sendTLSCommand(usernameB64);
    if (!response.startsWith('334')) {
      throw new Error(`Username auth failed: ${response}`);
    }

    // Send password (base64 encoded)
    const passwordB64 = btoa(smtpPassword);
    response = await sendTLSCommand(passwordB64);
    if (!response.startsWith('235')) {
      throw new Error(`Password auth failed: ${response}`);
    }

    // Send email
    response = await sendTLSCommand(`MAIL FROM:<${fromEmail}>`);
    if (!response.startsWith('250')) {
      throw new Error(`MAIL FROM failed: ${response}`);
    }

    response = await sendTLSCommand(`RCPT TO:<${to}>`);
    if (!response.startsWith('250')) {
      throw new Error(`RCPT TO failed: ${response}`);
    }

    response = await sendTLSCommand('DATA');
    if (!response.startsWith('354')) {
      throw new Error(`DATA failed: ${response}`);
    }

    // Construct email message
    const emailContent = [
      `From: ${fromEmail}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      '',
      html,
      '.',
    ].join('\r\n');

    response = await sendTLSCommand(emailContent);
    if (!response.startsWith('250')) {
      throw new Error(`Email send failed: ${response}`);
    }

    await sendTLSCommand('QUIT');
    tlsConn.close();

    console.log(`Email sent successfully to ${to}`);
    return { success: true, message: 'Email sent successfully' };

  } catch (error) {
    console.error('SMTP Error:', error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { to, subject, html, text }: EmailRequest = await req.json();

    if (!to || !subject || !html) {
      throw new Error('Missing required fields: to, subject, html');
    }

    const result = await sendSMTPEmail(to, subject, html, text);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in send-email function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
