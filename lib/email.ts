import { Resend } from 'resend';

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
}

interface WelcomeEmailParams {
  to: string;
  companyName: string;
  monthlyPrice: number;
  appUrl: string;
}

export async function sendWelcomeEmail({
  to,
  companyName,
  monthlyPrice,
  appUrl,
}: WelcomeEmailParams) {
  const resend = getResend();

  const offer1 = Math.round(monthlyPrice * 0.1);
  const offer2 = Math.round(monthlyPrice * 0.2);
  const offer3 = monthlyPrice;
  const offer5 = Math.round(monthlyPrice * 0.13);

  const expiryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
  });

  const html = `
    <div style="font-family: Inter, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">
      <h2 style="font-weight: 600;">Cadeau de bienvenue : choisissez votre offre</h2>
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
    subject: 'Cadeau de bienvenue : choisissez votre offre',
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
}: WeeklyReportParams) {
  const resend = getResend();

  const html = `
    <div style="font-family: Inter, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">
      <h2 style="font-weight: 600;">Votre bilan Churnly cette semaine</h2>
      <p>Salut ${companyName},</p>
      <p>Cette semaine, voici vos résultats :</p>
      <ul style="line-height: 1.8;">
        <li>✓ Clients sauvés : <strong>${clientsSaved}</strong></li>
        <li>✓ Revenue sauvée : <strong>€${revenueSaved.toLocaleString('fr-FR')}</strong></li>
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
    subject: 'Votre bilan Churnly cette semaine',
    html,
  });
}
