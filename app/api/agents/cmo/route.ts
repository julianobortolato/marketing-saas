// Gradual rename: /api/agents/cmo → canonical path (ADR-MKT-005 §2).
// /api/webhooks/evolution kept alive until Evolution instance is reconfigured.
// Remove /api/webhooks/evolution/route.ts after confirming Evolution hits this URL.
export { POST } from '../../webhooks/evolution/route'
export const runtime = 'edge'
