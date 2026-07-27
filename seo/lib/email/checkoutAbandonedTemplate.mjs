// Inlined checkout-abandoned email HTML. Was `fs.readFileSync('checkout-abandoned.html')`, which ENOENT'd on
// Vercel (Next.js doesn't bundle non-imported files into the serverless function), so the abandon email never
// sent in prod. As an imported module it's bundled. Same {{placeholders}} filled by send.mjs — keep in sync
// with checkout-abandoned.html if edited.
export const CHECKOUT_ABANDONED_HTML = `<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">You were one step away — your report is ready to unlock.</span>
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f4f6f8;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;width:100%;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 10px rgba(17,24,39,0.08);">
        <tr><td style="background:#0d5d2f;padding:22px 32px;">
          <span style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:-0.3px;">{{brandName}}</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 14px;color:#0f172a;font-size:22px;line-height:1.3;">{{headline}}</h1>
          <p style="margin:0 0 18px;color:#374151;font-size:15px;line-height:1.6;">
            Hi {{firstName}}, {{bodyIntro}}
          </p>
          {{targetCard}}
          <table cellpadding="0" cellspacing="0" role="presentation" style="margin:8px 0 22px;">
            <tr><td align="center" style="border-radius:10px;background:#16a34a;">
              <a href="{{unlockUrl}}" style="display:inline-block;padding:15px 34px;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;border-radius:10px;">{{ctaLabel}}</a>
            </td></tr>
          </table>
          <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 6px;">
            <tr><td style="color:#475569;font-size:13px;line-height:1.7;">
              🔒 Secure checkout &nbsp;·&nbsp; ✓ Cancel anytime &nbsp;·&nbsp; ⚡ Instant access
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:18px 32px 26px;border-top:1px solid #eef2f0;">
          <p style="margin:0 0 8px;color:#94a3b8;font-size:11px;line-height:1.6;">
            {{brandName}} is not a consumer reporting agency under the Fair Credit Reporting Act (FCRA). Do not use for employment, tenant screening, credit, or any FCRA-regulated purpose.
          </p>
          <p style="margin:0;color:#94a3b8;font-size:11px;">
            <a href="{{unsubscribeUrl}}" style="color:#94a3b8;">Unsubscribe</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>`;
