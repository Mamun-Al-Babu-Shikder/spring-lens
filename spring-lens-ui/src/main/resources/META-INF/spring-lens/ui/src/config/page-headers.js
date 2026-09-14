/**
 * Centralized Page Header Configuration Registry.
 * Defines title, badge, icon, breadcrumbs, and action button metadata for views.
 */
export const PAGE_HEADERS = {
    'definitions': {
        icon: 'widgets',
        title: 'Bean Definitions',
        badge: 'Definitions Registry',
        breadcrumbs: ['Bean', 'Definitions'],
        actions: [
            { id: 'def-btn-refresh', action: 'refresh-data', icon: 'refresh', label: 'Refresh', title: 'Refresh bean definitions' },
            { id: 'beans-btn-export', action: 'export-data', icon: 'file_download', label: 'Export', title: 'Export bean definitions' }
        ]
    },
    'conditions': {
        icon: 'fact_check',
        title: 'Condition Reports',
        badge: 'Auto-Configuration',
        breadcrumbs: ['Bean', 'Conditional Reports'],
        actions: [
            { id: 'condition-btn-refresh', action: 'refresh-data', icon: 'refresh', label: 'Refresh', title: 'Refresh evaluations' },
            { type: 'search', id: 'condition-search-input', placeholder: 'Search auto-configurations...' }
        ]
    },
    'instances': {
        icon: 'timelapse',
        title: 'Bean Instances',
        badge: 'Startup Waterfall & Profiler',
        breadcrumbs: ['Bean', 'Instances'],
        actions: [
            { id: 'time-btn-refresh', action: 'refresh-data', icon: 'refresh', label: 'Refresh', title: 'Refresh bean instance data' },
            { id: 'time-btn-download', action: 'download-report', icon: 'file_download', label: 'Export', title: 'Export bean instance as JSON' }
        ]
    }
};

export default PAGE_HEADERS;
