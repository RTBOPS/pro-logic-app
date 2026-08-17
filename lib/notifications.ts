/**
 * PRO-LOGIC Notifications — Native device approach
 * Opens the user's default Mail / Messages app with a pre-composed message.
 * No third-party API keys required.
 */

export async function sendConfirmationEmail(opts: {
  to: string;
  crewName: string;
  role: string;
  productionName: string;
  client: string;
  token: string;
  shootDates?: string;
  location?: string;
}): Promise<boolean> {
  // Always use the production domain — never expose Vercel preview URLs in emails
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pro-logic.studio';

  const confirmUrl = `${appUrl}/confirm/${opts.token}`;

  const subject = encodeURIComponent(
    `[PRO-LOGIC] You're invited: ${opts.productionName}`
  );

  const bodyLines = [
    `Hi ${opts.crewName},`,
    '',
    `You've been added to the following production on PRO-LOGIC Studio:`,
    '',
    `Production: ${opts.productionName}`,
    `Client:     ${opts.client}`,
    `Your role:  ${opts.role}`,
    opts.shootDates ? `Dates:      ${opts.shootDates}` : null,
    opts.location   ? `Location:   ${opts.location}`   : null,
    '',
    `Please confirm your availability here:`,
    confirmUrl,
    '',
    '— PRO-LOGIC Studio',
  ].filter((l): l is string => l !== null);

  const body = encodeURIComponent(bodyLines.join('\n'));

  if (typeof window !== 'undefined') {
    window.open(`mailto:${opts.to}?subject=${subject}&body=${body}`, '_blank');
  }
  return true;
}

export async function sendSMS(opts: {
  to: string;
  crewName: string;
  role: string;
  productionName: string;
  client: string;
  shootDates?: string;
  location?: string;
}): Promise<boolean> {
  const parts = [
    `PRO-LOGIC: Hi ${opts.crewName}, you've been added to "${opts.productionName}" (${opts.client}) as ${opts.role}.`,
    opts.shootDates ? `Dates: ${opts.shootDates}.` : null,
    opts.location   ? `Location: ${opts.location}.` : null,
  ].filter((p): p is string => p !== null);

  const message = encodeURIComponent(parts.join(' '));
  const phone = opts.to.replace(/\D/g, '');

  if (typeof window !== 'undefined') {
    // iOS: sms:NUMBER&body=TEXT  |  Android: sms:NUMBER?body=TEXT
    // Using ?body= which works on both platforms in modern browsers
    window.open(`sms:${phone}?body=${message}`, '_blank');
  }
  return true;
}
