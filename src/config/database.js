import dns from 'dns';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { optionalEnv, optionalInt, requireEnv } from './env.js';

dotenv.config();

const globalCache = globalThis;

if (!globalCache.__landexMongoose) {
  globalCache.__landexMongoose = { conn: null, promise: null };
}

const cached = globalCache.__landexMongoose;

/** Matches Atlas Network Access → Allow Access from Anywhere (0.0.0.0/0). */
function isAtlasAllowFromAnywhere() {
  const access = optionalEnv('MONGODB_ATLAS_NETWORK_ACCESS').toLowerCase();
  const allowAny = optionalEnv('MONGODB_ALLOW_ANY_IP').toLowerCase();
  return (
    access === '0.0.0.0/0'
    || access === 'anywhere'
    || access === 'true'
    || allowAny === 'true'
    || allowAny === '1'
  );
}

function applyNetworkAndDnsPreferences() {
  if (isAtlasAllowFromAnywhere()) {
    const servers = optionalEnv('MONGODB_DNS_SERVERS', '8.8.8.8,8.8.4.4,1.1.1.1')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (servers.length) {
      dns.setServers(servers);
    }
  }

  if (optionalEnv('MONGODB_DNS_IPV4_FIRST', 'true') === 'true') {
    dns.setDefaultResultOrder('ipv4first');
  }
}

function getMongoOptions(uri) {
  const onVercel = Boolean(process.env.VERCEL);
  const options = {
    serverSelectionTimeoutMS: optionalInt('MONGODB_SERVER_SELECTION_TIMEOUT_MS', onVercel ? 20_000 : 30_000),
    socketTimeoutMS: optionalInt('MONGODB_SOCKET_TIMEOUT_MS', 45_000),
    connectTimeoutMS: optionalInt('MONGODB_CONNECT_TIMEOUT_MS', onVercel ? 20_000 : 30_000),
    maxPoolSize: optionalInt('MONGODB_MAX_POOL_SIZE', onVercel ? 1 : 10),
  };

  const family = optionalEnv('MONGODB_FAMILY');
  if (family) {
    options.family = parseInt(family, 10);
  }

  if (uri.startsWith('mongodb+srv://') || uri.startsWith('mongodb://')) {
    options.tls = optionalEnv('MONGODB_TLS', 'true') === 'true';
  }

  return options;
}

function isSrvDnsError(err) {
  return err?.syscall === 'querySrv'
    || (err?.code === 'ECONNREFUSED' && String(err?.message || '').includes('querySrv'));
}

async function connectWithUri(uri, options) {
  await mongoose.connect(uri, options);
}

function resetCache() {
  cached.conn = null;
  cached.promise = null;
}

export function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}

export async function connectDatabase() {
  if (cached.conn && isDatabaseConnected()) {
    return cached.conn;
  }

  if (!cached.promise) {
    applyNetworkAndDnsPreferences();
    mongoose.set('strictQuery', true);

    const primaryUri = requireEnv('MONGODB_URI');
    const fallbackUri = optionalEnv('MONGODB_URI_FALLBACK');
    const options = getMongoOptions(primaryUri);

    cached.promise = (async () => {
      try {
        try {
          await connectWithUri(primaryUri, options);
        } catch (err) {
          if (fallbackUri && isSrvDnsError(err)) {
            console.warn('MongoDB SRV DNS lookup failed; retrying with MONGODB_URI_FALLBACK...');
            await connectWithUri(fallbackUri, getMongoOptions(fallbackUri));
          } else {
            throw enrichMongoError(err);
          }
        }

        mongoose.connection.once('disconnected', resetCache);
        console.log('MongoDB connected');
        cached.conn = mongoose.connection;
        return cached.conn;
      } catch (err) {
        resetCache();
        throw err;
      }
    })();
  }

  return cached.promise;
}

function enrichMongoError(err) {
  if (!isSrvDnsError(err)) return err;

  const hint = [
    'MongoDB SRV DNS lookup failed (querySrv).',
    'Atlas Network Access (0.0.0.0/0) is set in Atlas — also set in .env:',
    '  MONGODB_ATLAS_NETWORK_ACCESS=0.0.0.0/0',
    '  MONGODB_DNS_SERVERS=8.8.8.8,8.8.4.4,1.1.1.1',
    'Or use Atlas standard connection string (mongodb://) as MONGODB_URI_FALLBACK.',
  ].join('\n');
  err.message = `${err.message}\n\n${hint}`;
  return err;
}

export async function disconnectDatabase() {
  resetCache();
  await mongoose.disconnect();
}
