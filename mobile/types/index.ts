// ─────────────────────────────────────────────────────────────────────────────
// Shared TypeScript types for the Tourist Safety mobile app
// ─────────────────────────────────────────────────────────────────────────────

/** User object returned from API */
export interface User {
  id: string;
  email: string;
  fullName: string;
  did: string;
  role: 'tourist' | 'admin' | 'service';
  kycStatus: 'pending' | 'verified' | 'rejected';
  kycVerified: boolean;
}

/** Auth response from login/register */
export interface AuthResponse {
  token: string;
  user: User;
}

/** Location ping sent to backend */
export interface LocationPing {
  lat: number;
  lng: number;
  accuracy: number;
}

/** Breach result from location ping */
export interface BreachResult {
  zoneId: string;
  zoneName: string;
  severity: 'green' | 'amber' | 'red';
  distanceMeters: number;
}

/** Location ping response */
export interface LocationPingResponse {
  ok: boolean;
  breach: BreachResult | null;
}

/** SOS confirmation payload */
export interface SOSConfirmPayload {
  sosType: 'medical' | 'fire' | 'police' | 'natural_disaster' | 'other';
  intentMethod: 'countdown' | 'button' | 'shake' | 'covert_pin';
  clientTimestamp: string;
  pin?: string;
}

/** SOS confirmation response */
export interface SOSConfirmResponse {
  ok: boolean;
  incidentId: string;
}

/** SOS event from history */
export interface SOSEvent {
  id: string;
  sosType: string;
  status: string;
  lat: number;
  lng: number;
  createdAt: string;
  fabricTxHash?: string;
}

/** Breach event from history */
export interface BreachEvent {
  id: string;
  zoneName: string;
  severity: string;
  lat: number;
  lng: number;
  createdAt: string;
}

/** History response */
export interface HistoryResponse {
  sos: SOSEvent[];
  breaches: BreachEvent[];
}

/** Geofence zone from GeoJSON */
export interface Zone {
  id: string;
  name: string;
  severity: 'green' | 'amber' | 'red';
  active: boolean;
}

/** Current zone status for display */
export interface ZoneStatus {
  severity: 'green' | 'amber' | 'red';
  zoneName: string;
  message: string;
}

/** KYC submission payload */
export interface KYCSubmitPayload {
  passportPhoto: string; // base64 or URI
  selfie: string;
}

/** Auth context type */
export interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

/** Socket.IO events from server */
export interface SocketEvents {
  geofence_breach: {
    touristId: string;
    zoneName: string;
    severity: string;
    lat: number;
    lng: number;
  };
  sos_confirmed: {
    touristId: string;
    incidentId: string;
    txId: string;
    message: string;
  };
  sos_chain_written: {
    incidentId: string;
    fabricTxHash: string;
  };
  beacon_missed: {
    touristId: string;
    message: string;
  };
  breach_warning: {
    zoneName: string;
    severity: string;
    message: string;
  };
  responder_update: {
    etaSeconds: number;
    status: string;
  };
}

/** SOS emergency type */
export type SosType = 'medical' | 'fire' | 'police';

/** SOS intent verification method */
export type IntentMethod = 'countdown' | 'pin';

/** Active incident state */
export interface ActiveIncident {
  incidentId: string;
  sosType: SosType;
  intentMethod: IntentMethod;
  clientTimestamp: string;
  responderEta: number | null;
  responderStatus: string | null;
  blockchainStatus: 'pending' | 'confirmed';
  fabricTxHash: string | null;
}
