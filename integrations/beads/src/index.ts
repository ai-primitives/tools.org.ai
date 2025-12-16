/**
 * @tools.org.ai/beads - Beads Integration for tools.org.ai
 *
 * Provides TypeScript SDK for the beads issue tracker with Drizzle ORM.
 * Enables direct SQLite database access with full type safety.
 *
 * ## Installation
 *
 * ```bash
 * pnpm add @tools.org.ai/beads
 * ```
 *
 * ## Usage
 *
 * ```ts
 * import { createBeadsAdapter } from '@tools.org.ai/beads'
 *
 * // Connect to existing beads database
 * const beads = createBeadsAdapter({
 *   dbPath: '.beads/beads.db',
 * })
 *
 * // Create an issue
 * const issue = await beads.createIssue({
 *   title: 'Implement feature X',
 *   description: 'Why this matters',
 *   design: 'How to build it',
 *   acceptanceCriteria: '- [ ] Criteria 1\\n- [ ] Criteria 2',
 * })
 *
 * // Get ready issues (no blockers)
 * const ready = await beads.getReadyIssues()
 *
 * // Close when done
 * beads.close()
 * ```
 *
 * ## Schema Access
 *
 * For advanced queries, import the Drizzle schema directly:
 *
 * ```ts
 * import { issues, dependencies, labels } from '@tools.org.ai/beads/schema'
 * import { drizzle } from 'drizzle-orm/better-sqlite3'
 *
 * const db = drizzle(sqlite, { schema })
 * const results = await db.select().from(issues).where(...)
 * ```
 *
 * @packageDocumentation
 */

// Re-export schema
export * from './schema.js'

// Re-export adapter
export * from './adapter.js'

// Default export is the factory function
export { createBeadsAdapter as default } from './adapter.js'
