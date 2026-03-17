// server/providers/ses.js
// AWS SES provider via @aws-sdk/client-ses.
// Env vars: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, EMAIL_FROM, EMAIL_FROM_NAME
// Optional: AWS_SES_CONFIGURATION_SET (for open/click tracking)

let SESClient, SendEmailCommand;
try {
  ({ SESClient, SendEmailCommand } = require('@aws-sdk/client-ses'));
  console.log('[email] Provider: AWS SES');
} catch (e) {
  throw new Error('[email] SES selected but @aws-sdk/client-ses is not installed. Run: npm run install-server');
}

const client = new SESClient({ region: process.env.AWS_REGION || 'us-east-1' });

const FROM = process.env.EMAIL_FROM || 'noreply@idlookup.com';
const FROM_NAME = process.env.EMAIL_FROM_NAME || 'IDLookup';
const CONFIG_SET = process.env.AWS_SES_CONFIGURATION_SET;

async function send({ to, subject, html }) {
  const params = {
    Source: `${FROM_NAME} <${FROM}>`,
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body: { Html: { Data: html, Charset: 'UTF-8' } },
    },
    ...(CONFIG_SET && { ConfigurationSetName: CONFIG_SET }),
  };
  await client.send(new SendEmailCommand(params));
}

module.exports = { send };
