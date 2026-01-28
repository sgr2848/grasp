import { useCallback, useEffect, useState, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { SignInButton, useAuth as useClerkAuth } from '@clerk/clerk-react'
import ForceGraph2D, { type ForceGraphMethods } from 'react-force-graph-2d'
import {
  getKnowledgeGraph,
  getKnowledgeInsights,
  getUserUsageV2,
  type KnowledgeGraphResponse,
  type KnowledgeInsights,
  type InsightConcept,
  type CrossConnection,
  type UsageStatsV2,
} from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'

function getMasteryColor(mastery: number): string {
  if (mastery >= 80) return 'bg-emerald-500'
  if (mastery >= 60) return 'bg-blue-500'
  if (mastery >= 40) return 'bg-amber-500'
  return 'bg-red-500'
}

function getMasteryTextColor(mastery: number): string {
  if (mastery >= 80) return 'text-emerald-600'
  if (mastery >= 60) return 'text-blue-600'
  if (mastery >= 40) return 'text-amber-600'
  return 'text-red-600'
}

function ConceptPill({ concept }: { concept: InsightConcept }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3">
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white',
          getMasteryColor(concept.mastery)
        )}
        title="Recency-adjusted mastery score"
      >
        {concept.mastery}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-neutral-900">{concept.name}</div>
        <div className="text-xs text-neutral-500">
          {concept.daysSinceLastSeen !== null && concept.daysSinceLastSeen > 0
            ? `${concept.daysSinceLastSeen} days ago`
            : 'Today'}
          {' · '}
          Seen {concept.timesEncountered}x
        </div>
      </div>
    </div>
  )
}

function ConnectionCard({ connection }: { connection: CrossConnection }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="font-medium text-neutral-900">{connection.name}</div>
      <div className="mt-1 text-xs text-neutral-500">
        Appears in {connection.loopCount} sessions
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {connection.loops.map((loop) => (
          <Link
            key={loop.id}
            to={`/learn/${loop.id}`}
            className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 hover:bg-neutral-200"
          >
            {loop.title || 'Untitled'}
          </Link>
        ))}
      </div>
    </div>
  )
}

