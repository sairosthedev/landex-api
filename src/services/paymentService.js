import config from '../config/index.js';
import {
  FeeSchedule, Invoice, Payment, PaymentWebhookEvent, ReconciliationRun, Notification,
} from '../models/index.js';
import { DEFAULT_FEE_SCHEDULE, PAYMENT_METHODS } from '../constants/index.js';
import { AppError } from '../utils/errors.js';
import { generateReference } from '../utils/referenceGenerator.js';
import { pageResponse } from '../utils/apiResponse.js';

const PURPOSE_TO_FEE_CODE = {
  LISTING: 'LISTING_PUBLISH',
  VERIFICATION: 'VERIFICATION',
  SUBSCRIPTION: 'PREMIUM_LISTING',
};

const PURPOSE_TO_REFERENCE_TYPE = {
  LISTING: 'LISTING',
  VERIFICATION: 'LISTING',
  SUBSCRIPTION: 'USER',
};

function resolveFeeCode(data) {
  if (data.feeCode) return String(data.feeCode).toUpperCase();
  if (data.purpose) return PURPOSE_TO_FEE_CODE[String(data.purpose).toUpperCase()] ?? null;
  return null;
}

function resolveReferenceType(data) {
  if (data.referenceType) return data.referenceType;
  if (data.purpose) {
    return PURPOSE_TO_REFERENCE_TYPE[String(data.purpose).toUpperCase()] ?? 'LISTING';
  }
  return 'LISTING';
}

function normalizePaymentMethod(input = {}) {
  const raw = typeof input === 'string' ? input : (input.method || input.gateway);
  const upper = String(raw || 'PAYNOW').toUpperCase();
  const aliases = {
    ECOCASH: 'PAYNOW',
    INNBUCKS: 'PAYNOW',
    CARD: 'STRIPE',
  };
  const mapped = aliases[upper] ?? upper;
  return PAYMENT_METHODS.includes(mapped) ? mapped : 'PAYNOW';
}

export async function ensureDefaultFeeSchedules() {
  for (const fee of DEFAULT_FEE_SCHEDULE) {
    await FeeSchedule.findOneAndUpdate(
      { feeCode: fee.feeCode },
      { ...fee, active: true },
      { upsert: true },
    );
  }
}

function toInvoiceResponse(inv) {
  return {
    id: inv._id.toString(),
    invoiceNumber: inv.invoiceNumber,
    payerId: inv.payerId.toString(),
    feeCode: inv.feeCode,
    amount: inv.amount,
    currency: inv.currency,
    referenceType: inv.referenceType,
    referenceId: inv.referenceId?.toString(),
    dueDate: inv.dueDate,
    status: inv.status,
    paidAt: inv.paidAt,
    createdAt: inv.createdAt,
  };
}

export async function createInvoice(userId, data) {
  await ensureDefaultFeeSchedules();

  const feeCode = resolveFeeCode(data);
  if (!feeCode) {
    throw AppError.badRequest('INVALID_FEE', 'feeCode or purpose is required');
  }

  const fee = await FeeSchedule.findOne({ feeCode, active: true });
  if (!fee) throw AppError.notFound('Fee schedule not found');

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + config.payment.invoiceDueDays);

  const invoice = await Invoice.create({
    invoiceNumber: generateReference('invoice'),
    payerId: userId,
    feeCode: fee.feeCode,
    amount: fee.amount,
    currency: fee.currency || config.payment.defaultCurrency,
    referenceType: resolveReferenceType(data),
    referenceId: data.referenceId,
    dueDate,
  });

  return toInvoiceResponse(invoice);
}

export async function getMyInvoices(userId, pagination) {
  const { page, size, skip } = pagination;
  const [items, total] = await Promise.all([
    Invoice.find({ payerId: userId }).sort({ createdAt: -1 }).skip(skip).limit(size),
    Invoice.countDocuments({ payerId: userId }),
  ]);
  return pageResponse(items.map(toInvoiceResponse), page, size, total);
}

export async function getInvoice(userId, invoiceId) {
  const invoice = await Invoice.findOne({ _id: invoiceId, payerId: userId });
  if (!invoice) throw AppError.notFound('Invoice not found');
  return toInvoiceResponse(invoice);
}

