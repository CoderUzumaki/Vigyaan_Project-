// ─────────────────────────────────────────────────────────────────────────────
// Mock API adapter — intercepts all axios calls for offline development
// TODO: Remove this entire file when connecting to real backend
// ─────────────────────────────────────────────────────────────────────────────

import MockAdapter from 'axios-mock-adapter';
import api from './api';

const mock = new MockAdapter(api, { delayResponse: 800 });

// ── Auth mocks ──────────────────────────────────────────────────────────────

mock.onPost('/api/auth/register').reply((config) => {
  const body = JSON.parse(config.data || '{}');
  return [
    201,
    {
      token: 'mock-jwt-token-' + Date.now(),
      user: {
        id: 'tourist-' + Date.now(),
        email: body.email || 'tourist@example.com',
        fullName: body.fullName || 'Tourist',
        did: 'did:fab:tourist:' + Math.random().toString(36).slice(2, 10),
        role: 'tourist',
        kycStatus: 'pending',
        kycVerified: false,
      },
    },
  ];
});

mock.onPost('/api/auth/login').reply((config) => {
  const body = JSON.parse(config.data || '{}');
  return [
    200,
    {
      token: 'mock-jwt-token-' + Date.now(),
      user: {
        id: 'tourist-1',
        email: body.email || 'tourist@example.com',
        fullName: 'Test Tourist',
        did: 'did:fab:tourist:abc12345',
        role: 'tourist',
        kycStatus: 'pending',
        kycVerified: false,
      },
    },
  ];
});

mock.onGet('/api/auth/me').reply(() => {
  return [
    200,
    {
      id: 'tourist-1',
      email: 'test@example.com',
      fullName: 'Test Tourist',
      did: 'did:fab:tourist:abc12345',
      role: 'tourist',
      kycStatus: 'pending',
      kycVerified: false,
    },
  ];
});

// ── Location ping — 10% breach chance for demo ─────────────────────────────

mock.onPost('/api/location/ping').reply(() => {
  const hasBreach = Math.random() < 0.1;
  return [
    200,
    {
      ok: true,
      breach: hasBreach
        ? {
            zoneId: 'zone-2',
            zoneName: 'Caution Perimeter',
            severity: 'amber',
            distanceMeters: Math.floor(Math.random() * 200 + 50),
          }
        : null,
    },
  ];
});

// ── Zones — GeoJSON FeatureCollection ───────────────────────────────────────

mock.onGet('/api/zones').reply(() => {
  return [
    200,
    {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            id: 'zone-1',
            name: 'Main Visitor Zone',
            severity: 'green',
            active: true,
          },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [77.195, 28.605],
                [77.22, 28.605],
                [77.22, 28.625],
                [77.195, 28.625],
                [77.195, 28.605],
              ],
            ],
          },
        },
        {
          type: 'Feature',
          properties: {
            id: 'zone-2',
            name: 'Caution Perimeter',
            severity: 'amber',
            active: true,
          },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [77.185, 28.595],
                [77.235, 28.595],
                [77.235, 28.635],
                [77.185, 28.635],
                [77.185, 28.595],
              ],
            ],
          },
        },
        {
          type: 'Feature',
          properties: {
            id: 'zone-3',
            name: 'Restricted Northern Area',
            severity: 'red',
            active: true,
          },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [77.19, 28.635],
                [77.23, 28.635],
                [77.23, 28.65],
                [77.19, 28.65],
                [77.19, 28.635],
              ],
            ],
          },
        },
      ],
    },
  ];
});

// ── SOS mocks ───────────────────────────────────────────────────────────────

mock.onPost('/api/sos/confirm').reply(() => {
  return [200, { ok: true, incidentId: 'incident-' + Date.now() }];
});

mock.onPost('/api/sos/cancel').reply(() => {
  return [200, { ok: true }];
});

// ── History — SOS events + breaches ─────────────────────────────────────────

mock.onGet('/api/tourist/history').reply(() => {
  return [
    200,
    {
      sos: [
        {
          id: 'sos-1',
          sosType: 'medical',
          status: 'resolved',
          intentMethod: 'countdown',
          lat: 28.6139,
          lng: 77.209,
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          fabricTxHash: 'tx_8f3a1b2c4d5e6f7a8b9c0d1e2f3a4b5c',
          kycVerifiedAtTime: true,
        },
        {
          id: 'sos-2',
          sosType: 'police',
          status: 'false_alarm',
          intentMethod: 'pin',
          lat: 28.615,
          lng: 77.211,
          createdAt: new Date(Date.now() - 259200000).toISOString(),
          fabricTxHash: 'tx_1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d',
          kycVerifiedAtTime: false,
        },
      ],
      breaches: [
        {
          id: 'breach-1',
          zoneName: 'Caution Perimeter',
          severity: 'amber',
          lat: 28.62,
          lng: 77.22,
          durationMinutes: 12,
          createdAt: new Date(Date.now() - 172800000).toISOString(),
          fabricTxHash: 'tx_7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d',
        },
        {
          id: 'breach-2',
          zoneName: 'Restricted Northern Area',
          severity: 'red',
          lat: 28.64,
          lng: 77.21,
          durationMinutes: 3,
          createdAt: new Date(Date.now() - 432000000).toISOString(),
          fabricTxHash: 'tx_2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e',
        },
        {
          id: 'breach-3',
          zoneName: 'Caution Perimeter',
          severity: 'amber',
          lat: 28.63,
          lng: 77.215,
          durationMinutes: 7,
          createdAt: new Date(Date.now() - 604800000).toISOString(),
          fabricTxHash: null,
        },
      ],
    },
  ];
});

// ── KYC submit ──────────────────────────────────────────────────────────────

mock.onPost('/api/kyc/submit').reply(() => {
  return [200, { ok: true, submissionId: 'mock-sub-' + Date.now() }];
});

// ── Profile / PIN / Consent ─────────────────────────────────────────────────

mock.onPost('/api/tourist/set-pin').reply(() => {
  return [200, { ok: true }];
});

mock.onPost('/api/services/consent').reply(() => {
  return [200, { ok: true }];
});

mock.onPost('/api/tourist/register-push').reply(() => {
  return [200, { ok: true }];
});

mock.onGet('/api/tourist/profile').reply(() => {
  return [
    200,
    {
      id: 'tourist-1',
      did: 'did:fab:tourist:abc12345',
      kycStatus: 'pending',
      consentFlags: { insuranceSharing: false },
    },
  ];
});

// ── Analytics (for heatmap) ─────────────────────────────────────────────────

mock.onGet('/api/services/analytics').reply(() => {
  return [
    200,
    {
      zones: [
        { zoneId: 'zone-1', zoneName: 'Main Visitor Zone', incidentCount: 3, centroid: { lat: 28.615, lng: 77.2075 } },
        { zoneId: 'zone-2', zoneName: 'Caution Perimeter', incidentCount: 8, centroid: { lat: 28.615, lng: 77.21 } },
        { zoneId: 'zone-3', zoneName: 'Restricted Northern Area', incidentCount: 15, centroid: { lat: 28.6425, lng: 77.21 } },
      ],
    },
  ];
});

export default mock;
