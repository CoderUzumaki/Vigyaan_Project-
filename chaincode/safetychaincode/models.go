// Package main provides the state models for the Tourist Safety System chaincode.
// All structs stored on the Hyperledger Fabric ledger are defined here.
package main

// ─────────────────────────────────────────────────────────────────────────────
// Tourist — registered tourist identity on the blockchain
// ─────────────────────────────────────────────────────────────────────────────

// Tourist represents a registered tourist on the ledger.
// Key format: TOURIST_{touristId}
type Tourist struct {
	DocType          string `json:"docType"`          // always "TOURIST"
	TouristID        string `json:"touristId"`        // unique tourist identifier
	DID              string `json:"did"`              // decentralised identity
	KYCHash          string `json:"kycHash"`          // hash of KYC submission
	KYCVerified      bool   `json:"kycVerified"`      // whether KYC was verified
	InsuranceConsent bool   `json:"insuranceConsent"` // consent for insurance data access
	RegisteredAt     string `json:"registeredAt"`     // ISO 8601 timestamp
	VerifiedAt       string `json:"verifiedAt,omitempty"`
}

// ─────────────────────────────────────────────────────────────────────────────
// SOSEvent — an SOS alert raised by a tourist
// ─────────────────────────────────────────────────────────────────────────────

// SOSEvent represents a confirmed SOS alert on the ledger.
// Key format: SOS_{incidentId}
type SOSEvent struct {
	DocType      string `json:"docType"`      // always "SOS"
	IncidentID   string `json:"incidentId"`   // unique incident identifier
	TouristID    string `json:"touristId"`    // tourist who raised the alert
	SOSType      string `json:"sosType"`      // medical | fire | police
	IntentMethod string `json:"intentMethod"` // countdown | pin | gyro_panic
	Lat          string `json:"lat"`          // latitude
	Lng          string `json:"lng"`          // longitude
	KYCVerified  bool   `json:"kycVerified"`  // was tourist KYC-verified at time of SOS
	Status       string `json:"status"`       // confirmed | closed
	Outcome      string `json:"outcome,omitempty"`  // responded | false_alarm | tourist_safe
	Timestamp    string `json:"timestamp"`          // ISO 8601
	ClosedAt     string `json:"closedAt,omitempty"` // ISO 8601
	ClosedBy     string `json:"closedBy,omitempty"` // who closed the incident
}

// ─────────────────────────────────────────────────────────────────────────────
// BreachEvent — a geofence breach by a tourist
// ─────────────────────────────────────────────────────────────────────────────

// BreachEvent represents a geofence zone breach on the ledger.
// Key format: BREACH_{breachId}
type BreachEvent struct {
	DocType   string `json:"docType"`   // always "BREACH"
	BreachID  string `json:"breachId"`  // unique breach identifier
	TouristID string `json:"touristId"` // tourist who breached the zone
	Lat       string `json:"lat"`       // latitude
	Lng       string `json:"lng"`       // longitude
	Severity  string `json:"severity"`  // amber | red
	ZoneName  string `json:"zoneName"`  // human-readable zone name
	Timestamp string `json:"timestamp"` // ISO 8601
}

// ─────────────────────────────────────────────────────────────────────────────
// DispatchEvent — a responder dispatched to an incident
// ─────────────────────────────────────────────────────────────────────────────

// DispatchEvent represents a responder dispatch to an SOS incident.
// Key format: DISPATCH_{dispatchId}
type DispatchEvent struct {
	DocType       string `json:"docType"`       // always "DISPATCH"
	DispatchID    string `json:"dispatchId"`    // unique dispatch identifier
	IncidentID    string `json:"incidentId"`    // linked SOS incident
	ResponderID   string `json:"responderId"`   // responder identifier
	ResponderType string `json:"responderType"` // medical | fire | police
	Status        string `json:"status"`        // en_route | on_scene | complete
	DispatchedAt  string `json:"dispatchedAt"`  // ISO 8601
	ClosedAt      string `json:"closedAt,omitempty"`
}

// ─────────────────────────────────────────────────────────────────────────────
// KYCRecord — verification record for a tourist's KYC
// ─────────────────────────────────────────────────────────────────────────────

// KYCRecord stores KYC verification audit data.
// Key format: KYC_{touristId}
type KYCRecord struct {
	DocType    string `json:"docType"`    // always "KYC"
	TouristID  string `json:"touristId"`  // tourist identifier
	KYCHash    string `json:"kycHash"`    // hash of verified KYC documents
	VerifiedBy string `json:"verifiedBy"` // admin who verified
	VerifiedAt string `json:"verifiedAt"` // ISO 8601
}

// ─────────────────────────────────────────────────────────────────────────────
// Enum validation helpers
// ─────────────────────────────────────────────────────────────────────────────

// ValidSOSTypes defines the valid SOS alert types.
var ValidSOSTypes = map[string]bool{
	"medical": true,
	"fire":    true,
	"police":  true,
}

// ValidIntentMethods defines how the SOS was triggered.
var ValidIntentMethods = map[string]bool{
	"countdown":  true,
	"pin":        true,
	"gyro_panic": true,
}

// ValidSeverities defines geofence zone severity levels.
var ValidSeverities = map[string]bool{
	"amber": true,
	"red":   true,
}

// ValidResponderTypes defines responder categories.
var ValidResponderTypes = map[string]bool{
	"medical": true,
	"fire":    true,
	"police":  true,
}

// ValidDispatchStatuses defines responder dispatch states.
var ValidDispatchStatuses = map[string]bool{
	"en_route": true,
	"on_scene": true,
	"complete": true,
}

// ValidOutcomes defines how an incident can be resolved.
var ValidOutcomes = map[string]bool{
	"responded":    true,
	"false_alarm":  true,
	"tourist_safe": true,
}
