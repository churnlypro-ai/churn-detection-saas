import { Resend } from 'resend';

export type EmailLanguage = 'fr' | 'en';

let resendClient: Resend | null = null;

function getResend(): Resend {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

interface WeeklyReportParams {
  to: string;
  companyName: string;
  clientsSaved: number;
  revenueSaved: number;
  roiPercent: number;
  churnRateNow: number;
  churnRateBefore: number;
  dashboardUrl: string;
  language?: EmailLanguage;
}

interface WelcomeEmailParams {
  to: string;
  companyName: string;
  monthlyPrice: number;
  appUrl: string;
  language?: EmailLanguage;
}

export async function sendWelcomeEmail({
  to,
  companyName,
  monthlyPrice,
  appUrl,
  language = 'fr',
}: WelcomeEmailParams) {
  const resend = getResend();

  const offer1 = Math.round(monthlyPrice * 0.1);
  const offer2 = Math.round(monthlyPrice * 0.2);
  const offer3 = monthlyPrice;
  const offer5 = Math.round(monthlyPrice * 0.13);

  const expiryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(
    language === 'en' ? 'en-US' : 'fr-FR',
    { day: '2-digit', month: 'long' },
  );

  const subject = language === 'en' ? 'Welcome gift: pick your offer' : 'Cadeau de bienvenue : choisissez votre offre';

  const html = language === 'en' ? `
    <div style="font-family: Inter, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">
      <h2 style="font-weight: 600;">${subject}</h2>
      <p>It's been 14 days since you joined Churnly. Thanks, ${companyName}!</p>
      <p>Here are 5 offers. Pick the one that works for you:</p>
      <div style="margin: 24px 0;">
        <div style="margin-bottom: 12px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 12px;">
          <strong>Option 1:</strong> -$${offer1} this month
        </div>
        <div style="margin-bottom: 12px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 12px;">
          <strong>Option 2:</strong> -$${offer2} this month (3-month commitment)
        </div>
        <div style="margin-bottom: 12px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 12px;">
          <strong>Option 3:</strong> +1 month free ($${offer3} credited)
        </div>
        <div style="margin-bottom: 12px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 12px;">
          <strong>Option 4:</strong> Free priority support for 2 months
        </div>
        <div style="margin-bottom: 12px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 12px;">
          <strong>Option 5:</strong> Free detailed analysis + -$${offer5} this month
        </div>
      </div>
      <p style="margin-top: 24px;">
        <a href="${appUrl}/settings" style="background: #2148ec; color: white; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 500;">
          Choose my offer
        </a>
      </p>
      <p style="margin-top: 16px; font-size: 14px; color: #6b7280;">Valid until ${expiryDate}.</p>
    </div>
  ` : `
    <div style="font-family: Inter, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">
      <h2 style="font-weight: 600;">${subject}</h2>
      <p>Ça fait 14 jours que vous êtes chez Churnly. Merci ${companyName} !</p>
      <p>Voici 5 offres. Choisissez celle qui vous convient :</p>
      <div style="margin: 24px 0;">
        <div style="margin-bottom: 12px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 12px;">
          <strong>Option 1 :</strong> -${offer1}€ ce mois
        </div>
        <div style="margin-bottom: 12px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 12px;">
          <strong>Option 2 :</strong> -${offer2}€ ce mois (engagement 3 mois)
        </div>
        <div style="margin-bottom: 12px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 12px;">
          <strong>Option 3 :</strong> +1 mois gratuit (${offer3}€ crédité)
        </div>
        <div style="margin-bottom: 12px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 12px;">
          <strong>Option 4 :</strong> Support prioritaire gratuit 2 mois
        </div>
        <div style="margin-bottom: 12px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 12px;">
          <strong>Option 5 :</strong> Analyse détaillée gratuite + -${offer5}€ ce mois
        </div>
      </div>
      <p style="margin-top: 24px;">
        <a href="${appUrl}/settings" style="background: #2148ec; color: white; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 500;">
          Choisir mon offre
        </a>
      </p>
      <p style="margin-top: 16px; font-size: 14px; color: #6b7280;">Valable jusqu'au ${expiryDate}.</p>
    </div>
  `;

  return resend.emails.send({
    from: process.env.EMAIL_FROM || 'Churnly <welcome@yourdomain.com>',
    to,
    subject,
    html,
  });
}

interface RiskAlertClient {
  name: string;
  churnScore: number;
  reason: string;
  revenueMonthly: number;
  daysUntilRenewal: number | null;
}

interface RiskAlertParams {
  to: string;
  companyName: string;
  clients: RiskAlertClient[];
  dashboardUrl: string;
  language?: EmailLanguage;
}

export async function sendRiskAlertEmail({
  to,
  companyName,
  clients,
  dashboardUrl,
  language = 'fr',
}: RiskAlertParams) {
  const resend = getResend();
  const locale = language === 'en' ? 'en-US' : 'fr-FR';

  const urgentCount = clients.filter((c) => c.daysUntilRenewal !== null && c.daysUntilRenewal <= 14).length;
  const subject = language === 'en'
    ? (urgentCount > 0
      ? `${urgentCount} at-risk customer${urgentCount > 1 ? 's' : ''} before their renewal`
      : `${clients.length} customer${clients.length > 1 ? 's' : ''} at risk of leaving soon`)
    : (urgentCount > 0
      ? `${urgentCount} client${urgentCount > 1 ? 's' : ''} à risque avant leur renouvellement`
      : `${clients.length} client${clients.length > 1 ? 's' : ''} à risque de partir bientôt`);

  const rowsHtml = clients.map((c) => {
    const renewalText = c.daysUntilRenewal === null
      ? ''
      : language === 'en'
        ? (c.daysUntilRenewal <= 0
          ? '<br><span style="color: #dc2626; font-weight: 600;">Renewal date passed</span>'
          : c.daysUntilRenewal <= 14
            ? `<br><span style="color: #dc2626; font-weight: 600;">Renews in ${c.daysUntilRenewal} day${c.daysUntilRenewal > 1 ? 's' : ''}</span>`
            : `<br><span style="color: #6b7280;">Renews in ${c.daysUntilRenewal} days</span>`)
        : (c.daysUntilRenewal <= 0
          ? '<br><span style="color: #dc2626; font-weight: 600;">Renouvellement dépassé</span>'
          : c.daysUntilRenewal <= 14
            ? `<br><span style="color: #dc2626; font-weight: 600;">Renouvellement dans ${c.daysUntilRenewal} jour${c.daysUntilRenewal > 1 ? 's' : ''}</span>`
            : `<br><span style="color: #6b7280;">Renouvellement dans ${c.daysUntilRenewal} jours</span>`);

    const riskLabel = language === 'en' ? 'risk' : 'de risque';
    const threatenedLabel = language === 'en' ? '/mo at stake' : '/mois menacé';

    return `
      <div style="margin-bottom: 12px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: baseline;">
          <strong>${c.name}</strong>
          <span style="color: #dc2626; font-weight: 600;">${c.churnScore}% ${riskLabel}</span>
        </div>
        <p style="margin: 6px 0 0; font-size: 14px; color: #374151;">${c.reason}</p>
        <p style="margin: 4px 0 0; font-size: 13px;">€${c.revenueMonthly.toLocaleString(locale)}${threatenedLabel}${renewalText}</p>
      </div>
    `;
  }).join('');

  const html = language === 'en' ? `
    <div style="font-family: Inter, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">
      <h2 style="font-weight: 600;">${subject}</h2>
      <p>Hi ${companyName || ''},</p>
      <p>Churnly detected ${clients.length > 1 ? 'customers' : 'a customer'} with a high churn risk:</p>
      <div style="margin: 24px 0;">
        ${rowsHtml}
      </div>
      <p style="margin-top: 24px;">
        <a href="${dashboardUrl}" style="background: #2148ec; color: white; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 500;">
          See details and act
        </a>
      </p>
    </div>
  ` : `
    <div style="font-family: Inter, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">
      <h2 style="font-weight: 600;">${subject}</h2>
      <p>Salut ${companyName || ''},</p>
      <p>Churnly a détecté ${clients.length > 1 ? 'des clients' : 'un client'} avec un risque de churn élevé :</p>
      <div style="margin: 24px 0;">
        ${rowsHtml}
      </div>
      <p style="margin-top: 24px;">
        <a href="${dashboardUrl}" style="background: #2148ec; color: white; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 500;">
          Voir les détails et agir
        </a>
      </p>
    </div>
  `;

  return resend.emails.send({
    from: process.env.EMAIL_FROM || 'Churnly <alerts@yourdomain.com>',
    to,
    subject,
    html,
  });
}

export async function sendWeeklyReportEmail({
  to,
  companyName,
  clientsSaved,
  revenueSaved,
  roiPercent,
  churnRateNow,
  churnRateBefore,
  dashboardUrl,
  language = 'fr',
}: WeeklyReportParams) {
  const resend = getResend();
  const locale = language === 'en' ? 'en-US' : 'fr-FR';
  const subject = language === 'en' ? 'Your Churnly report this week' : 'Votre bilan Churnly cette semaine';

  const html = language === 'en' ? `
    <div style="font-family: Inter, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">
      <h2 style="font-weight: 600;">${subject}</h2>
      <p>Hi ${companyName},</p>
      <p>Here's how this week went:</p>
      <ul style="line-height: 1.8;">
        <li>✓ Customers saved: <strong>${clientsSaved}</strong></li>
        <li>✓ Revenue saved: <strong>€${revenueSaved.toLocaleString(locale)}</strong></li>
        <li>✓ ROI this week: <strong>${roiPercent}%</strong></li>
      </ul>
      <p>Current churn rate: <strong>${churnRateNow}%</strong> (vs ${churnRateBefore}% last week)</p>
      <p style="margin-top: 24px;">
        <a href="${dashboardUrl}" style="background: #2148ec; color: white; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 500;">
          See my dashboard
        </a>
      </p>
    </div>
  ` : `
    <div style="font-family: Inter, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">
      <h2 style="font-weight: 600;">${subject}</h2>
      <p>Salut ${companyName},</p>
      <p>Cette semaine, voici vos résultats :</p>
      <ul style="line-height: 1.8;">
        <li>✓ Clients sauvés : <strong>${clientsSaved}</strong></li>
        <li>✓ Revenu sauvé : <strong>€${revenueSaved.toLocaleString(locale)}</strong></li>
        <li>✓ ROI cette semaine : <strong>${roiPercent}%</strong></li>
      </ul>
      <p>Taux de churn actuel : <strong>${churnRateNow}%</strong> (vs ${churnRateBefore}% semaine passée)</p>
      <p style="margin-top: 24px;">
        <a href="${dashboardUrl}" style="background: #2148ec; color: white; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 500;">
          Voir mon dashboard
        </a>
      </p>
    </div>
  `;

  return resend.emails.send({
    from: process.env.EMAIL_FROM || 'Churnly <reports@yourdomain.com>',
    to,
    subject,
    html,
  });
}

interface TeamInviteParams {
  to: string;
  inviterCompanyName: string;
  acceptUrl: string;
  language?: EmailLanguage;
}

interface ReferralRewardParams {
  to: string;
  companyName: string;
  language?: EmailLanguage;
}

export async function sendReferralRewardEmail({ to, companyName, language = 'fr' }: ReferralRewardParams) {
  const resend = getResend();
  const subject = language === 'en'
    ? 'Your next month of Churnly is free 🎉'
    : 'Votre prochain mois Churnly est gratuit 🎉';

  const html = language === 'en' ? `
    <div style="font-family: Inter, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">
      <h2 style="font-weight: 600;">${subject}</h2>
      <p>Hi ${companyName}, someone just signed up through your referral link and became a paying customer.</p>
      <p>As a thank you, your next invoice is fully covered — it's applied automatically, nothing to do on your end.</p>
      <p style="margin-top: 16px; font-size: 14px; color: #6b7280;">Keep sharing your link from Settings to earn another free month.</p>
    </div>
  ` : `
    <div style="font-family: Inter, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">
      <h2 style="font-weight: 600;">${subject}</h2>
      <p>Bonjour ${companyName}, une personne vient de s'inscrire via votre lien de parrainage et est devenue cliente payante.</p>
      <p>Pour vous remercier, votre prochaine facture est entièrement offerte — c'est appliqué automatiquement, rien à faire de votre côté.</p>
      <p style="margin-top: 16px; font-size: 14px; color: #6b7280;">Continuez à partager votre lien depuis les Réglages pour gagner un autre mois offert.</p>
    </div>
  `;

  return resend.emails.send({
    from: process.env.EMAIL_FROM || 'Churnly <notifications@yourdomain.com>',
    to,
    subject,
    html,
  });
}

interface CallBookingReceivedParams {
  to: string;
  name: string;
  language?: EmailLanguage;
}

export async function sendCallBookingReceivedEmail({ to, name, language = 'fr' }: CallBookingReceivedParams) {
  const resend = getResend();
  const subject = language === 'en' ? 'Your call request — Churnly' : 'Votre demande de call — Churnly';

  const html = language === 'en' ? `
    <div style="font-family: Inter, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">
      <h2 style="font-weight: 600;">${subject}</h2>
      <p>Hi ${name},</p>
      <p>We've got your request and your availability. We'll get back to you by email very soon to confirm the exact time slot.</p>
      <p style="margin-top: 16px; font-size: 14px; color: #6b7280;">No need to do anything else for now.</p>
    </div>
  ` : `
    <div style="font-family: Inter, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">
      <h2 style="font-weight: 600;">${subject}</h2>
      <p>Bonjour ${name},</p>
      <p>On a bien reçu votre demande et vos disponibilités. On revient vers vous par email très vite pour confirmer le créneau exact.</p>
      <p style="margin-top: 16px; font-size: 14px; color: #6b7280;">Rien d'autre à faire pour l'instant.</p>
    </div>
  `;

  return resend.emails.send({
    from: process.env.EMAIL_FROM || 'Churnly <notifications@yourdomain.com>',
    to,
    subject,
    html,
  });
}

interface CallBookingConfirmedParams {
  to: string;
  name: string;
  confirmedSlot: string;
  language?: EmailLanguage;
}

export async function sendCallBookingConfirmedEmail({ to, name, confirmedSlot, language = 'fr' }: CallBookingConfirmedParams) {
  const resend = getResend();
  const subject = language === 'en' ? 'Your call is confirmed — Churnly' : 'Votre call est confirmé — Churnly';

  const html = language === 'en' ? `
    <div style="font-family: Inter, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">
      <h2 style="font-weight: 600;">${subject}</h2>
      <p>Hi ${name},</p>
      <p>Your call with Churnly is confirmed for:</p>
      <p style="margin: 20px 0; padding: 16px; border: 1px solid #e5e7eb; border-radius: 12px; font-weight: 600; font-size: 16px;">${confirmedSlot}</p>
      <p>See you then. If this time no longer works, just reply to this email.</p>
    </div>
  ` : `
    <div style="font-family: Inter, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">
      <h2 style="font-weight: 600;">${subject}</h2>
      <p>Bonjour ${name},</p>
      <p>Votre call avec Churnly est confirmé pour :</p>
      <p style="margin: 20px 0; padding: 16px; border: 1px solid #e5e7eb; border-radius: 12px; font-weight: 600; font-size: 16px;">${confirmedSlot}</p>
      <p>À bientôt. Si ce créneau ne convient plus, répondez simplement à cet email.</p>
    </div>
  `;

  return resend.emails.send({
    from: process.env.EMAIL_FROM || 'Churnly <notifications@yourdomain.com>',
    to,
    subject,
    html,
  });
}

interface CallBookingAdminNotifyParams {
  to: string;
  name: string;
  email: string;
  companyName: string | null;
  availability: string;
  adminUrl: string;
}

export async function sendCallBookingAdminNotifyEmail({ to, name, email, companyName, availability, adminUrl }: CallBookingAdminNotifyParams) {
  const resend = getResend();
  const subject = `Nouvelle demande de call — ${name}`;

  const html = `
    <div style="font-family: Inter, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">
      <h2 style="font-weight: 600;">${subject}</h2>
      <p><strong>${name}</strong>${companyName ? ` (${companyName})` : ''} — ${email}</p>
      <p style="margin: 16px 0; padding: 16px; border: 1px solid #e5e7eb; border-radius: 12px; white-space: pre-line;">${availability.replace(/\n/g, '<br>')}</p>
      <p style="margin-top: 24px;">
        <a href="${adminUrl}" style="background: #d97706; color: white; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 500;">
          Confirmer un créneau
        </a>
      </p>
    </div>
  `;

  return resend.emails.send({
    from: process.env.EMAIL_FROM || 'Churnly <notifications@yourdomain.com>',
    to,
    subject,
    html,
  });
}

export async function sendTeamInviteEmail({ to, inviterCompanyName, acceptUrl, language = 'fr' }: TeamInviteParams) {
  const resend = getResend();
  const subject = language === 'en'
    ? `${inviterCompanyName} invited you to their Churnly dashboard`
    : `${inviterCompanyName} vous invite sur son dashboard Churnly`;

  const html = language === 'en' ? `
    <div style="font-family: Inter, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">
      <h2 style="font-weight: 600;">${subject}</h2>
      <p>You've been invited to view and act on ${inviterCompanyName}'s Churnly dashboard — no separate signup form needed, just click below.</p>
      <p style="margin-top: 24px;">
        <a href="${acceptUrl}" style="background: #2148ec; color: white; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 500;">
          Accept invitation
        </a>
      </p>
      <p style="margin-top: 16px; font-size: 14px; color: #6b7280;">This link expires in 7 days. If you weren't expecting this, you can ignore this email.</p>
    </div>
  ` : `
    <div style="font-family: Inter, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">
      <h2 style="font-weight: 600;">${subject}</h2>
      <p>Vous avez été invité(e) à consulter et agir sur le dashboard Churnly de ${inviterCompanyName} — pas de formulaire d'inscription à remplir, il suffit de cliquer ci-dessous.</p>
      <p style="margin-top: 24px;">
        <a href="${acceptUrl}" style="background: #2148ec; color: white; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 500;">
          Accepter l'invitation
        </a>
      </p>
      <p style="margin-top: 16px; font-size: 14px; color: #6b7280;">Ce lien expire dans 7 jours. Si vous ne vous attendiez pas à cet email, vous pouvez l'ignorer.</p>
    </div>
  `;

  return resend.emails.send({
    from: process.env.EMAIL_FROM || 'Churnly <notifications@yourdomain.com>',
    to,
    subject,
    html,
  });
}
