export const RELEASES = [
    {
        version: 'v1.0.0',
        date: 'September 2026',
        isCurrent: true,
        badge: 'Initial Release',
        title: 'SpringLens 1.0: Real-Time Observability & Diagnostics for Spring Boot',
        description: 'Deep visibility into your Spring Boot container runtime with zero application code modifications. Collects, visualizes, and profiles beans, dependency graphs, conditions, and startup latencies.',
        stats: [
            { label: 'Instrumentation', value: 'Zero Code Changes' },
            { label: 'Target Runtime', value: 'Spring Boot 3.x' },
            { label: 'Telemetry Engines', value: '5 Live Monitors' }
        ],
        hero: {
            category: 'Flagship Feature',
            badgeClass: 'bg-primary/10 text-primary dark:text-purple-300 border border-primary/20',
            title: 'Interactive Dependency Graph & Topology Engine',
            description: 'Navigate your entire Spring application context with an interactive force-directed canvas. Understand deep bean relationships, detect circular dependencies, and identify core architectural hubs at a glance.',
            icon: 'hub',
            iconColor: '#3b82f6',
            route: 'graph',
            actionText: 'Explore Dependency Graph',
            highlights: [
                'Force-directed physics simulation with drag, pan, and smooth zoom controls',
                'Visual categorization for Controller, Service, Repository, and Auto-Config beans',
                'Dedicated hub-bean detection ranking the most heavily depended-upon components',
                'Circular dependency warnings with highlighted edge paths'
            ]
        },
        features: [
            {
                id: 'startup-profiling',
                category: 'Performance',
                badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50',
                icon: 'speed',
                iconColor: '#f59e0b',
                title: 'Startup Latency & Bottleneck Diagnostics',
                description: 'Capture exact bean initialization duration with sub-millisecond precision. Locate slow-loading singletons and third-party starters that delay application boot.',
                route: 'instances',
                actionText: 'Inspect Instances',
                points: [
                    'Interactive Gantt timeline waterfall ordering beans by creation sequence',
                    'Customizable bottleneck threshold slider with persistent preferences',
                    'Live memory and instance counter telemetry'
                ]
            },
            {
                id: 'condition-reports',
                category: 'Intelligence',
                badgeClass: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50',
                icon: 'fact_check',
                iconColor: '#2563eb',
                title: 'Auto-Configuration Condition Evaluation Audit',
                description: 'Understand exactly why Spring Boot enabled or skipped specific configurations. Full audit logs for @ConditionalOnClass, @ConditionalOnProperty, and @ConditionalOnMissingBean.',
                route: 'conditions',
                actionText: 'View Conditions',
                points: [
                    'Dual breakdown of matched vs. not-matched conditions',
                    'Human-readable explanation of missing dependencies or unmatched properties',
                    'Search filter by configuration class or package'
                ]
            },
            {
                id: 'bean-definitions',
                category: 'Discovery',
                badgeClass: 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50',
                icon: 'list_alt',
                iconColor: '#9333ea',
                title: 'Bean Definitions & Metadata Inspector',
                description: 'Search and inspect every bean definition registered in the ApplicationContext. View origins, factory methods, proxy mechanisms, and injection targets.',
                route: 'definitions',
                actionText: 'Browse Definitions',
                points: [
                    'Instant search filter by bean name, interface, or package namespace',
                    'Slide-over detail drawer with comprehensive property breakdown',
                    'Proxy detection distinguishing JDK Dynamic Proxies and CGLIB proxies'
                ]
            },
            {
                id: 'executive-dashboard',
                category: 'Observability',
                badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50',
                icon: 'dashboard',
                iconColor: '#10b981',
                title: 'Executive Telemetry Dashboard',
                description: 'High-level operational overview summarizing application health, JVM telemetry, active profiles, scope distributions, and top bottleneck warnings.',
                route: 'dashboard',
                actionText: 'Open Dashboard',
                points: [
                    'Live health monitoring with automatic reconnection telemetry',
                    'Active profiles and environment properties inspector',
                    'Radial tree preview directly embedded in the dashboard'
                ]
            }
        ],
        upcoming: [
            {
                icon: 'database',
                title: 'SQL Query & JDBC Telemetry',
                description: 'Track executed query durations, N+1 query patterns, and connection pool utilization.'
            },
            {
                icon: 'cached',
                title: 'Cache Inspection & Hit Rates',
                description: 'Monitor cache hits, misses, and evictions across Caffeine, Redis, and EhCache.'
            },
            {
                icon: 'schedule',
                title: 'Scheduled Task Telemetry',
                description: 'Execution timeline and delay tracking for @Scheduled methods and background workers.'
            }
        ]
    }
];

export const CATEGORIES = [
    { id: 'all', label: 'All Highlights' },
    { id: 'Performance', label: 'Performance' },
    { id: 'Intelligence', label: 'Intelligence' },
    { id: 'Discovery', label: 'Discovery' },
    { id: 'Observability', label: 'Observability' }
];
