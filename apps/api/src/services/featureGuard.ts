import {
  TIER_LIMITS,
  type SubscriptionTier,
  type UsageStatsV2,
  type FeatureLimitError,
  type SoftCapWarning,
} from '../types/index.js'
import { userQueries, limitQueries } from '../db/queries.js'

/**
 * Get comprehensive usage stats for a user
 */
export async function getUserUsageStats(userId: string): Promise<UsageStatsV2> {
  const user = await userQueries.getWithMonthlyUsage(userId)
  if (!user) {
    throw new Error('User not found')
  }

  const [bookCount, conceptCount] = await Promise.all([
    limitQueries.getBookCount(userId),
    limitQueries.getConceptCount(userId),
  ])

  const tier = user.subscriptionTier as SubscriptionTier
  const limits = TIER_LIMITS[tier]

  const sessionsRemaining = Math.max(0, limits.maxSessionsPerMonth - user.loopsUsedThisMonth)
  const booksRemaining = Math.max(0, limits.maxBooks - bookCount)
  const conceptsRemaining = Math.max(0, limits.maxConcepts - conceptCount)

  // Soft cap warning for Pro users approaching limit (80% threshold)
  const sessionSoftCapWarning =
    tier === 'pro' && user.loopsUsedThisMonth >= limits.maxSessionsPerMonth * 0.8

  // Calculate next month reset date
  const now = new Date()
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))

  return {
    sessionsUsedThisMonth: user.loopsUsedThisMonth,
    booksCount: bookCount,
    conceptsCount: conceptCount,
    tier,
    limits,
    sessionsRemaining,
    booksRemaining,
    conceptsRemaining,
    sessionSoftCapWarning,
    monthResetAt: nextMonth.toISOString(),
  }
}

export type FeatureCheckResult =
  | { allowed: true; warning?: SoftCapWarning }
  | { allowed: false; error: FeatureLimitError }

/**
 * Check if user can upload a book
 */
export async function canUploadBook(userId: string): Promise<FeatureCheckResult> {
  const stats = await getUserUsageStats(userId)

  if (stats.booksRemaining > 0 || stats.tier === 'pro') {
    return { allowed: true }
  }

  return {
    allowed: false,
    error: {
      error: 'feature_limit_exceeded',
      feature: 'books',
      message: `You've reached your limit of ${stats.limits.maxBooks} books. Upgrade to Pro for unlimited books.`,
      usage: stats,
      upgradeUrl: '/settings#upgrade',
    },
  }
}

/**
 * Check if user can create a learning session
 * - Free tier: hard limit (blocks after 8)
 * - Pro tier: soft limit (warns at 40, warns again after 50, but doesn't block)
 */
export async function canCreateSession(userId: string): Promise<FeatureCheckResult> {
  const stats = await getUserUsageStats(userId)
  const tier = stats.tier
  const limits = stats.limits

  // Free tier: hard limit
  if (tier === 'free') {
    if (stats.sessionsRemaining <= 0) {
      return {
        allowed: false,
        error: {
          error: 'feature_limit_exceeded',
          feature: 'sessions',
          message: `You've used all ${limits.maxSessionsPerMonth} free sessions this month. Upgrade to Pro for more.`,
          usage: stats,
          upgradeUrl: '/settings#upgrade',
        },
      }
    }
    return { allowed: true }
  }

  // Pro tier: soft limit with warning
  if (stats.sessionsUsedThisMonth >= limits.maxSessionsPerMonth) {
    return {
      allowed: true,
      warning: {
        warning: 'soft_cap_exceeded',
        feature: 'sessions',
        message: `You've exceeded your monthly session budget (${limits.maxSessionsPerMonth}). Sessions still work, but consider pacing yourself.`,
        usage: stats,
      },
    }
  }

  if (stats.sessionSoftCapWarning) {
    return {
      allowed: true,
      warning: {
        warning: 'soft_cap_approaching',
        feature: 'sessions',
        message: `You're approaching your monthly session budget (${stats.sessionsUsedThisMonth}/${limits.maxSessionsPerMonth}).`,
        usage: stats,
      },
    }
  }

  return { allowed: true }
}

/**
 * Check if user can create/track a new concept
 * - Free tier: stops tracking new concepts after 50, but keeps updating existing ones
 * - Pro tier: unlimited
 */
export async function canCreateConcept(userId: string): Promise<FeatureCheckResult> {
  const stats = await getUserUsageStats(userId)

  if (stats.conceptsRemaining > 0 || stats.tier === 'pro') {
    return { allowed: true }
  }

  return {
    allowed: false,
    error: {
      error: 'feature_limit_exceeded',
      feature: 'concepts',
      message: `Your knowledge graph is at capacity (${stats.limits.maxConcepts} concepts). Upgrade to Pro for unlimited concepts.`,
      usage: stats,
      upgradeUrl: '/settings#upgrade',
    },
  }
}
