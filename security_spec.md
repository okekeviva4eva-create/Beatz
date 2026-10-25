# Security Specification — AKAI MPK mini Studio

## 1. Data Invariants
1. **Default Deny**: All paths not explicitly matched in `/patches/{patchId}` are unconditionally denied (`allow read, write: if false`).
2. **Authentication & Email Verification**: All reads and writes to `/patches/{patchId}` require `request.auth != null`, and all writes (`create`, `update`, `delete`) require `request.auth.token.email_verified == true`.
3. **Strict Ownership Isolation**: A user may only `get`, `list`, `create`, `update`, or `delete` documents in `/patches/{patchId}` where `ownerId == request.auth.uid`. Blanket reads are prohibited.
4. **Path ID Hardening**: `patchId` on single-document operations (`get`, `create`, `update`, `delete`) must satisfy `isValidId(patchId)` (`^[a-zA-Z0-9_\-]+$`, max 128 chars).
5. **Strict Key & Schema Validation**: `isValidSynthPatch(data)` enforces exact required and allowed keys (`hasAll` and `hasOnly`), bounded string sizes (`name` 1..80, `authorName` 1..80), enum membership for `timeDivision` and `arpMode`, numeric bounds for `programId` (1..4), `bpm` (40..220), `arpOctaves` (1..4), `swing` (50..64), and knobs `k1Cutoff`..`k8ReverbMix` (0..127).
6. **Temporal & Identity Immutability**: On `create`, `createdAt == request.time` and `updatedAt == request.time`. On `update`, `ownerId` and `createdAt` are immutable, `updatedAt == request.time`, and `affectedKeys().hasOnly(...)` restricts modifications to mutable patch fields.

## 2. The "Dirty Dozen" Payloads
1. **Unauthenticated Write**: `auth = null`, creating a valid `SynthPatch` -> `PERMISSION_DENIED`.
2. **Unverified Email Write**: `auth = { uid: 'user_1', token: { email_verified: false } }` -> `PERMISSION_DENIED`.
3. **Identity Spoofing on Create**: `auth.uid = 'user_1'`, payload `ownerId = 'user_2'` -> `PERMISSION_DENIED`.
4. **Shadow Field Injection on Create**: Payload includes extra key `isAdmin: true` -> `PERMISSION_DENIED`.
5. **Oversized String ("Denial of Wallet")**: Payload `name` has length 500 (> 80 max) -> `PERMISSION_DENIED`.
6. **Out-of-Range Knob Value**: Payload `k1Cutoff = 999` (> 127 max) -> `PERMISSION_DENIED`.
7. **Invalid Enum Value**: Payload `arpMode = 'DIAGONAL'` -> `PERMISSION_DENIED`.
8. **Forged Client Timestamp on Create**: Payload `createdAt` is a client string or past timestamp (`!= request.time`) -> `PERMISSION_DENIED`.
9. **Immutable Field Mutation on Update**: Updating `ownerId` or `createdAt` on an existing patch -> `PERMISSION_DENIED`.
10. **Shadow Field Injection on Update**: Updating `name` alongside an unauthorized ghost field `verified: true` -> `PERMISSION_DENIED`.
11. **Cross-Tenant Read/Get**: `auth.uid = 'user_2'` attempting `get` on a patch where `resource.data.ownerId == 'user_1'` -> `PERMISSION_DENIED`.
12. **Path ID Poisoning**: Creating a document with path ID containing spaces or special characters `patch$bad!id` -> `PERMISSION_DENIED`.
