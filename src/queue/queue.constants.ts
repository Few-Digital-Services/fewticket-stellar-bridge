const queueEnvPrefix = String(process.env.APP_ENV || 'development')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9_-]+/g, '-');

export const MailQueue = {
  name: `${queueEnvPrefix}-mail-queue`,
};

export const IncomingTransactionQueue = {
  name: `${queueEnvPrefix}-incoming-transaction-queue`,
};

export const IncomingTransactionJob = {
  stellarPaymentDetected: 'stellar-payment-detected',
};

export const WebhookQueue = {
  name: `${queueEnvPrefix}-webhook-queue`,
};

export const WebhookJob = {
  send: 'send-webhook',
};
