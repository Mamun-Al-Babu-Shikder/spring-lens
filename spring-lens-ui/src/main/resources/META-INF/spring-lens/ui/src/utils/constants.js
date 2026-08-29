// UI layout constants for Spring Lens
export const NW = 196;
export const NH = 44;
export const RX = 10;
export const GAP_X = 36;
export const GAP_Y = 80;
export const ICON = 'M10 2l8 4v8l-8 4-8-4V6l8-4z M2 6l8 4 M18 6l-8 4 M10 10v8';
export const ZOOM_SCALE_EXTENT = [0.05, 4];
export const METHOD_PILL_STYLES = {
    get: 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-900/30',
    post: 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-100 dark:border-green-900/30',
    put: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-900/30',
    delete: 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border-red-100 dark:border-red-900/30'
};

export const STATUS_PILL_STYLES = {
    green: 'bg-success-light dark:bg-success/10 text-success dark:text-success border-success/15 dark:border-success/30',
    amber: 'bg-amber-50 dark:bg-amber-950/20 text-warning dark:text-warning border-warning/15 dark:border-warning/30',
    red: 'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/35'
};

export const NODE_STYLES = {
    root: { fill: '#eff6ff', stroke: '#3b82f6', icon: '#3b82f6', text: '#1d4ed8' },
    context: { fill: '#eef2ff', stroke: '#6366f1', icon: '#6366f1', text: '#4338ca' },
    leaf: { fill: '#fffbeb', stroke: '#eab308', icon: '#eab308', text: '#a16207' },
    intermediate: { fill: '#f0fdf4', stroke: '#22c55e', icon: '#22c55e', text: '#15803d' }
};

export const DEFAULT_NODE_STYLE = { fill: '#faf5ff', stroke: '#a855f7', icon: '#a855f7', text: '#7e22ce' };

export const NAV_STYLES = {
    sublink: {
        active: 'text-primary dark:text-purple-400',
        inactive: 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
    },
    parent: {
        active: 'text-primary dark:text-purple-300 bg-primary-light dark:bg-primary/20 border-l-2 border-primary',
        inactive: 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800'
    }
};

export const CLASSES = {
    navActive: NAV_STYLES.parent.active,
    navInactive: NAV_STYLES.parent.inactive,
    subnavActive: NAV_STYLES.sublink.active,
    subnavInactive: NAV_STYLES.sublink.inactive,
    rowActive: 'bg-primary-light/40 dark:bg-primary/20 font-semibold border-l-4 border-primary',
    defRowActive: 'bg-primary-light/40 border-l-2 border-primary font-medium',
    toggleActive: 'bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-white shadow-sm',
    toggleInactive: 'text-gray-500 dark:text-gray-400'
};



export const BEAN_TYPE_RULES = [
    { keywords: ['datasource', 'connection'], icon: 'database', color: '#10b981' },
    { keywords: ['security', 'auth'], icon: 'lock', color: '#f59e0b' },
    { keywords: ['controller', 'rest'], icon: 'api', color: '#3b82f6' },
    { keywords: ['service'], icon: 'settings_input_component', color: '#8b5cf6' },
    { keywords: ['repository', 'dao'], icon: 'folder_open', color: '#ec4899' },
    { keywords: ['cache'], icon: 'memory', color: '#64748b' },
    { keywords: ['config', 'properties'], icon: 'settings', color: '#14b8a6' },
    { keywords: ['scheduler', 'task'], icon: 'schedule', color: '#06b6d4' },
    { keywords: ['mapper'], icon: 'transform', color: '#a855f7' },
    { keywords: ['client'], icon: 'hub', color: '#f43f5e' },
    { keywords: ['template'], icon: 'layout', color: '#3b82f6' },
    { keywords: ['filter'], icon: 'filter_list', color: '#64748b' },
    { keywords: ['converter', 'serializer'], icon: 'swap_horiz', color: '#8b5cf6' },
    { keywords: ['factory'], icon: 'factory', color: '#f59e0b' },
    { keywords: ['validator'], icon: 'verified_user', color: '#10b981' },
    { keywords: ['producer', 'consumer', 'listener'], icon: 'hearing', color: '#ec4899' }
];

export const SCOPE_COLORS = {
    'Singleton': '#6b46c1',
    'Prototype': '#3b82f6',
    'Request': '#f59e0b',
    'Session': '#22c55e',
    'Unknown': '#cbd5e1'
};

