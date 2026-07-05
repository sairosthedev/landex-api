#!/usr/bin/env node
/**
 * LandEx MERN API smoke test — exercises core public and authenticated flows.
 * Usage: node scripts/smoke-test/smoke-test.js [baseUrl]
 */

const BASE = process.argv[2] || process.env.SMOKE_BASE_URL || 'http://localhost:8080';
const PASSWORD = 'SmokeTest123!';
const RUN_ID = Date.now();

const results = [];

function record(method, path, status, outcome, note = '') {
  results.push({ method, path, status, outcome, note });
  const icon = outcome === 'PASS' ? '✓' : outcome === 'EXPECTED' ? '~' : outcome === 'SKIP' ? '-' : '✗';
  console.log(`${icon} ${method} ${path} → ${status ?? '—'} [${outcome}]${note ? ` — ${note}` : ''}`);
}

async function req(method, path, { token, body, formData, expectStatus } = {}) {
  const url = `${BASE}${path}`;
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !formData) headers['Content-Type'] = 'application/json';

  const options = { method, headers };
  if (body && !formData) options.body = JSON.stringify(body);
  if (formData) options.body = formData;

  const res = await fetch(url, options);
  let data;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text.slice(0, 200) };
  }
  return { status: res.status, data };
}

function assertStatus(method, path, actual, expected, note = '') {
  const outcome = actual === expected ? 'PASS' : 'FAIL';
  record(method, path, actual, outcome, note);
  return outcome === 'PASS';
}

const ctx = {
  tokens: {},
  listingId: null,
  enquiryId: null,
  invoiceId: null,
  notificationId: null,
};

async function registerAndLogin(role, suffix) {
  const email = `smoke_${role.toLowerCase()}_${RUN_ID}_${suffix}@test.landex.local`;
  const payload = {
    email,
    password: PASSWORD,
    phoneNumber: `+26377${String(RUN_ID).slice(-7)}${suffix}`,
    firstName: 'Smoke',
    lastName: role,
    nationalId: `63-${RUN_ID}${suffix}A`,
    dateOfBirth: '1990-01-15',
    role,
  };

  let res = await req('POST', '/api/v1/auth/register', { body: payload });
  if (res.status !== 201 && res.status !== 200) {
    record('POST', '/api/v1/auth/register', res.status, 'FAIL', `${role}: ${res.data?.message || ''}`);
    return null;
  }
  record('POST', '/api/v1/auth/register', res.status, 'PASS', role);

  res = await req('POST', '/api/v1/auth/login', { body: { email, password: PASSWORD } });
  if (res.status !== 200 || !res.data?.data?.accessToken) {
    record('POST', '/api/v1/auth/login', res.status, 'FAIL', role);
    return null;
  }
  record('POST', '/api/v1/auth/login', res.status, 'PASS', role);
  return { token: res.data.data.accessToken, email, userId: res.data.data.userId };
}

