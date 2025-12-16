/**
 * Beads Adapter - Typed operations for beads SQLite database
 *
 * Provides CRUD operations and queries for the beads issue tracker.
 * Wraps Drizzle ORM with beads-specific logic.
 *
 * @packageDocumentation
 */

import { eq, and, or, inArray, isNull, sql, desc, asc } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import * as schema from './schema.js'
import type {
  Issue,
  NewIssue,
  Dependency,
  NewDependency,
  Comment,
  NewComment,
  Event,
  NewEvent,
  IssueStatusValue,
  IssueTypeValue,
  PriorityValue,
  DependencyTypeValue,
} from './schema.js'

// =============================================================================
// Types
// =============================================================================

export interface BeadsConfig {
  /** Path to the SQLite database file */
  dbPath: string
  /** Whether to create the database if it doesn't exist */
  createIfMissing?: boolean
}

export interface CreateIssueOptions {
  title: string
  description?: string
  design?: string
  acceptanceCriteria?: string
  notes?: string
  status?: IssueStatusValue
  priority?: PriorityValue
  issueType?: IssueTypeValue
  assignee?: string
  labels?: string[]
  estimatedMinutes?: number
  externalRef?: string
}

export interface UpdateIssueOptions {
  title?: string
  description?: string
  design?: string
  acceptanceCriteria?: string
  notes?: string
  status?: IssueStatusValue
  priority?: PriorityValue
  issueType?: IssueTypeValue
  assignee?: string
  estimatedMinutes?: number
  externalRef?: string
}

export interface QueryOptions {
  status?: IssueStatusValue | IssueStatusValue[]
  priority?: PriorityValue | PriorityValue[]
  issueType?: IssueTypeValue | IssueTypeValue[]
  assignee?: string
  labels?: string[]
  limit?: number
  offset?: number
  orderBy?: 'createdAt' | 'updatedAt' | 'priority' | 'title'
  orderDir?: 'asc' | 'desc'
}

export interface IssueWithRelations extends Issue {
  labels: string[]
  dependencies: Dependency[]
  comments: Comment[]
}

// =============================================================================
// Adapter Class
// =============================================================================

/**
 * Beads adapter for typed database operations
 */
export class BeadsAdapter {
  private db: ReturnType<typeof drizzle>
  private sqlite: Database.Database

  constructor(config: BeadsConfig) {
    this.sqlite = new Database(config.dbPath, {
      readonly: false,
      fileMustExist: !config.createIfMissing,
    })
    this.db = drizzle(this.sqlite, { schema })
  }

  /**
   * Close the database connection
   */
  close() {
    this.sqlite.close()
  }

  // ===========================================================================
  // Issue CRUD
  // ===========================================================================

