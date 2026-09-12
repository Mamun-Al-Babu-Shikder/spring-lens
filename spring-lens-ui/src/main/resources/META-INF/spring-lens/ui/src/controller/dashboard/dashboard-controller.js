import {
    BaseController,
    DashboardService,
    HeroWidget,
    DefinitionChartWidget,
    BottlenecksWidget,
    ConditionsWidget,
    DependencyHubsWidget,
    RadialTreeWidget,
    QuickSearchWidget
} from './index.js';

/**
 * Dashboard Facade Controller.
 * Orchestrates dashboard lifecycle, parallel data loading, and delegates
 * presentation to specialized, modular UI widgets.
 */
export class DashboardController extends BaseController {

    /**
     * @param {Object} [ENDPOINTS] - API endpoint definitions.
     * @param {Object} [applicationState] - Shared application state instance.
     */
    constructor(ENDPOINTS = {}, applicationState = null) {
        super('dashboard');
        this.service = new DashboardService(ENDPOINTS);
        this.endpoints = this.service.endpoints;
        this.applicationState = applicationState;

        // Sub-widgets
        this.heroWidget = new HeroWidget({ applicationState: this.applicationState });
        this.chartWidget = new DefinitionChartWidget();
        this.bottlenecksWidget = new BottlenecksWidget();
        this.conditionsWidget = new ConditionsWidget();
        this.hubsWidget = new DependencyHubsWidget();
        this.radialTreeWidget = new RadialTreeWidget();
        this.quickSearchWidget = new QuickSearchWidget({ service: this.service });

        // Register widgets as disposables for automatic teardown
        this.addDisposable(this.heroWidget);
        this.addDisposable(this.chartWidget);
        this.addDisposable(this.bottlenecksWidget);
        this.addDisposable(this.conditionsWidget);
        this.addDisposable(this.hubsWidget);
        this.addDisposable(this.radialTreeWidget);
        this.addDisposable(this.quickSearchWidget);

        // Data caches
        this.applicationData = null;
        this.summaryData = null;
        this.instancesData = null;
        this.conditionsData = null;
        this.dependenciesData = null;

        this._boundThemeHandler = null;

        // Subscribe to application health state transitions
        this.applicationState?.onStateChange((isHealthIsUp) => {
            const wasDown = this.heroWidget.currentUptimeState === false;
            this.heroWidget.renderUptimeStatus(isHealthIsUp);

            if (isHealthIsUp && wasDown) {
                this.loadAllDashboardData();
            }
        });
    }

    // --- Backward Compatibility Getters ---

    get chartInstance() {
        return this.chartWidget.chartInstance;
    }

    set chartInstance(instance) {
        this.chartWidget.chartInstance = instance;
    }

    get forceSimulation() {
        return this.radialTreeWidget.forceSimulation;
    }

    set forceSimulation(sim) {
        this.radialTreeWidget.forceSimulation = sim;
    }

    get currentUptimeState() {
        return this.heroWidget.currentUptimeState;
    }

    // --- Lifecycle Methods ---

    /**
     * Enters dashboard route, initializes widgets, and fetches all dashboard data.
     */
    async enter() {
        try {
            this.applicationState?.checkHealth();
            this.quickSearchWidget.reset();
            this.quickSearchWidget.bindEvents();
            this._bindEventListeners();
            await this.loadAllDashboardData();
        } catch (error) {
            console.error('Error during Dashboard enter:', error);
        }
    }

    /**
     * Leaves dashboard route and cleans up all event listeners and active charts/simulations.
     */
    leave() {
        if (this._boundThemeHandler) {
            document.removeEventListener('themechanged', this._boundThemeHandler);
            this._boundThemeHandler = null;
        }

        super.leave();
    }

    /**
     * Loads all dashboard dataset sections concurrently with graceful fallbacks.
     */
    async loadAllDashboardData() {
        await Promise.allSettled([
            this.applicationState?.checkHealth()
                .then(isHealthIsUp => this.heroWidget.renderUptimeStatus(isHealthIsUp)),

            this.service.fetchAll({
                onApplicationInfo: (data) => {
                    this.applicationData = data;
                    this.heroWidget.render(data);
                },
                onApplicationFallback: () => {
                    this.heroWidget.renderFallback();
                },
                onDefinitionsSummary: (data) => {
                    this.summaryData = data;
                    this.chartWidget.render(data);
                },
                onInstances: (data) => {
                    this.instancesData = data;
                    this.bottlenecksWidget.render(data);
                },
                onConditions: (data) => {
                    this.conditionsData = data;
                    this.conditionsWidget.render(data);
                },
                onDependencies: (data) => {
                    this.dependenciesData = data;
                    this.hubsWidget.render(data);
                    this.radialTreeWidget.render(data);
                }
            })
        ]);
    }

    /**
     * Binds DOM interaction handlers using BaseController.on().
     * @private
     */
    _bindEventListeners() {
        // Metric type toggle buttons (scope, role, loading mode)
        this.on(document, 'click', '.metric-btn', (e) => {
            const metricType = $(e.currentTarget).data('metric');
            if (metricType) {
                this.chartWidget.updateMetricType(metricType);
            }
        });

        // Theme changed listener for canvas and chart redraws
        if (!this._boundThemeHandler) {
            this._boundThemeHandler = (event) => {
                const isDark = event.detail.theme === 'dark';
                this.chartWidget.onThemeChanged(isDark);
                this.radialTreeWidget.onThemeChanged(isDark);
            };
            document.addEventListener('themechanged', this._boundThemeHandler);
        }
    }

    /**
     * Reloads all dashboard data with UI spinner feedback on the refresh button.
     */
    async reloadDashboardData() {
        const $btn = $('#btn-refresh-dashboard');
        const $icon = $btn.find('.material-symbols-outlined').addClass('animate-spin');

        try {
            await this.loadAllDashboardData();
        } finally {
            setTimeout(() => $icon.removeClass('animate-spin'), 600);
        }
    }

    // --- Backward Compatibility Delegate Methods ---

    renderApplicationInfo(app) {
        this.applicationData = app;
        this.heroWidget.render(app);
    }

    renderApplicationInfoFallback() {
        this.heroWidget.renderFallback();
    }

    renderUptimeStatus(isLive) {
        this.heroWidget.renderUptimeStatus(isLive);
    }

    renderDefinitionKpi(summary) {
        this.chartWidget.renderKpi(summary);
    }

    renderDefinitionChart(summary) {
        this.chartWidget.renderChart(summary);
    }

    renderInstancesKpiAndBottlenecks(data) {
        this.instancesData = data;
        this.bottlenecksWidget.render(data);
    }

    renderConditionsKpiAndSummary(data) {
        this.conditionsData = data;
        this.conditionsWidget.render(data);
    }

    renderDependenciesKpiAndHubs(data) {
        this.dependenciesData = data;
        this.hubsWidget.render(data);
    }

    renderRadialTidyTree(data) {
        this.dependenciesData = data;
        this.radialTreeWidget.render(data);
    }

    handleQuickSearch(query) {
        return this.quickSearchWidget.search(query);
    }
}

export default DashboardController;
