// org_b.go — Emergency Services (Org2MSP) functions.
// These are WRITE operations: dispatch responders, update status, close incidents.
package main

import (
	"encoding/json"
	"fmt"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// ─────────────────────────────────────────────────────────────────────────────
// LogDispatch records a responder dispatch to an SOS incident.
// ─────────────────────────────────────────────────────────────────────────────

func (s *SafetyContract) LogDispatch(
	ctx contractapi.TransactionContextInterface,
	dispatchID, incidentID, responderID, responderType, dispatchedAt string,
) error {
	// Validate required fields
	if dispatchID == "" || incidentID == "" || responderID == "" || responderType == "" || dispatchedAt == "" {
		return fmt.Errorf("all parameters required: dispatchID, incidentID, responderID, responderType, dispatchedAt")
	}

	// Verify incident exists
	incidentData, err := ctx.GetStub().GetState("SOS_" + incidentID)
	if err != nil {
		return fmt.Errorf("failed to read state: %v", err)
	}
	if incidentData == nil {
		return fmt.Errorf("SOS incident %s not found — cannot dispatch", incidentID)
	}

	// Validate responderType
	if !ValidResponderTypes[responderType] {
		return fmt.Errorf("invalid responderType: must be medical, fire, or police")
	}

	// Check dispatch does not already exist
	existing, err := ctx.GetStub().GetState("DISPATCH_" + dispatchID)
	if err != nil {
		return fmt.Errorf("failed to read state: %v", err)
	}
	if existing != nil {
		return fmt.Errorf("dispatch %s already exists", dispatchID)
	}

	dispatch := DispatchEvent{
		DocType:       "DISPATCH",
		DispatchID:    dispatchID,
		IncidentID:    incidentID,
		ResponderID:   responderID,
		ResponderType: responderType,
		Status:        "en_route",
		DispatchedAt:  dispatchedAt,
	}

	bytes, err := json.Marshal(dispatch)
	if err != nil {
		return fmt.Errorf("failed to marshal dispatch: %v", err)
	}

	if err := ctx.GetStub().PutState("DISPATCH_"+dispatchID, bytes); err != nil {
		return fmt.Errorf("failed to write dispatch: %v", err)
	}

	ctx.GetStub().SetEvent("DispatchSent", bytes)
	return nil
}

// ─────────────────────────────────────────────────────────────────────────────
// UpdateResponderStatus updates a dispatch record's status.
// Valid transitions: en_route → on_scene → complete
// ─────────────────────────────────────────────────────────────────────────────

func (s *SafetyContract) UpdateResponderStatus(
	ctx contractapi.TransactionContextInterface,
	dispatchID, status, timestamp string,
) error {
	if dispatchID == "" || status == "" || timestamp == "" {
		return fmt.Errorf("all parameters required: dispatchID, status, timestamp")
	}

	if !ValidDispatchStatuses[status] {
		return fmt.Errorf("invalid status: must be en_route, on_scene, or complete")
	}

	data, err := ctx.GetStub().GetState("DISPATCH_" + dispatchID)
	if err != nil {
		return fmt.Errorf("failed to read state: %v", err)
	}
	if data == nil {
		return fmt.Errorf("dispatch %s not found", dispatchID)
	}

	var dispatch DispatchEvent
	if err := json.Unmarshal(data, &dispatch); err != nil {
		return fmt.Errorf("failed to unmarshal dispatch: %v", err)
	}

	dispatch.Status = status
	if status == "complete" {
		dispatch.ClosedAt = timestamp
	}

	bytes, err := json.Marshal(dispatch)
	if err != nil {
		return fmt.Errorf("failed to marshal dispatch: %v", err)
	}

	if err := ctx.GetStub().PutState("DISPATCH_"+dispatchID, bytes); err != nil {
		return fmt.Errorf("failed to update dispatch: %v", err)
	}

	ctx.GetStub().SetEvent("ResponderStatusUpdated", bytes)
	return nil
}

// ─────────────────────────────────────────────────────────────────────────────
// CloseIncident marks an SOS incident as closed with an outcome.
// ─────────────────────────────────────────────────────────────────────────────

func (s *SafetyContract) CloseIncident(
	ctx contractapi.TransactionContextInterface,
	incidentID, outcome, closedBy, timestamp string,
) error {
	if incidentID == "" || outcome == "" || closedBy == "" || timestamp == "" {
		return fmt.Errorf("all parameters required: incidentID, outcome, closedBy, timestamp")
	}

	if !ValidOutcomes[outcome] {
		return fmt.Errorf("invalid outcome: must be responded, false_alarm, or tourist_safe")
	}

	data, err := ctx.GetStub().GetState("SOS_" + incidentID)
	if err != nil {
		return fmt.Errorf("failed to read state: %v", err)
	}
	if data == nil {
		return fmt.Errorf("SOS incident %s not found", incidentID)
	}

	var event SOSEvent
	if err := json.Unmarshal(data, &event); err != nil {
		return fmt.Errorf("failed to unmarshal SOS event: %v", err)
	}

	// Prevent closing an already closed incident
	if event.Status == "closed" {
		return fmt.Errorf("SOS incident %s is already closed", incidentID)
	}

	event.Status = "closed"
	event.Outcome = outcome
	event.ClosedAt = timestamp
	event.ClosedBy = closedBy

	bytes, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal SOS event: %v", err)
	}

	if err := ctx.GetStub().PutState("SOS_"+incidentID, bytes); err != nil {
		return fmt.Errorf("failed to update SOS event: %v", err)
	}

	ctx.GetStub().SetEvent("IncidentClosed", bytes)
	return nil
}

// ─────────────────────────────────────────────────────────────────────────────
// GetDispatch retrieves a dispatch record by dispatch ID.
// ─────────────────────────────────────────────────────────────────────────────

func (s *SafetyContract) GetDispatch(
	ctx contractapi.TransactionContextInterface,
	dispatchID string,
) (*DispatchEvent, error) {
	if dispatchID == "" {
		return nil, fmt.Errorf("dispatchID is required")
	}

	data, err := ctx.GetStub().GetState("DISPATCH_" + dispatchID)
	if err != nil {
		return nil, fmt.Errorf("failed to read state: %v", err)
	}
	if data == nil {
		return nil, fmt.Errorf("dispatch %s not found", dispatchID)
	}

	var dispatch DispatchEvent
	if err := json.Unmarshal(data, &dispatch); err != nil {
		return nil, fmt.Errorf("failed to unmarshal dispatch: %v", err)
	}

	return &dispatch, nil
}
