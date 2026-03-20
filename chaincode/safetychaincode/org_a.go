// org_a.go — Tourism Authority (Org1MSP) functions.
// These are WRITE operations: tourist registration, KYC verification,
// consent management, SOS logging, and geofence breach logging.
package main

import (
	"encoding/json"
	"fmt"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// ─────────────────────────────────────────────────────────────────────────────
// RegisterTourist creates a new tourist identity on the ledger.
// ─────────────────────────────────────────────────────────────────────────────

func (s *SafetyContract) RegisterTourist(
	ctx contractapi.TransactionContextInterface,
	touristID, did, kycHash, timestamp string,
) error {
	// Validate: no empty strings
	if touristID == "" || did == "" || kycHash == "" || timestamp == "" {
		return fmt.Errorf("all parameters required: touristID, did, kycHash, timestamp")
	}

	// Check tourist does not already exist
	existing, err := ctx.GetStub().GetState("TOURIST_" + touristID)
	if err != nil {
		return fmt.Errorf("failed to read state: %v", err)
	}
	if existing != nil {
		return fmt.Errorf("tourist %s already registered", touristID)
	}

	tourist := Tourist{
		DocType:          "TOURIST",
		TouristID:        touristID,
		DID:              did,
		KYCHash:          kycHash,
		KYCVerified:      false,
		InsuranceConsent: false,
		RegisteredAt:     timestamp,
	}

	bytes, err := json.Marshal(tourist)
	if err != nil {
		return fmt.Errorf("failed to marshal tourist: %v", err)
	}

	if err := ctx.GetStub().PutState("TOURIST_"+touristID, bytes); err != nil {
		return fmt.Errorf("failed to write tourist to ledger: %v", err)
	}

	ctx.GetStub().SetEvent("TouristRegistered", bytes)
	return nil
}

// ─────────────────────────────────────────────────────────────────────────────
// VerifyKYC marks a tourist's KYC as verified and stores a KYC audit record.
// ─────────────────────────────────────────────────────────────────────────────

func (s *SafetyContract) VerifyKYC(
	ctx contractapi.TransactionContextInterface,
	touristID, kycHash, verifiedBy, timestamp string,
) error {
	if touristID == "" || kycHash == "" || verifiedBy == "" || timestamp == "" {
		return fmt.Errorf("all parameters required: touristID, kycHash, verifiedBy, timestamp")
	}

	data, err := ctx.GetStub().GetState("TOURIST_" + touristID)
	if err != nil {
		return fmt.Errorf("failed to read state: %v", err)
	}
	if data == nil {
		return fmt.Errorf("tourist %s not found", touristID)
	}

	var tourist Tourist
	if err := json.Unmarshal(data, &tourist); err != nil {
		return fmt.Errorf("failed to unmarshal tourist: %v", err)
	}

	// Update tourist record
	tourist.KYCVerified = true
	tourist.KYCHash = kycHash
	tourist.VerifiedAt = timestamp

	touristBytes, err := json.Marshal(tourist)
	if err != nil {
		return fmt.Errorf("failed to marshal tourist: %v", err)
	}
	if err := ctx.GetStub().PutState("TOURIST_"+touristID, touristBytes); err != nil {
		return fmt.Errorf("failed to update tourist: %v", err)
	}

	// Write KYC audit record
	kycRecord := KYCRecord{
		DocType:    "KYC",
		TouristID:  touristID,
		KYCHash:    kycHash,
		VerifiedBy: verifiedBy,
		VerifiedAt: timestamp,
	}
	kycBytes, err := json.Marshal(kycRecord)
	if err != nil {
		return fmt.Errorf("failed to marshal KYC record: %v", err)
	}
	if err := ctx.GetStub().PutState("KYC_"+touristID, kycBytes); err != nil {
		return fmt.Errorf("failed to write KYC record: %v", err)
	}

	ctx.GetStub().SetEvent("KYCVerified", touristBytes)
	return nil
}

// ─────────────────────────────────────────────────────────────────────────────
// SetInsuranceConsent updates whether a tourist consents to insurance data access.
// ─────────────────────────────────────────────────────────────────────────────

func (s *SafetyContract) SetInsuranceConsent(
	ctx contractapi.TransactionContextInterface,
	touristID, consent, timestamp string,
) error {
	if touristID == "" || consent == "" || timestamp == "" {
		return fmt.Errorf("all parameters required: touristID, consent, timestamp")
	}
	if consent != "true" && consent != "false" {
		return fmt.Errorf("consent must be 'true' or 'false'")
	}

	data, err := ctx.GetStub().GetState("TOURIST_" + touristID)
	if err != nil {
		return fmt.Errorf("failed to read state: %v", err)
	}
	if data == nil {
		return fmt.Errorf("tourist %s not found", touristID)
	}

	var tourist Tourist
	if err := json.Unmarshal(data, &tourist); err != nil {
		return fmt.Errorf("failed to unmarshal tourist: %v", err)
	}

	tourist.InsuranceConsent = consent == "true"

	bytes, err := json.Marshal(tourist)
	if err != nil {
		return fmt.Errorf("failed to marshal tourist: %v", err)
	}

	return ctx.GetStub().PutState("TOURIST_"+touristID, bytes)
}

// ─────────────────────────────────────────────────────────────────────────────
// LogSOSAlert records a confirmed SOS event on the ledger.
// ─────────────────────────────────────────────────────────────────────────────

func (s *SafetyContract) LogSOSAlert(
	ctx contractapi.TransactionContextInterface,
	incidentID, touristID, sosType, intentMethod, lat, lng, kycVerifiedStr, timestamp string,
) error {
	// Validate required fields
	if incidentID == "" || touristID == "" || lat == "" || lng == "" || timestamp == "" {
		return fmt.Errorf("all parameters required: incidentID, touristID, lat, lng, timestamp")
	}

	// Validate sosType
	if !ValidSOSTypes[sosType] {
		return fmt.Errorf("invalid sosType: must be medical, fire, or police")
	}

	// Validate intentMethod
	if !ValidIntentMethods[intentMethod] {
		return fmt.Errorf("invalid intentMethod: must be countdown, pin, or gyro_panic")
	}

	// Check incident does not already exist (prevent duplicates)
	existing, err := ctx.GetStub().GetState("SOS_" + incidentID)
	if err != nil {
		return fmt.Errorf("failed to read state: %v", err)
	}
	if existing != nil {
		return fmt.Errorf("SOS incident %s already exists", incidentID)
	}

	kycVerified := kycVerifiedStr == "true"

	event := SOSEvent{
		DocType:      "SOS",
		IncidentID:   incidentID,
		TouristID:    touristID,
		SOSType:      sosType,
		IntentMethod: intentMethod,
		Lat:          lat,
		Lng:          lng,
		KYCVerified:  kycVerified,
		Status:       "confirmed",
		Timestamp:    timestamp,
	}

	bytes, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal SOS event: %v", err)
	}

	if err := ctx.GetStub().PutState("SOS_"+incidentID, bytes); err != nil {
		return fmt.Errorf("failed to write SOS event: %v", err)
	}

	ctx.GetStub().SetEvent("SOSAlert", bytes)
	return nil
}

