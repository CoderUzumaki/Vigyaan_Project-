/**
 * lib/config.ts — Centralized configuration
 *
 * ALL environment-dependent values live here.
 * No other file should hardcode connection strings, secrets, or URLs.
 */

export const config = {
  /** PostgreSQL connection string */
  databaseUrl: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/tourist_safety',

  /** Redis connection URL */
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',

  /** JWT signing secret — MUST be overridden in production */
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',

  /** JWT token lifetime */
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',

  /** Server port */
  port: parseInt(process.env.PORT ?? '3000', 10),

  /** Public-facing URL */
  publicUrl: process.env.NEXT_PUBLIC_URL ?? 'http://localhost:3000',

  /** Allowed CORS origins (comma-separated via env or defaults) */
  corsOrigins: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .concat([process.env.NEXT_PUBLIC_URL ?? 'http://localhost:3000']),

  /** Default map center [lat, lng] for admin dashboard */
  mapCenter: {
    lat: parseFloat(process.env.MAP_CENTER_LAT ?? '28.6139'),
    lng: parseFloat(process.env.MAP_CENTER_LNG ?? '77.2090'),
  },

  /** Default map zoom level */
  mapZoom: parseInt(process.env.MAP_ZOOM ?? '13', 10),

  /** KYC file upload directory */
  kycUploadDir: process.env.KYC_UPLOAD_DIR ?? '/tmp/kyc',

  /** Fabric samples path */
  fabricSamplesPath: process.env.FABRIC_SAMPLES_PATH ?? '/tmp/fabric-samples',

  /** Fabric channel and chaincode names */
  fabricChannel: process.env.FABRIC_CHANNEL ?? 'safetychannel',
  fabricChaincode: process.env.FABRIC_CHAINCODE ?? 'safetychaincode',

  /** BullMQ queue name */
  fabricQueueName: process.env.FABRIC_QUEUE_NAME ?? 'fabric-jobs',

  /** Node environment check */
  isDev: process.env.NODE_ENV !== 'production',
} as const;
