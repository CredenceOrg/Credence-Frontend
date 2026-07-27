# Telemetry & Analytics

This document describes the telemetry and analytics practices for the Credence Frontend application.

## Overview

**No telemetry or analytics data is collected by this application.**

The Credence Frontend is designed with privacy as a core principle. We do not:
- Track user behavior
- Collect personal identifiable information (PII)
- Use third-party analytics services (e.g., Google Analytics, Segment, Amplitude, Mixpanel)
- Send any usage data to external servers

# Telemetry & Event Schema Registry

This document describes the telemetry principles and centralized event schema architecture for the Credence Frontend application.

## Overview & Privacy Principles

**No telemetry or analytics data is transmitted to external servers.**

The Credence Frontend is designed with privacy as a core principle. We do not:
- Track user behavior externally
- Collect personal identifiable information (PII)
- Use third-party analytics services (e.g., Google Analytics, Segment, Amplitude, Mixpanel)
- Send usage telemetry data to remote endpoints

---

## Centralized Event Schema Registry

All internal domain events, application protocol states, and system DOM event constants are maintained in a centralized event schema registry located at:

```
src/events/schema.ts (re-exported via src/events/index.ts)
```

### Why Centralization Prevents Schema Drift

In distributed front-end codebases, event name string literals and payload type interfaces often drift across producers (event emitters/forms/pages) and consumers (components/hooks/handlers). 

Centralization provides:
1. **Single Source of Truth**: All event names, constants, and payload interfaces are defined once.
2. **Compile-Time Safety**: TypeScript strictly enforces payload shapes across all publishers and subscribers.
3. **Deterministic Serialization**: Helper utilities (`serializeEventPayload`, `deserializeEventPayload`) ensure payload structures remain consistent.
4. **Versioning Support**: An explicit `EVENT_SCHEMA_VERSION` (currently `1.0.0`) tracks schema contract revisions.

---

## Event Catalog

### 1. System & DOM Events (`DOM_EVENTS`)
- `BEFORE_INSTALL_PROMPT`: PWA installation trigger
- `VISIBILITY_CHANGE`: Document tab visibility monitoring
- `MOUSE_MOVE`, `KEY_DOWN`, `MOUSE_DOWN`, `TOUCH_START`, `SCROLL`, `WHEEL`: User activity events for idle timeout management
- `ONLINE`, `OFFLINE`: Connectivity state updates
- `BEFORE_UNLOAD`: Navigation warning for unsaved form state
- `FOCUS`: Window re-focus listener for wallet network re-syncing
- `CHANGE`: Media query preference change listeners (reduced motion, reduced transparency, system theme)
- `LANGUAGE_CHANGED`: i18n locale change notification

### 2. Domain Events & Payloads
- **Attestation Events (`ATTESTATION_EVENTS`)**: `AttestationPayload` (`identity`, `peer-vouch`, `credential`)
- **Transaction Events (`TRANSACTION_EVENTS`)**: `TransactionEventPayload` (`bond`, `withdraw`, `attestation`) with status (`pending`, `confirmed`, `failed`)
- **Bond Lifecycle (`BOND_EVENTS`)**: `BondEventPayload` with status (`active`, `pending`, `settled`, `slashed`, `cancelled`)
- **Activity Feed (`ACTIVITY_EVENTS`)**: `ActivityEventPayload` with tones (`success`, `warning`, `info`)
- **Toast Notifications (`TOAST_EVENTS`)**: `ToastEventPayload` with severities (`info`, `success`, `warning`, `danger`)
- **Wallet Connection (`WALLET_EVENTS`)**: `WalletEventPayload` with status (`connected`, `disconnected`, `connecting`, `network_mismatch`)
- **Settings State (`SETTINGS_EVENTS`)**: `SettingsEventPayload`

---

## How to Work with Event Schemas

### Adding a New Event
1. Open [src/events/schema.ts](file:///c:/Users/ICT%20LASIEC/Credence-Frontend/src/events/schema.ts).
2. Define the new event name constant under the appropriate domain object (or add a new domain object).
3. Export the payload interface `export interface MyNewEventPayload { ... }`.
4. Add unit test coverage in [src/events/schema.test.ts](file:///c:/Users/ICT%20LASIEC/Credence-Frontend/src/events/schema.test.ts).

### Modifying Existing Events Safely
1. Always preserve backwards compatibility for public/persisted fields.
2. If introducing new fields, make them optional (`field?: type`) to avoid breaking existing consumers.
3. If breaking changes are unavoidable:
   - Bump `EVENT_SCHEMA_VERSION`.
   - Update all consumers and producers simultaneously.
   - Add migration handling in `deserializeEventPayload`.

---

## Further Reading

- [Architecture Overview](./ARCHITECTURE.md)
- [State Management](./STATE_MANAGEMENT.md)
- [Security Documentation](./SECURITY.md)

