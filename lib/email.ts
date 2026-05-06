import nodemailer from 'nodemailer'

// Konfigurera e-posttransport
// För produktion bör dessa värden sättas via miljövariabler
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // true för 465, false för andra portar
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
})

export async function sendPasswordResetEmail(email: string, resetLink: string, userName: string) {
  try {
    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@timelaps.se',
      to: email,
      subject: 'Återställ ditt lösenord - TimeLaps',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f9f9f9;
            }
            .content {
              background-color: white;
              padding: 30px;
              border-radius: 5px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .button {
              display: inline-block;
              padding: 12px 24px;
              background-color: #2D5016;
              color: white;
              text-decoration: none;
              border-radius: 5px;
              margin: 20px 0;
            }
            .footer {
              margin-top: 20px;
              padding-top: 20px;
              border-top: 1px solid #eee;
              font-size: 12px;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="content">
              <h1 style="color: #2D5016;">Återställ ditt lösenord</h1>
              <p>Hej ${userName},</p>
              <p>Du har begärt att återställa ditt lösenord för ditt TimeLaps-konto.</p>
              <p>Klicka på knappen nedan för att skapa ett nytt lösenord:</p>
              <a href="${resetLink}" class="button">Återställ lösenord</a>
              <p>Eller kopiera och klistra in denna länk i din webbläsare:</p>
              <p style="word-break: break-all; color: #666;">${resetLink}</p>
              <p><strong>Denna länk är giltig i 1 timme.</strong></p>
              <p>Om du inte begärt att återställa ditt lösenord kan du ignorera detta e-postmeddelande.</p>
              <div class="footer">
                <p>Detta är ett automatiskt e-postmeddelande från TimeLaps. Svara inte på detta meddelande.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Hej ${userName},
        
        Du har begärt att återställa ditt lösenord för ditt TimeLaps-konto.
        
        Klicka på denna länk för att skapa ett nytt lösenord:
        ${resetLink}
        
        Denna länk är giltig i 1 timme.
        
        Om du inte begärt att återställa ditt lösenord kan du ignorera detta e-postmeddelande.
      `,
    }

    await transporter.sendMail(mailOptions)
    return true
  } catch (error) {
    console.error('Fel vid skickande av e-post:', error)
    return false
  }
}

export async function sendSetPasswordEmail(email: string, resetLink: string, userName: string, createdByName: string) {
  try {
    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@timelaps.se',
      to: email,
      subject: 'Välkommen till TimeLaps - skapa ditt lösenord',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; }
            .content { background-color: white; padding: 30px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .button { display: inline-block; padding: 12px 24px; background-color: #2D5016; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="content">
              <h1 style="color: #2D5016;">Välkommen till TimeLaps</h1>
              <p>Hej ${userName},</p>
              <p>${createdByName} har skapat ett konto åt dig i TimeLaps.</p>
              <p>Klicka på knappen nedan för att skapa ditt lösenord:</p>
              <a href="${resetLink}" class="button">Skapa lösenord</a>
              <p>Eller kopiera och klistra in denna länk i din webbläsare:</p>
              <p style="word-break: break-all; color: #666;">${resetLink}</p>
              <p><strong>Länken är giltig i 7 dagar.</strong></p>
              <div class="footer">
                <p>Detta är ett automatiskt e-postmeddelande från TimeLaps. Svara inte på detta meddelande.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Hej ${userName},
        
        ${createdByName} har skapat ett konto åt dig i TimeLaps.
        
        Skapa ditt lösenord här:
        ${resetLink}
        
        Länken är giltig i 7 dagar.
      `,
    }

    await transporter.sendMail(mailOptions)
    return true
  } catch (error) {
    console.error('Fel vid skickande av e-post:', error)
    return false
  }
}

export async function sendTimeReportBundleEmail(options: {
  to: string
  subject: string
  companyName: string
  reportCount: number
  personalMessageHtml: string
  zipBuffer: Buffer
  zipFileName: string
  senderDisplayName: string
}): Promise<boolean> {
  try {
    const intro = `
        <p>Hej,</p>
        <p>Här bifogas <strong>${options.reportCount}</strong> tidrapport${
          options.reportCount === 1 ? '' : 'er'
        } från <strong>${escapeHtml(options.companyName)}</strong>.</p>`
    const optionalMsg =
      options.personalMessageHtml.trim().length > 0
        ? `<div style="margin:18px 0;padding:14px;background:#f4f9f4;border-radius:6px;">
            ${options.personalMessageHtml}
           </div>`
        : ''

    const html = `
      <!DOCTYPE html>
      <html lang="sv">
      <head><meta charset="UTF-8" /></head>
      <body style="font-family:Arial,sans-serif;line-height:1.55;color:#333;">
        ${intro}
        ${optionalMsg}
        <p style="color:#666;font-size:14px;">
          Vid frågor, vänligen återkoppla till oss.
        </p>
        <p style="color:#888;font-size:12px;margin-top:28px;">
          Meddelandet skickades av ${escapeHtml(options.senderDisplayName)} via TimeLaps.
        </p>
      </body>
      </html>
    `.trim()

    const textParts = [
      'Hej,',
      '',
      `Bifogat: ${options.reportCount} tidrapport${options.reportCount === 1 ? '' : 'er'} från ${options.companyName}.`,
    ]
    if (options.personalMessageHtml.trim()) {
      textParts.push('', stripBasicHtml(options.personalMessageHtml))
    }
    textParts.push('', 'Med vänliga hälsningar', `- ${options.senderDisplayName}`, '', '(ZIP-filen finns som bilaga)')
    const textBody = textParts.join('\n')

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@timelaps.se',
      to: options.to,
      subject: options.subject,
      html,
      text: textBody,
      attachments: [
        {
          filename: options.zipFileName,
          content: options.zipBuffer,
          contentType: 'application/zip',
        },
      ],
    })

    return true
  } catch (error) {
    console.error('Fel vid skickande av tidrapportpaket:', error)
    return false
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function stripBasicHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .trim()
}