// ─────────────────────────────────────────────────────────────────────────────
// LogGeofenceBreach records a geofence zone breach on the ledger.
// ─────────────────────────────────────────────────────────────────────────────

func (s *SafetyContract) LogGeofenceBreach(
	ctx contractapi.TransactionContextInterface,
	breachID, touristID, lat, lng, severity, zoneName, timestamp string,
) error {
	// Validate required fields
	if breachID == "" || touristID == "" || lat == "" || lng == "" || zoneName == "" || timestamp == "" {
		return fmt.Errorf("all parameters required: breachID, touristID, lat, lng, zoneName, timestamp")
	}

	// Validate severity
	if !ValidSeverities[severity] {
		return fmt.Errorf("invalid severity: must be amber or red")
	}

	// Check breach does not already exist (prevent duplicates)
	existing, err := ctx.GetStub().GetState("BREACH_" + breachID)
	if err != nil {
		return fmt.Errorf("failed to read state: %v", err)
	}
	if existing != nil {
		return fmt.Errorf("breach %s already logged", breachID)
	}

	breach := BreachEvent{
		DocType:   "BREACH",
		BreachID:  breachID,
		TouristID: touristID,
		Lat:       lat,
		Lng:       lng,
		Severity:  severity,
		ZoneName:  zoneName,
		Timestamp: timestamp,
	}

	bytes, err := json.Marshal(breach)
	if err != nil {
		return fmt.Errorf("failed to marshal breach event: %v", err)
	}

	if err := ctx.GetStub().PutState("BREACH_"+breachID, bytes); err != nil {
		return fmt.Errorf("failed to write breach event: %v", err)
	}

	ctx.GetStub().SetEvent("GeofenceBreach", bytes)
	return nil
}

