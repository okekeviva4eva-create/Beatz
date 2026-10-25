/**
 * Security Rules Specification Suite (Phase 0: Dirty Dozen Payload Verification)
 * Verifies that all 12 Dirty Dozen payloads targeting /patches/{patchId} are rejected
 * with PERMISSION_DENIED by firestore.rules.
 */

export interface SecurityTestPayload {
  id: number;
  name: string;
  auth: { uid: string; email_verified: boolean } | null;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED' | 'ALLOWED';
}

const VALID_BASE_PATCH = {
  ownerId: 'user_1',
  authorName: 'DJ Premier',
  name: 'MPC 3000 Boom Bap Kit',
  programId: 1,
  bpm: 94,
  timeDivision: '1/16',
  arpMode: 'UP',
  arpOctaves: 2,
  swing: 57,
  k1Cutoff: 88,
  k2Resonance: 32,
  k3Attack: 10,
  k4Release: 48,
  k5Detune: 24,
  k6SubMix: 60,
  k7DelayMix: 30,
  k8ReverbMix: 40,
  createdAt: 'SERVER_TIMESTAMP',
  updatedAt: 'SERVER_TIMESTAMP',
};

export const DIRTY_DOZEN_TESTS: SecurityTestPayload[] = [
  {
    id: 1,
    name: 'Unauthenticated Write',
    auth: null,
    operation: 'create',
    path: '/patches/patch_01',
    payload: VALID_BASE_PATCH,
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified Email Write',
    auth: { uid: 'user_1', email_verified: false },
    operation: 'create',
    path: '/patches/patch_01',
    payload: VALID_BASE_PATCH,
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Identity Spoofing on Create',
    auth: { uid: 'user_1', email_verified: true },
    operation: 'create',
    path: '/patches/patch_01',
    payload: { ...VALID_BASE_PATCH, ownerId: 'user_2' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Shadow Field Injection on Create',
    auth: { uid: 'user_1', email_verified: true },
    operation: 'create',
    path: '/patches/patch_01',
    payload: { ...VALID_BASE_PATCH, isAdmin: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Oversized String Denial of Wallet',
    auth: { uid: 'user_1', email_verified: true },
    operation: 'create',
    path: '/patches/patch_01',
    payload: { ...VALID_BASE_PATCH, name: 'X'.repeat(500) },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Out-of-Range Knob Value',
    auth: { uid: 'user_1', email_verified: true },
    operation: 'create',
    path: '/patches/patch_01',
    payload: { ...VALID_BASE_PATCH, k1Cutoff: 999 },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Invalid Enum Value for arpMode',
    auth: { uid: 'user_1', email_verified: true },
    operation: 'create',
    path: '/patches/patch_01',
    payload: { ...VALID_BASE_PATCH, arpMode: 'DIAGONAL' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Forged Client Timestamp on Create',
    auth: { uid: 'user_1', email_verified: true },
    operation: 'create',
    path: '/patches/patch_01',
    payload: { ...VALID_BASE_PATCH, createdAt: '2020-01-01T00:00:00Z' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Immutable ownerId Mutation on Update',
    auth: { uid: 'user_1', email_verified: true },
    operation: 'update',
    path: '/patches/patch_01',
    payload: { ...VALID_BASE_PATCH, ownerId: 'user_2' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Shadow Field Injection on Update',
    auth: { uid: 'user_1', email_verified: true },
    operation: 'update',
    path: '/patches/patch_01',
    payload: { ...VALID_BASE_PATCH, verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Cross-Tenant Read/Get Attempt',
    auth: { uid: 'user_2', email_verified: true },
    operation: 'get',
    path: '/patches/patch_01',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Path ID Poisoning with Illegal Characters',
    auth: { uid: 'user_1', email_verified: true },
    operation: 'create',
    path: '/patches/patch$bad!id',
    payload: VALID_BASE_PATCH,
    expectedResult: 'PERMISSION_DENIED',
  },
];