export async function initiatePayment(userId, invoiceId, input = {}) {
  const invoice = await Invoice.findOne({ _id: invoiceId, payerId: userId });
  if (!invoice) throw AppError.notFound('Invoice not found');
  if (invoice.status === 'PAID') throw AppError.badRequest('ALREADY_PAID', 'Invoice is already paid');

  const method = normalizePaymentMethod(input);

  const payment = await Payment.create({
    paymentReference: generateReference('payment'),
    invoiceId: invoice._id,
    payerId: userId,
    amount: invoice.amount,
    currency: invoice.currency,
    method,
    status: 'PENDING',
    gatewayProvider: method,
  });

  if (method === 'STRIPE' && config.payment.stripe.secretKey) {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(config.payment.stripe.secretKey);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: config.payment.stripe.successUrl,
      cancel_url: config.payment.stripe.cancelUrl,
      line_items: [{
        price_data: {
          currency: invoice.currency.toLowerCase(),
          product_data: { name: `LandEx Invoice ${invoice.invoiceNumber}` },
          unit_amount: Math.round(invoice.amount * 100),
        },
        quantity: 1,
      }],
      metadata: { paymentId: payment._id.toString(), invoiceId: invoice._id.toString() },
    });
    payment.gatewayResponse = { sessionId: session.id, url: session.url };
    await payment.save();
    return { paymentId: payment._id.toString(), redirectUrl: session.url };
  }

  payment.gatewayResponse = {
    message: 'Paynow integration — configure PAYNOW_INTEGRATION_ID and PAYNOW_INTEGRATION_KEY',
    pollUrl: `${config.payment.paynow.resultUrl}?reference=${payment.paymentReference}`,
  };
  payment.status = 'PROCESSING';
  await payment.save();
  return { paymentId: payment._id.toString(), ...payment.gatewayResponse };
}

export async function getPayment(userId, paymentId) {
  const payment = await Payment.findOne({ _id: paymentId, payerId: userId });
  if (!payment) throw AppError.notFound('Payment not found');
  return {
    id: payment._id.toString(),
    paymentReference: payment.paymentReference,
    invoiceId: payment.invoiceId.toString(),
    amount: payment.amount,
    currency: payment.currency,
    method: payment.method,
    status: payment.status,
    gatewayProvider: payment.gatewayProvider,
    initiatedAt: payment.initiatedAt,
    completedAt: payment.completedAt,
  };
}

async function completePayment(payment, externalId) {
  if (payment.status === 'COMPLETED') return;

  payment.status = 'COMPLETED';
  payment.completedAt = new Date();
  await payment.save();

  const invoice = await Invoice.findById(payment.invoiceId);
  if (invoice) {
    invoice.status = 'PAID';
    invoice.paidAt = new Date();
    await invoice.save();
  }

  await Notification.create({
    recipientId: payment.payerId,
    channel: 'IN_APP',
    subject: 'Payment received',
    body: `Your payment ${payment.paymentReference} has been completed.`,
    templateCode: 'PAYMENT_COMPLETED',
  });
}

export async function handlePaynowWebhook(body) {
  const externalId = body.reference || body.paynowreference || JSON.stringify(body);
  try {
    await PaymentWebhookEvent.create({ provider: 'PAYNOW', externalId, payload: body });
  } catch {
    return { status: 'already_processed' };
  }

  const payment = await Payment.findOne({ paymentReference: body.reference });
  if (payment && body.status?.toLowerCase() === 'paid') {
    await completePayment(payment, externalId);
  }
  return { status: 'ok' };
}

export async function handleStripeWebhook(rawBody, signature) {
  if (!config.payment.stripe.webhookSecret) {
    throw AppError.badRequest('WEBHOOK_NOT_CONFIGURED', 'Stripe webhook secret not configured');
  }
  const Stripe = (await import('stripe')).default;
  const stripe = new Stripe(config.payment.stripe.secretKey);
  const event = stripe.webhooks.constructEvent(rawBody, signature, config.payment.stripe.webhookSecret);

  try {
    await PaymentWebhookEvent.create({ provider: 'STRIPE', externalId: event.id, payload: event });
  } catch {
    return { status: 'already_processed' };
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const payment = await Payment.findById(session.metadata?.paymentId);
    if (payment) await completePayment(payment, event.id);
  }
  return { status: 'ok' };
}

export async function reconcile(adminId) {
  const run = await ReconciliationRun.create({
    runReference: generateReference('payment'),
    startedBy: adminId,
  });

  const pending = await Payment.find({ status: 'PROCESSING' });
  const completed = await Payment.find({ status: 'COMPLETED', completedAt: { $gte: new Date(Date.now() - 86400_000) } });

  run.status = 'COMPLETED';
  run.completedAt = new Date();
  run.summary = { pendingCount: pending.length, completedLast24h: completed.length };
  await run.save();

  return {
    runId: run._id.toString(),
    runReference: run.runReference,
    summary: run.summary,
  };
}

export async function getPaymentSummary() {
  const [totalInvoices, paidInvoices, totalRevenue] = await Promise.all([
    Invoice.countDocuments(),
    Invoice.countDocuments({ status: 'PAID' }),
    Invoice.aggregate([{ $match: { status: 'PAID' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
  ]);
  return {
    totalInvoices,
    paidInvoices,
    pendingInvoices: totalInvoices - paidInvoices,
    totalRevenue: totalRevenue[0]?.total || 0,
  };
}
