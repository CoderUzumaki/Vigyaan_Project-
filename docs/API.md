# Tourist Safety System: API Specifications

> **Contract Version:** 1.0.0  
> **Stakeholders:** Team A (Frontend/Mobile) & Team B (Backend/Infra)

This document outlines the RESTful communication contract between the client applications and the core safety services.

---

## Authentication
*All protected requests must include the `Authorization: Bearer <jwt>` header.*

| Method | Endpoint | Body/Payload | Returns |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | `{ email, password }` | `{ token, user }` |
| `POST` | `/api/auth/login` | `{ email, password }` | `{ token, user }` |
| `GET` | `/api/auth/me` | — | `{ id, email, did, role, kycStatus, kycVerified }` |

---

## Location & Geofencing
*The React Native app is required to heartbeat this endpoint every 30 seconds.*

| Method | Endpoint | Body/Payload | Returns |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/location/ping` | `{ lat, lng, accuracy }` | `{ ok, breach: null \| { zoneId, zoneName, severity } }` |

---

## SOS & Incident Management
*Handles emergency triggers, covert PIN verification, and incident resolution.*

| Method | Endpoint | Body/Payload | Returns |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/sos/confirm` | `{ sosType, intentMethod, clientTimestamp, pin? }` | `{ ok, incidentId }` |
| `POST` | `/api/sos/cancel` | `{ incidentId? }` | `{ ok }` |
| `POST` | `/api/tourist/set-pin` | `{ pin }` | `{ ok }` |

---

## Zone Management (GeoJSON)
*Administrative tools for defining safety and danger zones.*

| Method | Endpoint | Body/Payload | Scope | Returns |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/zones` | — | Public | `GeoJSON FeatureCollection` |
| `POST` | `/api/zones` | `{ name, severity, boundary }` | **Admin** | `{ ok, zoneId }` |
| `PUT` | `/api/zones/:id` | `{ name?, severity?, active? }` | **Admin** | `{ ok }` |
| `DELETE` | `/api/zones/:id` | — | **Admin** | `{ ok }` |

---

## KYC & Identity
*Management of identity documents and verification status.*

| Method | Endpoint | Payload Type | Scope | Returns |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/kyc/submit` | `multipart/form-data` | User | `{ ok, submissionId }` |
| `GET` | `/api/kyc/status` | — | User | `{ kycStatus, kycVerified }` |
| `GET` | `/api/kyc/pending` | — | **Admin** | `[ submission... ]` |
| `POST` | `/api/kyc/review` | `{ submissionId, decision }` | **Admin** | `{ ok }` |

---

## Tourist Profile & History
*User-facing data for the mobile application dashboard.*

| Method | Endpoint | Returns |
| :--- | :--- | :--- |
| `GET` | `/api/tourist/history` | `{ sos: [...], breaches: [...] }` |
| `GET` | `/api/tourist/profile` | `{ id, did, kycStatus, consentFlags }` |

---

## Admin & Dispatch
*Back-office endpoints for emergency response and user oversight.*

| Method | Endpoint | Query/Body | Returns |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/tourists` | — | `[ tourist... ]` |
| `GET` | `/api/admin/incidents` | `?status&from&to` | `[ incident... ]` |
| `POST` | `/api/admin/dispatch` | `{ incidentId, responderId, type }` | `{ ok, dispatchId }` |
| `POST` | `/api/admin/resolve` | `{ incidentId, outcome }` | `{ ok }` |

---

## Services Portal
*Third-party access for insurance and analytical partners.*

| Method | Endpoint | Query/Body | Scope | Returns |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/services/incident/:id` | `?consentVerified` | **Insurance** | `Incident Record` |
| `GET` | `/api/services/analytics` | `?from&to` | **Services** | `Aggregate Stats` |
| `POST` | `/api/services/consent` | `{ touristId, granted }` | Internal | `{ ok }` |

---

### Technical Notes
* **Data Security:** All PINs and Passwords must be hashed (e.g., Argon2 or BCrypt) before storage.
* **GeoJSON:** The `/api/zones` GET request returns standard RFC 7946 format for easy integration with Mapbox/Leaflet.
* **Role Enforcement:** Middleware must validate `role` in JWT for all endpoints marked as **Admin**, **Insurance**, or **Services**.
