# Engineering Standards and Implementation Guide

**Core Principle:** Data-driven logic, modular architecture, and comprehensive documentation.

This document outlines the mandatory coding and documentation standards for all developers working on the Tourist Safety System. Adherence to these guidelines ensures system maintainability and seamless collaboration between Team A and Team B.

---

## 1. Data Integrity and Backend Integration

**Requirement:** All application state must be derived from the backend services. Hardcoding is prohibited unless used as a temporary development fallback.

### Dynamic Data Fetching
- Components must fetch data via asynchronous services or hooks.
- Logic must never rely on static production-like strings (e.g., user names, IDs, or status codes) embedded directly in the frontend.

### Fallback and Hardcoding Protocol
When data is unavailable or hardcoding is strictly necessary for testing, developers must use the **Explicit Placeholder Pattern**. This ensures that placeholder data is never mistaken for production data during code reviews or quality assurance.

| Scenario | Format | Example |
| :--- | :--- | :--- |
| **Missing String** | `[FIELD]_NOT_AVAL` | `const userName = "NAME_NOT_AVAL";` |
| **Missing Data** | `[DATA]_NOT_AVAL` | `const userAddress = "DATA_NOT_AVAL";` |
| **Pending Logic** | `LOGIC_PENDING_[FEATURE]` | `return "LOGIC_PENDING_SOS_CALC";` |
| **Null Fallback** | `NULL_NOT_AVAL` | `const result = "NULL_NOT_AVAL";` |

---

## 2. Modular Architecture and Separation of Concerns

To facilitate simultaneous development across teams, the codebase must remain highly decoupled.

- **Service Layer:** All API interactions must be encapsulated within a dedicated service layer (e.g., `src/services/` or `src/api/`). UI components must interact with abstracted methods (e.g., `ApiService.getZones()`) rather than direct HTTP clients.
- **Logic vs. View:** Business logic, data transformations, and validation must be separated from UI components. Utilize custom hooks, controllers, or utility functions to maintain this boundary.
- **Utility Modules:** Generic helpers (e.g., GeoJSON parsing, date formatting) must be placed in a centralized `src/utils/` directory.

---

## 3. Code Readability and Comments

Code must be written for human readability.

- **Variable Naming:** Use descriptive, intentional names (e.g., `isEmergencyActive` instead of `active`).
- **Inline Documentation:** Use JSDoc or TSDoc for complex functions. Comments should focus on the **rationale** (why) rather than the syntax (what).
- **Type Safety:** TypeScript interfaces must be used for all data structures, mirroring the definitions in the API contract.

---

## 4. Documentation Standards (/docs folder)

Documentation is a primary deliverable. Every feature and implementation detail must be recorded in the `docs/` directory to ensure effortless onboarding and cross-team alignment.

### Directory Structure
The `docs/` folder should be organized into sub-folders based on context:

* `docs/api/`: Technical details regarding endpoint logic, request/response lifecycle, and error handling.
* `docs/features/`: High-level functional explanations (e.g., `sos-workflow.md`, `kyc-verification.md`).
* `docs/setup/`: Instructions for environment configuration, dependencies, and local deployment.
* `docs/architecture/`: Documentation of system design patterns and major technical decisions.

---

## 5. Development Checklist

Before submitting a Pull Request, ensure the following:
- [ ] All data is sourced from the backend or follows the `_NOT_AVAL` placeholder pattern.
- [ ] Logic is decoupled from the UI layer.
- [ ] New features or workflows are documented in the `docs/` folder.
- [ ] Code is formatted according to project standards and includes necessary comments.
