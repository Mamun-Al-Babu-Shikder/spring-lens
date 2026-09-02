import Route from './src/route/route.js';
import BeanDefinitions from './src/controller/bean/definition-controller.js';
import InstanceController from './src/controller/bean/instance-controller.js';
import DashboardController from './src/controller/dashboard/dashboard-controller.js';
import GraphController from './src/controller/bean/graph-controller.js';
import ConditionalEvaluationController from './src/controller/bean/conditional-evalugation-controller.js';
import ApplicationState from './src/controller/application/application-state.js';

$(document).ready(() => {

    const origin = window.location.origin;
    const pathname = window.location.pathname;

    const CONTEXT_PATH = pathname.split('/spring-lens/ui')[0];
    const API_BASE_URL = origin + CONTEXT_PATH + '/spring-lens/api/beans';
    const APPLICATION_INFO = origin + CONTEXT_PATH + '/spring-lens/api/application';

    const ENDPOINTS = {
        APPLICATION_INFO: APPLICATION_INFO,
        APPLICATION_HEALTH: APPLICATION_INFO + "/health",
        BEAN_DEFINITION: API_BASE_URL + "/definitions",
        FIND_BEAN_DEFINITION: API_BASE_URL + "/definitions/find",
        SUMMARY_BEAN_DEFINITION: API_BASE_URL + "/definitions/summary",
        BEAN_INSTANCE: API_BASE_URL + "/instances",
        FIND_BEAN_INSTANCE: API_BASE_URL + "/instances/find",
        GRAPH_DEPENDENCIES: API_BASE_URL + "/definitions/dependencies",
        CONDITIONAL_REPORTS: API_BASE_URL + "/conditions",
        FIND_CONDITIONAL_REPORTS: API_BASE_URL + "/conditions/find",
        SUMMARY_CONDITIONAL_REPORTS: API_BASE_URL + "/conditions/summary",
    }

    const applicationState = new ApplicationState(ENDPOINTS.APPLICATION_HEALTH);
    const dashboard = new DashboardController(ENDPOINTS);
    const beanInstance = new InstanceController(ENDPOINTS.BEAN_INSTANCE, ENDPOINTS.FIND_BEAN_INSTANCE);
    const beanDefinitions = new BeanDefinitions(ENDPOINTS.BEAN_DEFINITION, ENDPOINTS.SUMMARY_BEAN_DEFINITION, ENDPOINTS.FIND_BEAN_DEFINITION);
    const beanDependencyGraph = new GraphController(ENDPOINTS.GRAPH_DEPENDENCIES, ENDPOINTS.BEAN_DEFINITION, ENDPOINTS.FIND_BEAN_DEFINITION);
    const conditionEvaluation = new ConditionalEvaluationController(ENDPOINTS.CONDITIONAL_REPORTS, ENDPOINTS.FIND_CONDITIONAL_REPORTS, ENDPOINTS.SUMMARY_CONDITIONAL_REPORTS);

    const appRouter = new Route({
        container: '#main-content',
        defaultRoute: 'dashboard',
        routes: {
            'dashboard': {
                template: 'main-dashboard',
                onEnter: (params) => {
                    dashboard.enter(params);
                    applicationState.checkHealth();
                },
                onLeave: () => dashboard.leave()
            },
            'definitions': {
                template: 'bean/definitions',
                onEnter: (params) => beanDefinitions.enter(params),
                onLeave: () => beanDefinitions.leave()
            },
            'graph': {
                template: 'bean/graph',
                onEnter: (params) => beanDependencyGraph.enter(params),
                onLeave: () => beanDependencyGraph.leave()
            },
            'conditions': {
                template: 'bean/condition-reports',
                onEnter: (params) => conditionEvaluation.enter(params),
                onLeave: () => conditionEvaluation.leave()
            },
            'beans': {
                template: 'bean/beans',
                onEnter: () => { },
                onLeave: () => { }
            },
            'timeline': {
                template: 'bean/instance',
                onEnter: (params) => beanInstance.enter(params),
                onLeave: () => beanInstance.leave()
            },
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