export const ROLE_COLORS = {
    'Application': '#3b82f6',
    'Support': '#f59e0b',
    'Infrastructure': '#e2e8f0',
    'Unknown': '#cbd5e1'
};

export const LOADING_MODE_COLORS = {
    'Lazy': '#a855f7',
    'Eager': '#3b82f6',
    'Unknown': '#cbd5e1'
};

export const SCOPE_STYLES = {
    singleton: {
        bg: '#f3e8ff', fg: '#7e22ce', border: '#d8b4fe',
        darkBg: 'rgba(126, 34, 206, 0.15)', darkFg: '#d8b4fe', darkBorder: 'rgba(126, 34, 206, 0.3)'
    },
    prototype: {
        bg: '#eff6ff', fg: '#1d4ed8', border: '#bfdbfe',
        darkBg: 'rgba(29, 78, 216, 0.15)', darkFg: '#93c5fd', darkBorder: 'rgba(29, 78, 216, 0.3)'
    },
    request: {
        bg: '#fffbeb', fg: '#b45309', border: '#fde68a',
        darkBg: 'rgba(180, 83, 9, 0.15)', darkFg: '#fde68a', darkBorder: 'rgba(180, 83, 9, 0.3)'
    },
    session: {
        bg: '#f0fdf4', fg: '#15803d', border: '#bbf7d0',
        darkBg: 'rgba(21, 128, 61, 0.15)', darkFg: '#86efac', darkBorder: 'rgba(21, 128, 61, 0.3)'
    }
};

export const DEFAULT_SCOPE_STYLE = {
    bg: '#f8fafc', fg: '#475569', border: '#e2e8f0',
    darkBg: 'rgba(71, 85, 105, 0.15)', darkFg: '#cbd5e1', darkBorder: 'rgba(71, 85, 105, 0.3)'
};

export const DEPENDENCY_CATEGORY_COLORS = {
    intermediate: 'green',
    leaf: 'yellow',
    adapter: 'purple'
};

export const CONTEXT_THEME_COLORS = [
    'bg-primary',
    'bg-blue-500',
    'bg-emerald-500',
    'bg-amber-500',
    'bg-indigo-500',
    'bg-purple-500',
    'bg-rose-500',
    'bg-teal-500'
];

export const GRAPH_NODE_THEMES = {
    dark: {
        target:     { fill: 'rgba(59, 130, 246, 0.2)', stroke: '#3b82f6', icon: '#60a5fa', text: '#93c5fd' },
        dependency: { fill: 'rgba(34, 197, 94, 0.2)', stroke: '#22c55e', icon: '#4ade80', text: '#86efac' },
        dependent:  { fill: 'rgba(168, 85, 247, 0.2)', stroke: '#a855f7', icon: '#c084fc', text: '#e9d5ff' },
        default:    { fill: 'rgba(148, 163, 184, 0.2)', stroke: '#94a3b8', icon: '#cbd5e1', text: '#f1f5f9' },
    },
    light: {
        target:     { fill: '#eff6ff', stroke: '#3b82f6', icon: '#3b82f6', text: '#1d4ed8' },
        dependency: { fill: '#f0fdf4', stroke: '#22c55e', icon: '#22c55e', text: '#15803d' },
        dependent:  { fill: '#faf5ff', stroke: '#a855f7', icon: '#a855f7', text: '#7e22ce' },
        default:    { fill: '#f8fafc', stroke: '#94a3b8', icon: '#64748b', text: '#334155' },
    },
};

export const DURATION_BAR_RULES = [
    { minDurationMs: 50, classes: 'bg-red-500 hover:bg-red-600' },
    { minDurationMs: 10, classes: 'bg-orange-500 hover:bg-orange-600' },
    { minDurationMs: 1,  classes: 'bg-blue-500 hover:bg-blue-600' },
    { minDurationMs: 0,  classes: 'bg-primary hover:bg-primary/95' }
];

export const PROGRESS_BADGE_STYLES = {
    error: {
        badge: 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900/30',
        dot: 'bg-red-500'
    },
    complete: {
        badge: 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/30',
        dot: 'bg-emerald-500'
    },
    loading: {
        badge: 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/30',
        dot: 'bg-amber-500 animate-pulse'
    }
};

export const ALL_PROGRESS_BADGE_CLASSES = Object.values(PROGRESS_BADGE_STYLES).map(s => s.badge).join(' ');
export const ALL_PROGRESS_DOT_CLASSES = Object.values(PROGRESS_BADGE_STYLES).map(s => s.dot).join(' ');