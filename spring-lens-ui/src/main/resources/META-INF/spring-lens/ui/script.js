import Route from './src/route/route.js';
import BeanDefinitions from './src/controller/bean/definition-controller.js';
import TimelineController from './src/controller/bean/timeline-controller.js';
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
        PROXY_BEAN_INSTANCE: API_BASE_URL + "/instances/proxy-info",
        SUMMARY_BEAN_INSTANCE: API_BASE_URL + "/instances/summary",
        GRAPH_DEPENDENCIES: API_BASE_URL + "/definitions/dependencies",
        CONDITIONAL_REPORTS: API_BASE_URL + "/conditions",
        FIND_CONDITIONAL_REPORTS: API_BASE_URL + "/conditions/find",
        SUMMARY_CONDITIONAL_REPORTS: API_BASE_URL + "/conditions/summary",
    }

    let applicationInfo = "http://localhost:8080/spring-lens/api/application";
    let applicationHealth = "http://localhost:8080/spring-lens/api/application/health";
    let definitions = "http://localhost:8080/spring-lens/api/beans/definitions";
    let findDefinitions = "http://localhost:8080/spring-lens/api/beans/definitions/find";
    let definitionsSummary = "http://localhost:8080/spring-lens/api/beans/definitions/summary";
    let graphDependencies = "http://localhost:8080/spring-lens/api/beans/definitions/dependencies";
    let beansInstances = "http://localhost:8080/spring-lens/api/beans/instances";
    let findBeanInstances = "http://localhost:8080/spring-lens/api/beans/instances/find";
    let summarydBeanInstances = "http://localhost:8080/spring-lens/api/beans/instances/summary";
    let proxyInfoBeanInstances = "http://localhost:8080/spring-lens/api/beans/instances/proxy-info";
    let beansConditions = "http://localhost:8080/spring-lens/api/beans/conditions";
    let searchBeanConditions = "http://localhost:8080/spring-lens/api/beans/conditions/find";
    let summaryBeanConditions = "http://localhost:8080/spring-lens/api/beans/conditions/summary";

    const applicationState = new ApplicationState(applicationHealth);
    const dashboard = new DashboardController({ applicationInfo, definitions, beansInstances, graphDependencies, beansConditions, definitionsSummary });
    const beanDefinitions = new BeanDefinitions(definitions, definitionsSummary, findDefinitions);
    const beanDependencyGraph = new GraphController(graphDependencies, definitions, findDefinitions);
    const beanInstance = new TimelineController(beansInstances, findBeanInstances, findDefinitions, summarydBeanInstances);
    const conditionEvaluation = new ConditionalEvaluationController(beansConditions, searchBeanConditions, summaryBeanConditions);

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
            'conditions': {
                template: 'bean/condition-reports',
                onEnter: (params) => conditionEvaluation.enter(params),
                onLeave: () => conditionEvaluation.leave()
            },
            'timeline': {
                template: 'bean/timeline-chart',
                onEnter: (params) => beanInstance.enter(params),
                onLeave: () => beanInstance.leave()
            },
            'graph': {
                template: 'bean/graph',
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