export default function Knowledge() {
  const { isLoaded, isSignedIn } = useClerkAuth()
  const [insights, setInsights] = useState<KnowledgeInsights | null>(null)
  const [graph, setGraph] = useState<KnowledgeGraphResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showGraph, setShowGraph] = useState(false)
  const [usageStats, setUsageStats] = useState<UsageStatsV2 | null>(null)
  const graphRef = useRef<ForceGraphMethods | undefined>(undefined)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 })

  // Update dimensions when container resizes
  useEffect(() => {
    if (!containerRef.current) return
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width
        const isMobile = width < 640
        setDimensions({
          width,
          height: isMobile
            ? Math.max(260, Math.min(360, width * 0.6))
            : Math.max(350, Math.min(500, width * 0.5)),
        })
      }
    })
    resizeObserver.observe(containerRef.current)
    return () => resizeObserver.disconnect()
  }, [showGraph])

  // Transform data for force graph
  const graphData = useMemo(() => {
    if (!graph) return { nodes: [], links: [] }
    return {
      nodes: graph.nodes.map((n) => ({
        id: n.id,
        name: n.name,
        mastery: n.mastery,
        val: 5 + n.timesEncountered * 2,
      })),
      links: graph.edges.map((e) => ({
        source: e.source,
        target: e.target,
        type: e.type,
      })),
    }
  }, [graph])

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const [insightsData, graphData, usageData] = await Promise.all([
        getKnowledgeInsights(),
        getKnowledgeGraph(),
        getUserUsageV2().catch(() => null), // Silent fail for usage stats
      ])
      setInsights(insightsData)
      setGraph(graphData)
      setUsageStats(usageData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load knowledge data')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return
    void loadData()
  }, [isLoaded, isSignedIn, loadData])

  if (!isLoaded) {
    return (
      <div className="mx-auto max-w-6xl">
        <Card className="p-10">
          <div className="flex items-center justify-center gap-3">
            <Spinner size="lg" />
            <span className="text-sm text-neutral-500">Loading...</span>
          </div>
        </Card>
      </div>
    )
  }

  if (!isSignedIn) {
    return (
      <div className="mx-auto max-w-6xl">
        <Card className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-medium text-neutral-900">Sign in to view your knowledge</div>
              <p className="mt-1 text-sm text-neutral-500">
                Track your concept mastery across all learning sessions.
              </p>
            </div>
            <SignInButton mode="modal">
              <button className="h-10 bg-neutral-900 px-4 text-sm font-medium text-white hover:bg-neutral-800">
                Sign in
              </button>
            </SignInButton>
          </div>
        </Card>
      </div>
    )
  }

  const stats = insights?.stats

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Your Knowledge</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Track your learning progress and find what needs attention
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            Mastery scores are recency-adjusted based on when you last saw a concept.
          </p>
        </div>
        <Link
          to="/learn"
          className="inline-flex h-10 items-center justify-center bg-neutral-900 px-4 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Learn Something New
        </Link>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-red-600">{error}</div>
            <button
              onClick={() => void loadData()}
              className="text-sm font-medium text-red-600 hover:text-red-700"
            >
              Retry
            </button>
          </div>
        </Card>
      )}

      {isLoading ? (
        <Card className="p-10">
          <div className="flex items-center justify-center gap-3">
            <Spinner size="lg" />
            <span className="text-sm text-neutral-500">Loading your knowledge...</span>
          </div>
        </Card>
      ) : insights && stats ? (
        <>
          {/* Stats Overview */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-4">
              <div className="text-sm text-neutral-500">Total Concepts</div>
              <div className="mt-1 text-2xl font-bold text-neutral-900">{stats.totalConcepts}</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-sm text-neutral-500">
                <span>Average Mastery</span>
                <span className="text-xs text-neutral-400">(recency-adjusted)</span>
              </div>
              <div className={cn('mt-1 text-2xl font-bold', getMasteryTextColor(stats.averageMastery))}>
                {Math.round(stats.averageMastery)}%
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-neutral-500">Mastered</div>
              <div className="mt-1 text-2xl font-bold text-emerald-600">{stats.masteredCount}</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-neutral-500">In Progress</div>
              <div className="mt-1 text-2xl font-bold text-amber-600">
                {stats.learningCount + stats.newCount}
              </div>
            </Card>
          </div>

          {/* Concept limit for free tier */}
          {usageStats && usageStats.tier === 'free' && (
            <Card className={cn(
              'p-4',
              usageStats.conceptsRemaining === 0 && 'border-amber-200 bg-amber-50'
            )}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-neutral-900">Knowledge Graph Capacity</div>
                  <p className="text-xs text-neutral-500">
                    {usageStats.conceptsCount} / {usageStats.limits.maxConcepts} concepts tracked
                  </p>
                </div>
                {usageStats.conceptsRemaining === 0 && (
                  <Link
                    to="/settings#upgrade"
                    className="shrink-0 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800"
                  >
                    Upgrade
                  </Link>
                )}
              </div>
              <div className="mt-2 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full transition-all',
                    usageStats.conceptsRemaining === 0 ? 'bg-amber-500' : 'bg-purple-500'
                  )}
                  style={{ width: `${Math.min(100, (usageStats.conceptsCount / usageStats.limits.maxConcepts) * 100)}%` }}
                />
              </div>
              {usageStats.conceptsRemaining === 0 && (
                <p className="mt-2 text-xs text-amber-700">
                  New concepts won't be tracked until you upgrade to Pro.
                </p>
              )}
            </Card>
          )}

          {/* Empty state */}
          {stats.totalConcepts === 0 ? (
            <Card className="p-10">
              <div className="text-center">
                <div className="text-sm font-medium text-neutral-900">No concepts yet</div>
                <p className="mt-1 text-sm text-neutral-500">
                  Complete learning sessions to start tracking your knowledge.
                </p>
                <Link
                  to="/learn"
                  className="mt-4 inline-flex h-10 items-center justify-center bg-neutral-900 px-4 text-sm font-medium text-white hover:bg-neutral-800"
                >
                  Start Learning
                </Link>
              </div>
            </Card>
          ) : (
            <>
              {/* Actionable Sections */}
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Review Soon */}
                <Card className="p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-neutral-900">Review Soon</div>
                      <div className="text-xs text-neutral-500">Low mastery or not seen recently</div>
                    </div>
                    {insights.needsReview.length > 0 && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        {insights.needsReview.length} concepts
                      </span>
                    )}
                  </div>
                  {insights.needsReview.length > 0 ? (
                    <div className="space-y-2">
                      {insights.needsReview.map((concept) => (
                        <ConceptPill key={concept.id} concept={concept} />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg bg-emerald-50 p-4 text-center text-sm text-emerald-700">
                      All caught up! No concepts need review right now.
                    </div>
                  )}
                </Card>

                {/* Recent Progress */}
                <Card className="p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-neutral-900">Recent Progress</div>
                      <div className="text-xs text-neutral-500">Concepts from the last 7 days</div>
                    </div>
                    {insights.recentProgress.length > 0 && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                        {insights.recentProgress.length} concepts
                      </span>
                    )}
                  </div>
                  {insights.recentProgress.length > 0 ? (
                    <div className="space-y-2">
                      {insights.recentProgress.slice(0, 5).map((concept) => (
                        <ConceptPill key={concept.id} concept={concept} />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg bg-neutral-50 p-4 text-center text-sm text-neutral-500">
                      No recent learning activity. Time to learn something new!
                    </div>
                  )}
                </Card>

                {/* Weak Spots */}
                {insights.weakSpots.length > 0 && (
                  <Card className="p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <div className="font-medium text-neutral-900">Weak Spots</div>
                        <div className="text-xs text-neutral-500">
                          Seen multiple times but still struggling
                        </div>
                      </div>
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        {insights.weakSpots.length} concepts
                      </span>
                    </div>
                    <div className="space-y-2">
                      {insights.weakSpots.map((concept) => (
                        <ConceptPill key={concept.id} concept={concept} />
                      ))}
                    </div>
                  </Card>
                )}

                {/* Cross Connections */}
                {insights.crossConnections.length > 0 && (
                  <Card className="p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <div className="font-medium text-neutral-900">Cross Connections</div>
                        <div className="text-xs text-neutral-500">
                          Concepts appearing across multiple sessions
                        </div>
                      </div>
                      <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                        {insights.crossConnections.length} concepts
                      </span>
                    </div>
                    <div className="space-y-2">
                      {insights.crossConnections.map((connection) => (
                        <ConnectionCard key={connection.id} connection={connection} />
                      ))}
                    </div>
                  </Card>
                )}
              </div>

              {/* Graph Toggle */}
              {graph && graph.nodes.length > 0 && (
                <Card className="overflow-hidden p-0">
                  <button
                    onClick={() => setShowGraph(!showGraph)}
                    className="flex w-full items-center justify-between p-4 text-left hover:bg-neutral-50"
                  >
                    <div>
                      <div className="font-medium text-neutral-900">Knowledge Map</div>
                      <div className="text-xs text-neutral-500">
                        {graph.nodes.length} concepts, {graph.edges.length} connections
                      </div>
                    </div>
                    <span className="text-sm text-neutral-500">
                      {showGraph ? 'Hide' : 'Show'} graph
                    </span>
                  </button>
                  {showGraph && (
                    <>
                      <div ref={containerRef} className="w-full border-t border-neutral-200">
                        <ForceGraph2D
                          ref={graphRef}
                          graphData={graphData}
                          width={dimensions.width}
                          height={dimensions.height}
                          nodeLabel={(node: any) => `${node.name} (${node.mastery}% mastery, recency-adjusted)`}
                          nodeColor={(node: any) => {
                            if (node.mastery >= 80) return '#10b981'
                            if (node.mastery >= 60) return '#3b82f6'
                            if (node.mastery >= 40) return '#f59e0b'
                            return '#ef4444'
                          }}
                          nodeRelSize={6}
                          linkColor={() => '#d4d4d4'}
                          linkWidth={1.5}
                          linkDirectionalArrowLength={4}
                          linkDirectionalArrowRelPos={1}
                          cooldownTicks={100}
                          onEngineStop={() => graphRef.current?.zoomToFit(400, 50)}
                        />
                      </div>
                      <div className="border-t border-neutral-200 bg-neutral-50 px-4 py-2 text-xs text-neutral-500">
                        Drag to pan, scroll to zoom. Colors indicate recency-adjusted mastery.
                      </div>
                    </>
                  )}
                </Card>
              )}
            </>
          )}
        </>
      ) : null}
    </div>
  )
}
