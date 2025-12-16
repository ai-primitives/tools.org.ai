/**
 * Beads SQLite Schema - Drizzle ORM definitions
 *
 * This schema matches the beads issue tracker SQLite database structure.
 * Use this for direct database access with full type safety.
 *
 * @packageDocumentation
 */

import { sqliteTable, text, integer, index, primaryKey } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'

// =============================================================================
// Core Tables
// =============================================================================

/**
 * Issues table - the core work item entity
 */
export const issues = sqliteTable('issues', {
  // Identity
  id: text('id').primaryKey(),
  contentHash: text('content_hash'),

  // What & Why
  title: text('title').notNull(),
  description: text('description').notNull().default(''),

  // How (implementation approach)
  design: text('design').notNull().default(''),

  // Done (success criteria)
  acceptanceCriteria: text('acceptance_criteria').notNull().default(''),

  // Context (session handoff)
  notes: text('notes').notNull().default(''),

  // Status
  status: text('status', { enum: ['open', 'in_progress', 'blocked', 'closed'] }).notNull().default('open'),
  priority: integer('priority').notNull().default(2), // 0=critical, 1=high, 2=normal, 3=low
  issueType: text('issue_type', { enum: ['task', 'bug', 'feature', 'epic', 'chore'] }).notNull().default('task'),

  // Assignment
  assignee: text('assignee'),

  // Timing
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  closedAt: text('closed_at'),
  closeReason: text('close_reason').default(''),

  // Estimation
  estimatedMinutes: integer('estimated_minutes'),

  // External references
  externalRef: text('external_ref'),
  sourceRepo: text('source_repo').default('.'),

  // Compaction (for long-running issues)
  compactionLevel: integer('compaction_level').default(0),
  compactedAt: text('compacted_at'),
  compactedAtCommit: text('compacted_at_commit'),
  originalSize: integer('original_size'),

  // Soft delete
  deletedAt: text('deleted_at'),
  deletedBy: text('deleted_by').default(''),
  deleteReason: text('delete_reason').default(''),
  originalType: text('original_type').default(''),
}, (table) => ({
  statusIdx: index('idx_issues_status').on(table.status),
  priorityIdx: index('idx_issues_priority').on(table.priority),
  assigneeIdx: index('idx_issues_assignee').on(table.assignee),
  createdAtIdx: index('idx_issues_created_at').on(table.createdAt),
  externalRefIdx: index('idx_issues_external_ref').on(table.externalRef),
  sourceRepoIdx: index('idx_issues_source_repo').on(table.sourceRepo),
}))

/**
 * Dependencies table - relationships between issues
 */
export const dependencies = sqliteTable('dependencies', {
  issueId: text('issue_id').notNull().references(() => issues.id, { onDelete: 'cascade' }),
  dependsOnId: text('depends_on_id').notNull().references(() => issues.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['blocks', 'related', 'parent-child', 'discovered-from'] }).notNull().default('blocks'),
  createdAt: text('created_at').notNull(),
  createdBy: text('created_by').notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.issueId, table.dependsOnId] }),
  issueIdx: index('idx_dependencies_issue').on(table.issueId),
  dependsOnIdx: index('idx_dependencies_depends_on').on(table.dependsOnId),
  dependsOnTypeIdx: index('idx_dependencies_depends_on_type').on(table.dependsOnId, table.type),
}))

/**
 * Labels table - tags for issues
 */
export const labels = sqliteTable('labels', {
  issueId: text('issue_id').notNull().references(() => issues.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.issueId, table.label] }),
  labelIdx: index('idx_labels_label').on(table.label),
}))

/**
 * Comments table - discussion on issues
 */
export const comments = sqliteTable('comments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  issueId: text('issue_id').notNull().references(() => issues.id, { onDelete: 'cascade' }),
  author: text('author').notNull(),
  text: text('text').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  issueIdx: index('idx_comments_issue').on(table.issueId),
  createdAtIdx: index('idx_comments_created_at').on(table.createdAt),
}))

/**
 * Events table - audit trail
 */
export const events = sqliteTable('events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  issueId: text('issue_id').notNull().references(() => issues.id, { onDelete: 'cascade' }),
  eventType: text('event_type').notNull(),
  actor: text('actor').notNull(),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  comment: text('comment'),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  issueIdx: index('idx_events_issue').on(table.issueId),
  createdAtIdx: index('idx_events_created_at').on(table.createdAt),
}))

