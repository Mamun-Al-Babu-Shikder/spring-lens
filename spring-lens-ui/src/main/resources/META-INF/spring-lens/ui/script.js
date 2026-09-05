import ENDPOINTS from './src/config/api-endpoints.js';
import Route from './src/route/route.js';
import BeanDefinitions from './src/controller/bean/definition-controller.js';
import TimelineController from './src/controller/bean/timeline-controller.js';
import DashboardController from './src/controller/dashboard/dashboard-controller.js';
import GraphController from './src/controller/bean/graph-controller.js';
import ConditionalEvaluationController from './src/controller/bean/conditional-evalugation-controller.js';
import ApplicationState from './src/controller/application/application-state.js';
import { PageHeader } from './src/utils/index.js';

$(document).ready(() => {

    const applicationState = new ApplicationState({
        healthApi: ENDPOINTS.APPLICATION_HEALTH,
        infoApi: ENDPOINTS.APPLICATION_INFO
    });
    PageHeader.init(applicationState);

    const dashboard = new DashboardController(ENDPOINTS, applicationState);
    const beanDefinitions = new BeanDefinitions(ENDPOINTS);
    const beanDependencyGraph = new GraphController(ENDPOINTS);
    const beanInstance = new TimelineController(ENDPOINTS);
    const conditionEvaluation = new ConditionalEvaluationController(ENDPOINTS);

    const appRouter = new Route({
        container: '#main-content',
        defaultRoute: 'dashboard',
        routes: {
            'dashboard': {
                template: 'main-dashboard',
                header: {
                    icon: 'dashboard',
                    title: 'Platform Overview',
                    badge: 'Dashboard',
                    breadcrumbs: ['Dashboard'],
                    actions: [
                        {
                            id: 'btn-refresh-dashboard',
                            action: 'refresh-data',
                            icon: 'refresh',
                            label: 'Refresh',
                            title: 'Refresh dashboard metrics'
                        }
                    ]
                },
                onEnter: (params) => {
                    dashboard.enter(params);
                    applicationState.checkHealth();
                },
                onLeave: () => dashboard.leave()
            },
            'definitions': {
                template: 'bean/definitions',
                header: {
                    icon: 'widgets',
                    title: 'Bean Definitions',
                    badge: 'Definitions Registry',
                    breadcrumbs: ['Bean', 'Definitions'],
                    actions: [
                        { id: 'def-btn-refresh', action: 'refresh-data', icon: 'refresh', label: 'Refresh', title: 'Refresh bean definitions' },
                        { id: 'beans-btn-export', action: 'export-data', icon: 'file_download', label: 'Export', title: 'Export bean definitions' }
                    ]
                },
                onEnter: (params) => beanDefinitions.enter(params),
                onLeave: () => beanDefinitions.leave()
            },
            'conditions': {
                template: 'bean/condition-reports',
                header: {
                    icon: 'fact_check',
                    title: 'Condition Reports',
                    badge: 'Auto-Configuration',
                    breadcrumbs: ['Bean', 'Conditional Beans Evaluation'],
                    actions: [
                        { id: 'condition-btn-refresh', action: 'refresh-data', icon: 'refresh', label: 'Refresh', title: 'Refresh evaluations' },
                        { type: 'search', id: 'condition-search-input', placeholder: 'Search auto-configurations...' }
                    ]
                },
                onEnter: (params) => conditionEvaluation.enter(params),
                onLeave: () => conditionEvaluation.leave()
            },
            'timeline': {
                template: 'bean/timeline-chart',
                header: {
                    icon: 'timeline',
                    title: 'Bean Instances',
                    badge: 'Startup Waterfall & Profiler',
                    breadcrumbs: ['Bean', 'Timeline Chart'],
                    actions: [
                        { id: 'time-btn-refresh', action: 'refresh-data', icon: 'refresh', label: 'Refresh', title: 'Refresh bean timeline data' },
                        { id: 'time-btn-download', action: 'download-report', icon: 'file_download', label: 'Export', title: 'Export bean timeline as JSON' }
                    ]
                },
                onEnter: (params) => beanInstance.enter(params),
                onLeave: () => beanInstance.leave()
            },
            'graph': {
                template: 'bean/graph',
                title: 'Dependency Graph',
                header: null,
                onEnter: (params) => beanDependencyGraph.enter(params),
                onLeave: () => beanDependencyGraph.leave()
            }
        }
    });

    // Start Route
    appRouter.init();

    applicationState.start(10000);

    // Theme toggle interaction handler
    $('#theme-toggle').on('click', () => {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        document.dispatchEvent(new CustomEvent('themechanged', { detail: { theme: isDark ? 'dark' : 'light' } }));
    });
});