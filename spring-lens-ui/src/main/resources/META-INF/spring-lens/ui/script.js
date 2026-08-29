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
        SUMMARY_BEAN_DEFINITION     : API_BASE_URL + "/summary",
        BEAN_DEFINITION             : API_BASE_URL + "/definitions",
        SEARCH_BEAN_DEFINITION      : API_BASE_URL + "/definitions/find",
        BEAN_INSTANCE               : API_BASE_URL + "/instances",
        SEARCH_BEAN_INSTANCE        : API_BASE_URL + "/instances/find",
        CONDITIONAL_REPORTS         : API_BASE_URL + "/conditions",
        SEARCH_CONDITIONAL_REPORTS  : API_BASE_URL + "/conditions/find",
        GRAPH_DEPENDENCIES          : API_BASE_URL + "/dependencies",
    }

    let definitions = "http://localhost:8083/spring-lens/api/beans/definitions";
    let definitionsSummary = "http://localhost:8083/spring-lens/api/beans/definitions/summary";
    let graphDependencies = "http://localhost:8083/spring-lens/api/beans/definitions/dependencies";
    let findDependencies = "http://localhost:8083/spring-lens/api/beans/definitions/find";
    let beansInstances = "http://localhost:8083/spring-lens/api/beans/instances";
    let findBeanInstances = "http://localhost:8083/spring-lens/api/beans/instances/find";
    let beansConditions = "http://localhost:8083/spring-lens/api/beans/conditions";
    let searchBeanConditions = "http://localhost:8083/spring-lens/api/beans/conditions/find";

    const dashboard = new DashboardController();
    const beanDefinitions = new BeanDefinitions(definitions, definitionsSummary, findDependencies);
    const beanDependencyGraph = new GraphController(graphDependencies, findDependencies);
    const beanInstance = new InstanceController(beansInstances, findBeanInstances);
    const conditionEvaluation = new ConditionalEvaluationController(beansConditions, searchBeanConditions);

    // const dashboard = new DashboardController();
    // const beanInstance = new InstanceController(ENDPOINTS.BEAN_INSTANCE, ENDPOINTS.SEARCH_BEAN_INSTANCE);
    // const beanDefinitions = new BeanDefinitions(ENDPOINTS.BEAN_DEFINITION, ENDPOINTS.SUMMARY_BEAN_DEFINITION, ENDPOINTS.SEARCH_BEAN_DEFINITION );
    // const beanDependencyGraph = new GraphController(ENDPOINTS.GRAPH_DEPENDENCIES, ENDPOINTS.SEARCH_BEAN_DEFINITION);

    // Configure routes and instantiate Route
    const appRouter = new Route({
        container: '#main-content',
        defaultRoute: 'dashboard',
        routes: {
            'dashboard': {
                template: 'main-dashboard',
                onEnter: () => dashboard.enter(),
                onLeave: () => dashboard.leave()
            },
            'definitions': {
                template: 'bean/definitions',
                onEnter: () => beanDefinitions.enter(),
                onLeave: () => beanDefinitions.leave()
            },
            'graph': {
                template: 'bean/graph',
                onEnter: () => beanDependencyGraph.enter(),
                onLeave: () => beanDependencyGraph.leave()
            },
            'conditions': {
                template: 'bean/condition-reports',
                onEnter: () => conditionEvaluation.enter(),
                onLeave: () => conditionEvaluation.leave()
            },
            'beans': {
                template: 'bean/beans',
                onEnter: () => { },
                onLeave: () => { }
            },
            'timeline': {
                template: 'bean/instance',
                onEnter: () => beanInstance.enter(),
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