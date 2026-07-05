const PREFIXES = {
  listing: 'LST',
  invoice: 'INV',
  payment: 'PAY',
  enquiry: 'ENQ',
  professional: 'PRO',
  verification: 'VER',
  complaint: 'CMP',
  contact: 'CNT',
};

function randomSegment(length = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export function generateReference(type) {
  const prefix = PREFIXES[type] || 'REF';
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${randomSegment()}`;
}