async function run() {
  console.log(`\nLandEx MERN smoke test → ${BASE}\n`);

  // Health
  let res = await req('GET', '/health');
  assertStatus('GET', '/health', res.status, 200);
  if (res.status !== 200) {
    console.error('\nServer not reachable. Start with: npm run dev\n');
    process.exit(1);
  }

  // Public endpoints
  res = await req('GET', '/api/v1/listings');
  assertStatus('GET', '/api/v1/listings', res.status, 200);

  res = await req('GET', '/api/v1/professionals');
  assertStatus('GET', '/api/v1/professionals', res.status, 200);

  res = await req('POST', '/api/v1/complaints', {
    body: {
      subject: 'Smoke test complaint',
      category: 'OTHER',
      description: 'Automated smoke test',
      reporterEmail: `reporter_${RUN_ID}@test.com`,
    },
  });
  assertStatus('POST', '/api/v1/complaints', res.status, 201);

  res = await req('POST', '/api/v1/contact/inquiries', {
    body: {
      name: 'Smoke Tester',
      email: `contact_${RUN_ID}@test.com`,
      message: 'Smoke test inquiry',
    },
  });
  assertStatus('POST', '/api/v1/contact/inquiries', res.status, 201);

  // Auth flows
  res = await req('POST', '/api/v1/auth/forgot-password', { body: { email: 'nobody@test.com' } });
  assertStatus('POST', '/api/v1/auth/forgot-password', res.status, 200);

  const seller = await registerAndLogin('SELLER', '1');
  const buyer = await registerAndLogin('BUYER', '2');
  if (!seller || !buyer) {
    console.error('\nAuth setup failed — cannot continue.\n');
    printSummary();
    process.exit(1);
  }
  ctx.tokens.seller = seller.token;
  ctx.tokens.buyer = buyer.token;

  // User profile
  res = await req('GET', '/api/v1/users/me', { token: seller.token });
  assertStatus('GET', '/api/v1/users/me', res.status, 200);

  res = await req('PUT', '/api/v1/users/me', {
    token: seller.token,
    body: { firstName: 'SmokeUpdated' },
  });
  assertStatus('PUT', '/api/v1/users/me', res.status, 200);

  res = await req('GET', '/api/v1/users/me/verification-status', { token: seller.token });
  assertStatus('GET', '/api/v1/users/me/verification-status', res.status, 200);

  // Listings (seller)
  res = await req('POST', '/api/v1/listings', {
    token: seller.token,
    body: {
      title: `Smoke Stand ${RUN_ID}`,
      description: 'Automated smoke test listing',
      listingType: 'SALE',
      propertyType: 'RESIDENTIAL_STAND',
      tenureType: 'FREEHOLD',
      province: 'Harare',
      district: 'Borrowdale',
      price: 75000,
      currency: 'USD',
    },
  });
  if (assertStatus('POST', '/api/v1/listings', res.status, 201)) {
    ctx.listingId = res.data?.data?.id;
  }

  if (ctx.listingId) {
    res = await req('PUT', `/api/v1/listings/${ctx.listingId}`, {
      token: seller.token,
      body: { status: 'ACTIVE' },
    });
    assertStatus('PUT', `/api/v1/listings/${ctx.listingId}`, res.status, 200);

    res = await req('GET', `/api/v1/listings/${ctx.listingId}`);
    assertStatus('GET', `/api/v1/listings/${ctx.listingId}`, res.status, 200);

    res = await req('GET', '/api/v1/listings');
    assertStatus('GET', '/api/v1/listings (search)', res.status, 200);

    res = await req('GET', '/api/v1/listings/mine', { token: seller.token });
    assertStatus('GET', '/api/v1/listings/mine', res.status, 200);

    res = await req('GET', `/api/v1/listings/${ctx.listingId}/images`);
    assertStatus('GET', `/api/v1/listings/${ctx.listingId}/images`, res.status, 200);
  }

  // Buyer flows
  res = await req('GET', '/api/v1/buyers/me', { token: buyer.token });
  assertStatus('GET', '/api/v1/buyers/me', res.status, 200);

  if (ctx.listingId) {
    res = await req('POST', `/api/v1/buyers/me/saved-listings/${ctx.listingId}`, { token: buyer.token });
    assertStatus('POST', `/api/v1/buyers/me/saved-listings/${ctx.listingId}`, res.status, 201);

    res = await req('GET', '/api/v1/buyers/me/saved-listings', { token: buyer.token });
    assertStatus('GET', '/api/v1/buyers/me/saved-listings', res.status, 200);

    res = await req('POST', '/api/v1/enquiries', {
      token: buyer.token,
      body: {
        listingId: ctx.listingId,
        subject: 'Smoke enquiry',
        message: 'Is this still available?',
      },
    });
    if (assertStatus('POST', '/api/v1/enquiries', res.status, 201)) {
      ctx.enquiryId = res.data?.data?.id;
    }

    if (ctx.enquiryId) {
      res = await req('GET', '/api/v1/enquiries/mine', { token: buyer.token });
      assertStatus('GET', '/api/v1/enquiries/mine', res.status, 200);

      res = await req('GET', '/api/v1/enquiries/inbox', { token: seller.token });
      assertStatus('GET', '/api/v1/enquiries/inbox', res.status, 200);

      res = await req('POST', `/api/v1/enquiries/${ctx.enquiryId}/respond`, {
        token: seller.token,
        body: { message: 'Yes, still available.' },
      });
      assertStatus('POST', `/api/v1/enquiries/${ctx.enquiryId}/respond`, res.status, 200);
    }
  }

  // Notifications
  res = await req('GET', '/api/v1/notifications', { token: seller.token });
  assertStatus('GET', '/api/v1/notifications', res.status, 200);

  res = await req('GET', '/api/v1/notifications/unread-count', { token: seller.token });
  assertStatus('GET', '/api/v1/notifications/unread-count', res.status, 200);

  res = await req('GET', '/api/v1/notifications/preferences', { token: seller.token });
  assertStatus('GET', '/api/v1/notifications/preferences', res.status, 200);

  // Payments
  res = await req('POST', '/api/v1/payments/invoices', {
    token: seller.token,
    body: { feeCode: 'LISTING_PUBLISH', referenceType: 'LISTING', referenceId: ctx.listingId },
  });
  if (assertStatus('POST', '/api/v1/payments/invoices', res.status, 201)) {
    ctx.invoiceId = res.data?.data?.id;
  }

  if (ctx.invoiceId) {
    res = await req('GET', '/api/v1/payments/invoices/mine', { token: seller.token });
    assertStatus('GET', '/api/v1/payments/invoices/mine', res.status, 200);

    res = await req('GET', `/api/v1/payments/invoices/${ctx.invoiceId}`, { token: seller.token });
    assertStatus('GET', `/api/v1/payments/invoices/${ctx.invoiceId}`, res.status, 200);
  }

  // Verification
  res = await req('POST', '/api/v1/verifications', {
    token: seller.token,
    body: { verificationType: 'LISTING', listingId: ctx.listingId },
  });
  assertStatus('POST', '/api/v1/verifications', res.status, 201);

  res = await req('GET', '/api/v1/verifications/mine', { token: seller.token });
  assertStatus('GET', '/api/v1/verifications/mine', res.status, 200);

  // Token refresh
  res = await req('POST', '/api/v1/auth/login', { body: { email: seller.email, password: PASSWORD } });
  if (res.data?.data?.refreshToken) {
    const refreshRes = await req('POST', '/api/v1/auth/refresh', {
      body: { refreshToken: res.data.data.refreshToken },
    });
    assertStatus('POST', '/api/v1/auth/refresh', refreshRes.status, 200);
  }

  // Auth guard — no token
  res = await req('GET', '/api/v1/users/me');
  record('GET', '/api/v1/users/me (no auth)', res.status, res.status === 401 ? 'PASS' : 'FAIL', 'expect 401');

  printSummary();
  const failed = results.filter((r) => r.outcome === 'FAIL').length;
  process.exit(failed > 0 ? 1 : 0);
}

function printSummary() {
  const pass = results.filter((r) => r.outcome === 'PASS').length;
  const fail = results.filter((r) => r.outcome === 'FAIL').length;
  const total = results.length;
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Results: ${pass}/${total} passed, ${fail} failed`);
  if (fail > 0) {
    console.log('\nFailures:');
    results.filter((r) => r.outcome === 'FAIL').forEach((r) => {
      console.log(`  ${r.method} ${r.path} → ${r.status} ${r.note}`);
    });
  }
  console.log('');
}

run().catch((err) => {
  console.error('Smoke test crashed:', err.message);
  process.exit(1);
});
