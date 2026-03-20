// Package main is the entry point for the Tourist Safety System chaincode.
// It registers the SafetyContract with the Fabric runtime.
package main

import (
	"log"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// SafetyContract implements the tourist safety chaincode.
// All org-specific functions are defined as methods on this struct
// in org_a.go, org_b.go, and org_c.go.
type SafetyContract struct {
	contractapi.Contract
}

func main() {
	chaincode, err := contractapi.NewChaincode(&SafetyContract{})
	if err != nil {
		log.Panicf("Error creating SafetyContract chaincode: %v", err)
	}

	if err := chaincode.Start(); err != nil {
		log.Panicf("Error starting SafetyContract chaincode: %v", err)
	}
}
