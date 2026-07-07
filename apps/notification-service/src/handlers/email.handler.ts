import nodemailer from 'nodemailer'
import { getTransporter, isDevMailer } from '../config/mailer';
import logger from '../config/logger';

const verificationEmailTemplate = (username: string, verificationUrl: string): string => {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Verify — TALKIE</title>
</head>
<body style="margin:0;padding:0;background-color:#050505;font-family:'Arial Black',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#050505;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#050505;border:1px solid #1c1c1c;">

          <!-- TOP BAR -->
          <tr>
            <td style="background-color:#ff4d00;padding:10px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size:10px;font-weight:900;color:#050505;letter-spacing:6px;text-transform:uppercase;">TALKIE / SECURE SYSTEM</span>
                  </td>
                  <td align="right">
                    <span style="font-size:10px;color:#050505;letter-spacing:3px;">2026</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- HERO BLOCK -->
          <tr>
            <td style="padding:48px 32px 0;border-bottom:1px solid #1c1c1c;">

              <!-- Label -->
              <p style="margin:0 0 20px;font-size:10px;letter-spacing:6px;color:#ff4d00;text-transform:uppercase;font-weight:700;">
                ◆ &nbsp;EMAIL VERIFICATION REQUIRED
              </p>

              <!-- Giant headline -->
              <h1 style="margin:0;font-size:56px;font-weight:900;color:#ffffff;line-height:0.95;letter-spacing:-1px;text-transform:uppercase;">
                VERIFY<br/>
                <span style="color:#ff4d00;">YOUR</span><br/>
                IDENTITY
              </h1>

              <!-- Mirror/echo effect via opacity -->
              <h1 aria-hidden="true" style="margin:0;font-size:56px;font-weight:900;color:#ffffff;line-height:0.95;letter-spacing:-1px;text-transform:uppercase;opacity:0.07;transform:scaleY(-1);display:block;margin-top:2px;">
                VERIFY<br/>
                YOUR<br/>
                IDENTITY
              </h1>

              <!-- Divider line -->
              <div style="margin:28px 0 0;height:1px;background-color:#1c1c1c;"></div>

            </td>
          </tr>

          <!-- BODY COPY -->
          <tr>
            <td style="padding:36px 32px;">

              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <!-- Left col: text -->
                  <td width="60%" style="vertical-align:top;padding-right:24px;">
                    <p style="margin:0 0 8px;font-size:10px;letter-spacing:4px;color:#444444;text-transform:uppercase;">/ INSTRUCTIONS</p>
                    <p style="margin:0;font-size:14px;color:#888888;line-height:1.8;">
                      Your account has been created. Confirm your email to unlock
                      full access to real-time messaging and collaboration.
                    </p>
                  </td>
                  <!-- Right col: stat block -->
                  <td width="40%" style="vertical-align:top;">
                    <div style="border:1px solid #1c1c1c;padding:16px;background-color:#0a0a0a;">
                      <p style="margin:0 0 4px;font-size:9px;letter-spacing:4px;color:#444444;text-transform:uppercase;">EXPIRES IN</p>
                      <p style="margin:0;font-size:32px;font-weight:900;color:#ff4d00;line-height:1;">24H</p>
                      <p style="margin:6px 0 0;font-size:9px;letter-spacing:3px;color:#333333;text-transform:uppercase;">ONE-TIME USE</p>
                    </div>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- CTA BLOCK -->
          <tr>
            <td style="padding:0 32px 36px;">

              <!-- Big CTA button -->
              <a href="{{verificationUrl}}"
                 style="display:block;background-color:#ff4d00;color:#050505;font-size:13px;font-weight:900;text-decoration:none;padding:20px 32px;letter-spacing:4px;text-transform:uppercase;text-align:center;">
                ▶ &nbsp;ACTIVATE ACCOUNT
              </a>

              <!-- Security notice -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
                <tr>
                  <td style="border-left:2px solid #ff4d00;padding:12px 16px;background-color:#0d0d0d;">
                    <p style="margin:0;font-size:11px;color:#555555;line-height:1.7;letter-spacing:0.5px;">
                      If you did not create a Talkie account, disregard this message.
                      Your security is not at risk.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- MANUAL LINK -->
          <tr>
            <td style="padding:24px 32px;border-top:1px solid #1c1c1c;border-bottom:1px solid #1c1c1c;background-color:#080808;">
              <p style="margin:0 0 8px;font-size:9px;letter-spacing:4px;color:#333333;text-transform:uppercase;">/ MANUAL LINK</p>
              <p style="margin:0;font-size:11px;color:#444444;word-break:break-all;line-height:1.7;">
                <a href="{{verificationUrl}}" style="color:#ff4d00;text-decoration:none;">{{verificationUrl}}</a>
              </p>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="padding:20px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0;font-size:9px;letter-spacing:3px;color:#2a2a2a;text-transform:uppercase;line-height:1.8;">
                      © 2026 TALKIE SYSTEMS<br/>
                      AUTOMATED MESSAGE — DO NOT REPLY
                    </p>
                  </td>
                  <td align="right" style="vertical-align:bottom;">
                    <span style="font-size:28px;font-weight:900;color:#1a1a1a;letter-spacing:-1px;">TALKIE</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- BOTTOM ACCENT -->
          <tr>
            <td style="background-color:#ff4d00;height:3px;font-size:0;">&nbsp;</td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`
        .replace(/{{verificationUrl}}/g, verificationUrl);
};

export const sendVerificationMail = async (
    email: string,
    verificationUrl: string
): Promise<void> => {
    logger.info('Sending verification email', { to: email });
    const transporter = getTransporter();
    const html = verificationEmailTemplate(email, verificationUrl);

    try {
        const info = await transporter.sendMail({
            from: '"Talkie" <no-reply@talkie.app>',
            to: email,
            subject: 'Verify your Talkie account',
            html,
        });

        // Log preview URL for Ethereal dev mails, or just log messageId for real sends
        if (isDevMailer()) {
            const previewUrl = nodemailer.getTestMessageUrl(info)
            logger.info('Verification email sent (Ethereal preview)', { to: email, previewUrl })
        } else {
            logger.info('Verification email sent', { to: email, messageId: info.messageId })
        }
    } catch (err: any) {
        logger.error('Failed to send verification email', { to: email, error: err.message });
        throw err;
    }
};
