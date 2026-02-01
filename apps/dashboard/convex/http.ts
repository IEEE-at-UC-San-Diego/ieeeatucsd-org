/**
 * Convex HTTP Routes
 *
 * This file re-exports the Logto webhook router.
 * Convex will automatically register all exported http routers in the convex/ directory.
 *
 * The webhook handler for Logto events is defined in webhooks/logto.ts
 *
 * @module convex/http
 */

// Re-export the Logto webhook router
// Convex will automatically load this file and register the http routes
export { default } from './webhooks/logto';
