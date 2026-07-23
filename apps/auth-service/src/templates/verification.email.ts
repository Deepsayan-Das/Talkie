export const verificationEmailTemplate = (username: string, verificationUrl: string): string => {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Verify Identity — ANTIGRAVITY</title>
</head>
<body style="margin:0;padding:0;background-color:#080808;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#080808;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#121212;border:1px solid #27272a;border-radius:4px;overflow:hidden;">

          <!-- TOP BAR -->
          <tr>
            <td style="background-color:#18181b;padding:16px 32px;border-bottom:1px solid #27272a;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-family:monospace;font-size:11px;font-weight:700;color:#ffffff;letter-spacing:2px;">[AG] ANTIGRAVITY</span>
                  </td>
                  <td align="right">
                    <span style="font-family:monospace;font-size:10px;color:#a1a1aa;letter-spacing:2px;">SECURE SYSTEM</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- HERO BLOCK -->
          <tr>
            <td style="padding:40px 32px;border-bottom:1px solid #27272a;">

              <p style="margin:0 0 12px;font-family:monospace;font-size:10px;letter-spacing:3px;color:#a1a1aa;text-transform:uppercase;">
                [01.0 // EMAIL VERIFICATION]
              </p>

              <h1 style="margin:0 0 16px;font-size:32px;font-weight:800;color:#ffffff;line-height:1.15;letter-spacing:-0.5px;">
                Verify Your Identity
              </h1>

              <p style="margin:0;font-size:14px;color:#a1a1aa;line-height:1.7;">
                Hello <strong style="color:#ffffff;">${username}</strong> — your account registration requires email verification before accessing end-to-end encrypted messaging.
              </p>

            </td>
          </tr>

          <!-- CTA BLOCK -->
          <tr>
            <td style="padding:32px;">

              <a href="${verificationUrl}"
                 style="display:block;background-color:#ffffff;color:#000000;font-family:sans-serif;font-size:13px;font-weight:700;text-decoration:none;padding:16px 24px;letter-spacing:2px;text-transform:uppercase;text-align:center;border-radius:2px;">
                VERIFY EMAIL ADDRESS →
              </a>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
                <tr>
                  <td style="border-left:2px solid #3f3f46;padding:12px 16px;background-color:#18181b;">
                    <p style="margin:0;font-family:monospace;font-size:11px;color:#a1a1aa;line-height:1.6;">
                      This link will expire in 24 hours. If you did not initialize this request, no action is required.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- MANUAL LINK -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #27272a;background-color:#0d0d0d;">
              <p style="margin:0 0 6px;font-family:monospace;font-size:10px;letter-spacing:2px;color:#52525b;text-transform:uppercase;">DIRECT URL</p>
              <p style="margin:0;font-family:monospace;font-size:11px;color:#a1a1aa;word-break:break-all;line-height:1.6;">
                <a href="${verificationUrl}" style="color:#ffffff;text-decoration:underline;">${verificationUrl}</a>
              </p>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="padding:20px 32px;background-color:#121212;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0;font-family:monospace;font-size:10px;letter-spacing:1px;color:#52525b;">
                      © 2026 ANTIGRAVITY COMMUNICATIONS
                    </p>
                  </td>
                  <td align="right">
                    <span style="font-family:monospace;font-size:10px;color:#52525b;">E2EE ACTIVE</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`
}