import Route from './src/route/route.js';
import BeanDefinitions from './src/controller/bean/definition-controller.js';
import InstanceController from './src/controller/bean/instance-controller.js';
import DashboardController from './src/controller/dashboard/dashboard-controller.js';
import GraphController from './src/controller/bean/graph-controller.js';
import ConditionalEvaluationController from './src/controller/bean/conditional-evalugation-controller.js';

$(document).ready(() => {

    const origin = window.location.origin;
    const pathname = window.location.pathname;

    const CONTEXT_PATH = pathname.split('/spring-lens/ui')[0];
    const API_BASE_URL = origin + CONTEXT_PATH + '/spring-lens/api/beans';

    const ENDPOINTS = {
        APPLICATION_INFO            : origin + CONTEXT_PATH + '/spring-lens/api/application',
        BEAN_DEFINITION             : API_BASE_URL + "/definitions",
        SEARCH_BEAN_DEFINITION      : API_BASE_URL + "/definitions/find",
        SUMMARY_BEAN_DEFINITION     : API_BASE_URL + "/definitions/summary",
        BEAN_INSTANCE               : API_BASE_URL + "/instances",
        SEARCH_BEAN_INSTANCE        : API_BASE_URL + "/instances/find",
        GRAPH_DEPENDENCIES          : API_BASE_URL + "/definitions/dependencies",
        CONDITIONAL_REPORTS         : API_BASE_URL + "/conditions",
        SEARCH_CONDITIONAL_REPORTS  : API_BASE_URL + "/conditions/find",
    }

    const dashboard = new DashboardController(ENDPOINTS);
    const beanInstance = new InstanceController(ENDPOINTS.BEAN_INSTANCE, ENDPOINTS.SEARCH_BEAN_INSTANCE);
    const beanDefinitions = new BeanDefinitions(ENDPOINTS.BEAN_DEFINITION, ENDPOINTS.SUMMARY_BEAN_DEFINITION, ENDPOINTS.SEARCH_BEAN_DEFINITION);
    const beanDependencyGraph = new GraphController(ENDPOINTS.GRAPH_DEPENDENCIES, ENDPOINTS.SEARCH_BEAN_DEFINITION);
    const conditionEvaluation = new ConditionalEvaluationController(ENDPOINTS.CONDITIONAL_REPORTS, ENDPOINTS.SEARCH_CONDITIONAL_REPORTS);

    const appRouter = new Route({
        container: '#main-content',
        defaultRoute: 'dashboard',
        routes: {
            'dashboard': {
                template: 'main-dashboard',
                onEnter: (params) => dashboard.enter(params),
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

    // Theme toggle interaction handler
    $('#theme-toggle').on('click', () => {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        document.dispatchEvent(new CustomEvent('themechanged', { detail: { theme: isDark ? 'dark' : 'light' } }));
    });
});