// ─────────────────────────────────────────────────────────────────────────────
// GetTourist retrieves a tourist record from the ledger.
// ─────────────────────────────────────────────────────────────────────────────

func (s *SafetyContract) GetTourist(
	ctx contractapi.TransactionContextInterface,
	touristID string,
) (*Tourist, error) {
	if touristID == "" {
		return nil, fmt.Errorf("touristID is required")
	}

	data, err := ctx.GetStub().GetState("TOURIST_" + touristID)
	if err != nil {
		return nil, fmt.Errorf("failed to read state: %v", err)
	}
	if data == nil {
		return nil, fmt.Errorf("tourist %s not found", touristID)
	}

	var tourist Tourist
	if err := json.Unmarshal(data, &tourist); err != nil {
		return nil, fmt.Errorf("failed to unmarshal tourist: %v", err)
	}

	return &tourist, nil
}

// ─────────────────────────────────────────────────────────────────────────────
// GetSOSEvent retrieves an SOS event by incident ID.
// ─────────────────────────────────────────────────────────────────────────────

func (s *SafetyContract) GetSOSEvent(
	ctx contractapi.TransactionContextInterface,
	incidentID string,
) (*SOSEvent, error) {
	if incidentID == "" {
		return nil, fmt.Errorf("incidentID is required")
	}

	data, err := ctx.GetStub().GetState("SOS_" + incidentID)
	if err != nil {
		return nil, fmt.Errorf("failed to read state: %v", err)
	}
	if data == nil {
		return nil, fmt.Errorf("SOS incident %s not found", incidentID)
	}

	var event SOSEvent
	if err := json.Unmarshal(data, &event); err != nil {
		return nil, fmt.Errorf("failed to unmarshal SOS event: %v", err)
	}

	return &event, nil
}

// ─────────────────────────────────────────────────────────────────────────────
// GetBreachEvent retrieves a breach event by breach ID.
// ─────────────────────────────────────────────────────────────────────────────

func (s *SafetyContract) GetBreachEvent(
	ctx contractapi.TransactionContextInterface,
	breachID string,
) (*BreachEvent, error) {
	if breachID == "" {
		return nil, fmt.Errorf("breachID is required")
	}

	data, err := ctx.GetStub().GetState("BREACH_" + breachID)
	if err != nil {
		return nil, fmt.Errorf("failed to read state: %v", err)
	}
	if data == nil {
		return nil, fmt.Errorf("breach %s not found", breachID)
	}

	var breach BreachEvent
	if err := json.Unmarshal(data, &breach); err != nil {
		return nil, fmt.Errorf("failed to unmarshal breach event: %v", err)
	}

	return &breach, nil
}