  /**
   * Generate a unique issue ID (hash-based like beads)
   */
  private generateId(): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2, 5)
    return `${timestamp}${random}`
  }

  /**
   * Get current ISO timestamp
   */
  private now(): string {
    return new Date().toISOString()
  }

  /**
   * Create a new issue
   */
  async createIssue(options: CreateIssueOptions): Promise<Issue> {
    const id = this.generateId()
    const now = this.now()

    const issue: NewIssue = {
      id,
      title: options.title,
      description: options.description || '',
      design: options.design || '',
      acceptanceCriteria: options.acceptanceCriteria || '',
      notes: options.notes || '',
      status: options.status || 'open',
      priority: options.priority ?? 2,
      issueType: options.issueType || 'task',
      assignee: options.assignee,
      estimatedMinutes: options.estimatedMinutes,
      externalRef: options.externalRef,
      createdAt: now,
      updatedAt: now,
    }

    await this.db.insert(schema.issues).values(issue)

    // Add labels if provided
    if (options.labels && options.labels.length > 0) {
      await this.db.insert(schema.labels).values(
        options.labels.map((label) => ({ issueId: id, label }))
      )
    }

    // Record creation event
    await this.db.insert(schema.events).values({
      issueId: id,
      eventType: 'created',
      actor: 'system',
      createdAt: now,
    })

    return this.getIssue(id) as Promise<Issue>
  }

  /**
   * Get an issue by ID
   */
  async getIssue(id: string): Promise<Issue | undefined> {
    const result = await this.db
      .select()
      .from(schema.issues)
      .where(and(eq(schema.issues.id, id), isNull(schema.issues.deletedAt)))
      .limit(1)

    return result[0]
  }

  /**
   * Get an issue with all its relations
   */
  async getIssueWithRelations(id: string): Promise<IssueWithRelations | undefined> {
    const issue = await this.getIssue(id)
    if (!issue) return undefined

    const [labels, dependencies, comments] = await Promise.all([
      this.db.select().from(schema.labels).where(eq(schema.labels.issueId, id)),
      this.db.select().from(schema.dependencies).where(eq(schema.dependencies.issueId, id)),
      this.db.select().from(schema.comments).where(eq(schema.comments.issueId, id)),
    ])

    return {
      ...issue,
      labels: labels.map((l) => l.label),
      dependencies,
      comments,
    }
  }

  /**
   * Update an issue
   */
  async updateIssue(id: string, options: UpdateIssueOptions): Promise<Issue | undefined> {
    const existing = await this.getIssue(id)
    if (!existing) return undefined

    const now = this.now()
    const updates: Partial<NewIssue> = {
      updatedAt: now,
    }

    // Track changes for events
    const changes: Array<{ field: string; oldValue: string; newValue: string }> = []

    if (options.title !== undefined && options.title !== existing.title) {
      updates.title = options.title
      changes.push({ field: 'title', oldValue: existing.title, newValue: options.title })
    }

    if (options.description !== undefined && options.description !== existing.description) {
      updates.description = options.description
      changes.push({ field: 'description', oldValue: existing.description, newValue: options.description })
    }

    if (options.design !== undefined && options.design !== existing.design) {
      updates.design = options.design
      changes.push({ field: 'design', oldValue: existing.design, newValue: options.design })
    }

    if (options.acceptanceCriteria !== undefined && options.acceptanceCriteria !== existing.acceptanceCriteria) {
      updates.acceptanceCriteria = options.acceptanceCriteria
      changes.push({ field: 'acceptanceCriteria', oldValue: existing.acceptanceCriteria, newValue: options.acceptanceCriteria })
    }

    if (options.notes !== undefined && options.notes !== existing.notes) {
      updates.notes = options.notes
      changes.push({ field: 'notes', oldValue: existing.notes, newValue: options.notes })
    }

    if (options.status !== undefined && options.status !== existing.status) {
      updates.status = options.status
      changes.push({ field: 'status', oldValue: existing.status, newValue: options.status })
    }

    if (options.priority !== undefined && options.priority !== existing.priority) {
      updates.priority = options.priority
      changes.push({ field: 'priority', oldValue: String(existing.priority), newValue: String(options.priority) })
    }

    if (options.issueType !== undefined && options.issueType !== existing.issueType) {
      updates.issueType = options.issueType
      changes.push({ field: 'issueType', oldValue: existing.issueType, newValue: options.issueType })
    }

    if (options.assignee !== undefined && options.assignee !== existing.assignee) {
      updates.assignee = options.assignee
      changes.push({ field: 'assignee', oldValue: existing.assignee || '', newValue: options.assignee })
    }

    if (Object.keys(updates).length > 1) {
      await this.db.update(schema.issues).set(updates).where(eq(schema.issues.id, id))

      // Record events for changes
      for (const change of changes) {
        await this.db.insert(schema.events).values({
          issueId: id,
          eventType: `${change.field}_changed`,
          actor: 'system',
          oldValue: change.oldValue,
          newValue: change.newValue,
          createdAt: now,
        })
      }
    }

    return this.getIssue(id)
  }

  /**
   * Close an issue
   */
  async closeIssue(id: string, reason?: string): Promise<Issue | undefined> {
    const existing = await this.getIssue(id)
    if (!existing) return undefined

    const now = this.now()

    await this.db.update(schema.issues).set({
      status: 'closed',
      closedAt: now,
      closeReason: reason || '',
      updatedAt: now,
    }).where(eq(schema.issues.id, id))

    await this.db.insert(schema.events).values({
      issueId: id,
      eventType: 'closed',
      actor: 'system',
      oldValue: existing.status,
      newValue: 'closed',
      comment: reason,
      createdAt: now,
    })

    return this.getIssue(id)
  }

  /**
   * Reopen a closed issue
   */
  async reopenIssue(id: string): Promise<Issue | undefined> {
    const existing = await this.getIssue(id)
    if (!existing || existing.status !== 'closed') return undefined

    const now = this.now()

    await this.db.update(schema.issues).set({
      status: 'open',
      closedAt: null,
      updatedAt: now,
    }).where(eq(schema.issues.id, id))

    await this.db.insert(schema.events).values({
      issueId: id,
      eventType: 'reopened',
      actor: 'system',
      oldValue: 'closed',
      newValue: 'open',
      createdAt: now,
    })

    return this.getIssue(id)
  }

  /**
   * Soft delete an issue
   */
  async deleteIssue(id: string, reason?: string): Promise<boolean> {
    const existing = await this.getIssue(id)
    if (!existing) return false

    const now = this.now()

    await this.db.update(schema.issues).set({
      deletedAt: now,
      deleteReason: reason || '',
      originalType: existing.issueType,
      updatedAt: now,
    }).where(eq(schema.issues.id, id))

    return true
  }

  // ===========================================================================
  // Queries
  // ===========================================================================

  /**
   * List issues with optional filters
   */
  async listIssues(options: QueryOptions = {}): Promise<Issue[]> {
    const conditions: ReturnType<typeof eq>[] = [isNull(schema.issues.deletedAt)]

    if (options.status) {
      const statuses = Array.isArray(options.status) ? options.status : [options.status]
      conditions.push(inArray(schema.issues.status, statuses))
    }

    if (options.priority !== undefined) {
      const priorities = Array.isArray(options.priority) ? options.priority : [options.priority]
      conditions.push(inArray(schema.issues.priority, priorities))
    }

    if (options.issueType) {
      const types = Array.isArray(options.issueType) ? options.issueType : [options.issueType]
      conditions.push(inArray(schema.issues.issueType, types))
    }

    if (options.assignee) {
      conditions.push(eq(schema.issues.assignee, options.assignee))
    }

    let query = this.db
      .select()
      .from(schema.issues)
      .where(and(...conditions))

    // Order
    const orderCol = options.orderBy === 'priority' ? schema.issues.priority
      : options.orderBy === 'updatedAt' ? schema.issues.updatedAt
      : options.orderBy === 'title' ? schema.issues.title
      : schema.issues.createdAt

    query = options.orderDir === 'asc'
      ? query.orderBy(asc(orderCol))
      : query.orderBy(desc(orderCol))

    // Pagination
    if (options.limit) {
      query = query.limit(options.limit)
    }
    if (options.offset) {
      query = query.offset(options.offset)
    }

    return query
  }

  /**
   * Get ready issues (no blockers)
   */
  async getReadyIssues(): Promise<Issue[]> {
    // Get all open issues
    const openIssues = await this.db
      .select()
      .from(schema.issues)
      .where(and(
        eq(schema.issues.status, 'open'),
        isNull(schema.issues.deletedAt)
      ))

    // Get all blocking dependencies for open issues
    const blockingDeps = await this.db
      .select()
      .from(schema.dependencies)
      .innerJoin(schema.issues, eq(schema.dependencies.dependsOnId, schema.issues.id))
      .where(and(
        eq(schema.dependencies.type, 'blocks'),
        inArray(schema.issues.status, ['open', 'in_progress', 'blocked'])
      ))

    const blockedIds = new Set(blockingDeps.map((d) => d.dependencies.issueId))

    return openIssues.filter((issue) => !blockedIds.has(issue.id))
  }

  /**
   * Get blocked issues
   */
  async getBlockedIssues(): Promise<Array<Issue & { blockedByCount: number }>> {
    const result = await this.db
      .select({
        issue: schema.issues,
        blockedByCount: sql<number>`count(${schema.dependencies.dependsOnId})`.as('blocked_by_count'),
      })
      .from(schema.issues)
      .innerJoin(schema.dependencies, eq(schema.issues.id, schema.dependencies.issueId))
      .innerJoin(
        schema.issues,
        and(
          eq(schema.dependencies.dependsOnId, schema.issues.id),
          inArray(schema.issues.status, ['open', 'in_progress', 'blocked'])
        )
      )
      .where(and(
        inArray(schema.issues.status, ['open', 'in_progress', 'blocked']),
        eq(schema.dependencies.type, 'blocks'),
        isNull(schema.issues.deletedAt)
      ))
      .groupBy(schema.issues.id)

    return result.map((r) => ({ ...r.issue, blockedByCount: r.blockedByCount }))
  }

  // ===========================================================================
  // Dependencies
  // ===========================================================================

  /**
   * Add a dependency between issues
   */
  async addDependency(
    fromId: string,
    toId: string,
    type: DependencyTypeValue = 'blocks'
  ): Promise<Dependency> {
    const now = this.now()

    const dep: NewDependency = {
      issueId: fromId,
      dependsOnId: toId,
      type,
      createdAt: now,
      createdBy: 'system',
    }

    await this.db.insert(schema.dependencies).values(dep)

    await this.db.insert(schema.events).values({
      issueId: fromId,
      eventType: 'dependency_added',
      actor: 'system',
      newValue: `${type}:${toId}`,
      createdAt: now,
    })

    return dep as Dependency
  }

  /**
   * Remove a dependency
   */
  async removeDependency(fromId: string, toId: string): Promise<boolean> {
    const result = await this.db
      .delete(schema.dependencies)
      .where(and(
        eq(schema.dependencies.issueId, fromId),
        eq(schema.dependencies.dependsOnId, toId)
      ))

    return true
  }

  /**
   * Get dependencies for an issue
   */
  async getDependencies(issueId: string): Promise<Dependency[]> {
    return this.db
      .select()
      .from(schema.dependencies)
      .where(eq(schema.dependencies.issueId, issueId))
  }

  /**
   * Get dependents (issues that depend on this one)
   */
  async getDependents(issueId: string): Promise<Dependency[]> {
    return this.db
      .select()
      .from(schema.dependencies)
      .where(eq(schema.dependencies.dependsOnId, issueId))
  }

  // ===========================================================================
  // Labels
  // ===========================================================================

  /**
   * Add a label to an issue
   */
  async addLabel(issueId: string, label: string): Promise<void> {
    await this.db.insert(schema.labels).values({ issueId, label }).onConflictDoNothing()

    await this.db.insert(schema.events).values({
      issueId,
      eventType: 'label_added',
      actor: 'system',
      newValue: label,
      createdAt: this.now(),
    })
  }

  /**
   * Remove a label from an issue
   */
  async removeLabel(issueId: string, label: string): Promise<void> {
    await this.db
      .delete(schema.labels)
      .where(and(eq(schema.labels.issueId, issueId), eq(schema.labels.label, label)))

    await this.db.insert(schema.events).values({
      issueId,
      eventType: 'label_removed',
      actor: 'system',
      oldValue: label,
      createdAt: this.now(),
    })
  }

  /**
   * Get labels for an issue
   */
  async getLabels(issueId: string): Promise<string[]> {
    const result = await this.db
      .select()
      .from(schema.labels)
      .where(eq(schema.labels.issueId, issueId))

    return result.map((l) => l.label)
  }

  // ===========================================================================
  // Comments
  // ===========================================================================

  /**
   * Add a comment to an issue
   */
  async addComment(issueId: string, text: string, author: string): Promise<Comment> {
    const now = this.now()

    const result = await this.db.insert(schema.comments).values({
      issueId,
      text,
      author,
      createdAt: now,
    }).returning()

    await this.db.insert(schema.events).values({
      issueId,
      eventType: 'commented',
      actor: author,
      comment: text,
      createdAt: now,
    })

    return result[0]
  }

  /**
   * Get comments for an issue
   */
  async getComments(issueId: string): Promise<Comment[]> {
    return this.db
      .select()
      .from(schema.comments)
      .where(eq(schema.comments.issueId, issueId))
      .orderBy(asc(schema.comments.createdAt))
  }

  // ===========================================================================
  // Stats
  // ===========================================================================

  /**
   * Get statistics about issues
   */
  async getStats(): Promise<{
    total: number
    open: number
    inProgress: number
    blocked: number
    closed: number
    ready: number
  }> {
    const all = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.issues)
      .where(isNull(schema.issues.deletedAt))

    const byStatus = await this.db
      .select({
        status: schema.issues.status,
        count: sql<number>`count(*)`,
      })
      .from(schema.issues)
      .where(isNull(schema.issues.deletedAt))
      .groupBy(schema.issues.status)

    const ready = await this.getReadyIssues()

    const statusMap = new Map(byStatus.map((s) => [s.status, s.count]))

    return {
      total: all[0]?.count || 0,
      open: statusMap.get('open') || 0,
      inProgress: statusMap.get('in_progress') || 0,
      blocked: statusMap.get('blocked') || 0,
      closed: statusMap.get('closed') || 0,
      ready: ready.length,
    }
  }
}

/**
 * Create a beads adapter instance
 */
export function createBeadsAdapter(config: BeadsConfig): BeadsAdapter {
  return new BeadsAdapter(config)
}