// =============================================================================
// Internal/Admin Tables
// =============================================================================

/**
 * Config table - key-value configuration
 */
export const config = sqliteTable('config', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})

/**
 * Metadata table - key-value metadata
 */
export const metadata = sqliteTable('metadata', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})

/**
 * Dirty issues table - tracks issues needing JSONL export
 */
export const dirtyIssues = sqliteTable('dirty_issues', {
  issueId: text('issue_id').primaryKey().references(() => issues.id, { onDelete: 'cascade' }),
  markedAt: text('marked_at').notNull(),
  contentHash: text('content_hash'),
}, (table) => ({
  markedAtIdx: index('idx_dirty_issues_marked_at').on(table.markedAt),
}))

/**
 * Export hashes table - content hashing for collision detection
 */
export const exportHashes = sqliteTable('export_hashes', {
  issueId: text('issue_id').primaryKey().references(() => issues.id, { onDelete: 'cascade' }),
  contentHash: text('content_hash').notNull(),
  exportedAt: text('exported_at').notNull(),
})

/**
 * Child counters table - parent-child hierarchy counters
 */
export const childCounters = sqliteTable('child_counters', {
  parentId: text('parent_id').primaryKey().references(() => issues.id, { onDelete: 'cascade' }),
  lastChild: integer('last_child').notNull().default(0),
})

/**
 * Blocked issues cache - performance cache
 */
export const blockedIssuesCache = sqliteTable('blocked_issues_cache', {
  issueId: text('issue_id').primaryKey().references(() => issues.id, { onDelete: 'cascade' }),
})

// =============================================================================
// Relations
// =============================================================================

export const issuesRelations = relations(issues, ({ many }) => ({
  // Dependencies where this issue is the dependent
  dependencies: many(dependencies, { relationName: 'issueDependencies' }),
  // Dependencies where this issue is depended upon
  dependents: many(dependencies, { relationName: 'issueDependents' }),
  // Labels
  labels: many(labels),
  // Comments
  comments: many(comments),
  // Events
  events: many(events),
}))

export const dependenciesRelations = relations(dependencies, ({ one }) => ({
  issue: one(issues, {
    fields: [dependencies.issueId],
    references: [issues.id],
    relationName: 'issueDependencies',
  }),
  dependsOn: one(issues, {
    fields: [dependencies.dependsOnId],
    references: [issues.id],
    relationName: 'issueDependents',
  }),
}))

export const labelsRelations = relations(labels, ({ one }) => ({
  issue: one(issues, {
    fields: [labels.issueId],
    references: [issues.id],
  }),
}))

export const commentsRelations = relations(comments, ({ one }) => ({
  issue: one(issues, {
    fields: [comments.issueId],
    references: [issues.id],
  }),
}))

export const eventsRelations = relations(events, ({ one }) => ({
  issue: one(issues, {
    fields: [events.issueId],
    references: [issues.id],
  }),
}))

// =============================================================================
// Types
// =============================================================================

export type Issue = typeof issues.$inferSelect
export type NewIssue = typeof issues.$inferInsert

export type Dependency = typeof dependencies.$inferSelect
export type NewDependency = typeof dependencies.$inferInsert

export type Label = typeof labels.$inferSelect
export type NewLabel = typeof labels.$inferInsert

export type Comment = typeof comments.$inferSelect
export type NewComment = typeof comments.$inferInsert

export type Event = typeof events.$inferSelect
export type NewEvent = typeof events.$inferInsert

// Dependency type enum
export const DependencyType = {
  blocks: 'blocks',
  related: 'related',
  parentChild: 'parent-child',
  discoveredFrom: 'discovered-from',
} as const

export type DependencyTypeValue = (typeof DependencyType)[keyof typeof DependencyType]

// Issue status enum
export const IssueStatus = {
  open: 'open',
  inProgress: 'in_progress',
  blocked: 'blocked',
  closed: 'closed',
} as const

export type IssueStatusValue = (typeof IssueStatus)[keyof typeof IssueStatus]

// Issue type enum
export const IssueType = {
  task: 'task',
  bug: 'bug',
  feature: 'feature',
  epic: 'epic',
  chore: 'chore',
} as const

export type IssueTypeValue = (typeof IssueType)[keyof typeof IssueType]

// Priority levels (0=critical, 1=high, 2=normal, 3=low)
export const Priority = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
} as const

export type PriorityValue = (typeof Priority)[keyof typeof Priority]
