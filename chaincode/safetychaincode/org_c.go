// org_c.go — Insurance (Org3MSP) functions.
// These are READ-ONLY operations — no PutState calls.
// All reads are gated by tourist insurance consent.
package main

import (
	"encoding/json"
	"fmt"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// ─────────────────────────────────────────────────────────────────────────────
// QueryIncident returns a consent-gated, privacy-safe view of an SOS incident.
// GPS, tourist DID, and KYC data are deliberately excluded from the response.
// ─────────────────────────────────────────────────────────────────────────────

func (s *SafetyContract) QueryIncident(
	ctx contractapi.TransactionContextInterface,
	incidentID string,
) (string, error) {
	if incidentID == "" {
		return "", fmt.Errorf("incidentID is required")
	}

	// Read incident
	data, err := ctx.GetStub().GetState("SOS_" + incidentID)
	if err != nil {
		return "", fmt.Errorf("failed to read state: %v", err)
	}
	if data == nil {
		return "", fmt.Errorf("incident %s not found", incidentID)
	}

	var event SOSEvent
	if err := json.Unmarshal(data, &event); err != nil {
		return "", fmt.Errorf("failed to unmarshal SOS event: %v", err)
	}

	// CRITICAL: check insurance consent via tourist record
	consentGranted, err := checkInsuranceConsent(ctx, event.TouristID)
	if err != nil {
		return "", err
	}
	if !consentGranted {
		return "", fmt.Errorf("tourist has not consented to insurance data access")
	}

	// Return ONLY permitted fields — NEVER return GPS, tourist DID, or KYC data
	result := map[string]interface{}{
		"incidentId": event.IncidentID,
		"sosType":    event.SOSType,
		"timestamp":  event.Timestamp,
		"status":     event.Status,
		"outcome":    valueOrDefault(event.Outcome, "no_outcome_available"),
		"closedAt":   valueOrDefault(event.ClosedAt, "no_data_available"),
	}

	bytes, err := json.Marshal(result)
	if err != nil {
		return "", fmt.Errorf("failed to marshal result: %v", err)
	}

	return string(bytes), nil
}

// ─────────────────────────────────────────────────────────────────────────────
// VerifyConsentOnChain checks whether a tourist has granted insurance consent.
// ─────────────────────────────────────────────────────────────────────────────

func (s *SafetyContract) VerifyConsentOnChain(
	ctx contractapi.TransactionContextInterface,
	touristID string,
) (bool, error) {
	if touristID == "" {
		return false, fmt.Errorf("touristID is required")
	}

	return checkInsuranceConsent(ctx, touristID)
}

// ─────────────────────────────────────────────────────────────────────────────
// GetAuditTrail returns the full transaction history for an SOS incident.
// Consent-gated: only accessible if tourist has granted insurance consent.
// ─────────────────────────────────────────────────────────────────────────────

func (s *SafetyContract) GetAuditTrail(
	ctx contractapi.TransactionContextInterface,
	incidentID string,
) (string, error) {
	if incidentID == "" {
		return "", fmt.Errorf("incidentID is required")
	}

	// First check consent via the SOS event's tourist ID
	sosData, err := ctx.GetStub().GetState("SOS_" + incidentID)
	if err != nil {
		return "", fmt.Errorf("failed to read state: %v", err)
	}
	if sosData == nil {
		return "", fmt.Errorf("incident %s not found", incidentID)
	}

	var event SOSEvent
	if err := json.Unmarshal(sosData, &event); err != nil {
		return "", fmt.Errorf("failed to unmarshal SOS event: %v", err)
	}

	consentGranted, err := checkInsuranceConsent(ctx, event.TouristID)
	if err != nil {
		return "", err
	}
	if !consentGranted {
		return "", fmt.Errorf("consent not granted for insurance data access")
	}

	// GetHistoryForKey returns all historical writes for this key
	iter, err := ctx.GetStub().GetHistoryForKey("SOS_" + incidentID)
	if err != nil {
		return "", fmt.Errorf("failed to get history: %v", err)
	}
	defer iter.Close()

	var history []map[string]interface{}
	for iter.HasNext() {
		response, err := iter.Next()
		if err != nil {
			return "", fmt.Errorf("failed to iterate history: %v", err)
		}

		entry := map[string]interface{}{
			"txId":      response.TxId,
			"isDelete":  response.IsDelete,
		}

		// Add timestamp if available
		if response.Timestamp != nil {
			entry["timestamp"] = response.Timestamp.AsTime().String()
		} else {
			entry["timestamp"] = "no_timestamp_available"
		}

		history = append(history, entry)
	}

	// Return empty array if no history found
	if history == nil {
		history = []map[string]interface{}{}
	}

	bytes, err := json.Marshal(history)
	if err != nil {
		return "", fmt.Errorf("failed to marshal history: %v", err)
	}

	return string(bytes), nil
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers (not exposed as chaincode functions)
// ─────────────────────────────────────────────────────────────────────────────

// checkInsuranceConsent reads the tourist record and checks the consent flag.
func checkInsuranceConsent(
	ctx contractapi.TransactionContextInterface,
	touristID string,
) (bool, error) {
	if touristID == "" {
		return false, fmt.Errorf("touristID is required for consent check")
	}

	data, err := ctx.GetStub().GetState("TOURIST_" + touristID)
	if err != nil {
		return false, fmt.Errorf("failed to read tourist state: %v", err)
	}
	if data == nil {
		// Tourist not found — default to no consent
		return false, nil
	}

	var tourist Tourist
	if err := json.Unmarshal(data, &tourist); err != nil {
		return false, fmt.Errorf("failed to unmarshal tourist: %v", err)
	}

	return tourist.InsuranceConsent, nil
}

// valueOrDefault returns the value if non-empty, otherwise returns the default.
func valueOrDefault(value, defaultValue string) string {
	if value == "" {
		return defaultValue
	}
	return value
}
