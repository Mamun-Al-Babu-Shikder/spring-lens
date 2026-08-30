import httpClient from '../../client/http-client.js';
import GraphTreeBuilder from '../../builder/graph-tree-builder.js';
import {
    resolveBeanMetadata,
    capitalize,
    formatPercentage,
    SCOPE_COLORS,
    ROLE_COLORS,
    LOADING_MODE_COLORS
} from '../../utils';

export default class DashboardController {
    /**
     * @param {Object} endpoints Endpoint configuration for dashboard data sources.
     */
    constructor(endpoints = {}) {
        this.endpoints = {
            application: endpoints.application || 'http://localhost:8083/spring-lens/api/application',
            definitionsSummary: endpoints.definitionsSummary || 'http://localhost:8083/spring-lens/api/beans/definitions/summary',
            definitions: endpoints.definitions || 'http://localhost:8083/spring-lens/api/beans/definitions',
            instances: endpoints.instances || 'http://localhost:8083/spring-lens/api/beans/instances',
            conditions: endpoints.conditions || 'http://localhost:8083/spring-lens/api/beans/conditions',
            dependencies: endpoints.dependencies || 'http://localhost:8083/spring-lens/api/beans/definitions/dependencies'
        };

        this.applicationData = null;
        this.summaryData = null;
        this.instancesData = null;
        this.conditionsData = null;
        this.dependenciesData = null;
        this.cachedBeansList = [];

        this.chartInstance = null;
        this.activeChartMode = 'scope'; // 'scope' | 'role' | 'loading'
        this.radialZoom = null;
        this.radialSvg = null;
        this.radialInitialTransform = null;
        this.uptimeInterval = null;
        this.searchDebounceTimer = null;
        this._boundThemeHandler = null;
    }

    /**
     * Called when the dashboard route is entered.
     */
    async enter() {
        try {
            this.initEvents();
            await this.loadAllDashboardData();
        } catch (error) {
            console.error('Failed to initialize DashboardController:', error);
        }
    }

    /**
     * Called when navigating away from dashboard.
     */
    leave() {
        // 1. Destroy charts and simulations
        this.chartInstance?.destroy();
        this.forceSimulation?.stop();
        this.chartInstance = null;
        this.forceSimulation = null;

        // 2. Clear D3 SVG / Zoom state
        this.radialZoom = null;
        this.radialSvg = null;
        this.radialInitialTransform = null;

        // 3. Clear timers
        clearInterval(this.uptimeInterval);
        clearTimeout(this.searchDebounceTimer);
        this.uptimeInterval = null;
        this.searchDebounceTimer = null;

        // 4. Clean up native listeners
        if (this._boundThemeHandler) {
            document.removeEventListener('themechanged', this._boundThemeHandler);
            this._boundThemeHandler = null;
        }

        // 5. Unbind ALL dashboard delegated events in one call via namespace
        $(document).off('.dashboard');
    }

    /**
     * Binds DOM and system event handlers.
     */
    initEvents() {
        const $doc = $(document);

        // 1. Clean up any previous dashboard bindings first (prevents duplicate triggers)
        $doc.off('.dashboard');

        // 2. Declarative Click Actions Map
        const clickActions = {
            '#btn-refresh-dashboard': async () => {
                const $icon = $('#refresh-icon').addClass('animate-spin');
                try {
                    await this.loadAllDashboardData();
                } finally {
                    setTimeout(() => $icon.removeClass('animate-spin'), 400);
                }
            },

            // Chart View Mode Toggles
            '#btn-chart-scope': () => this._setChartMode('scope'),
            '#btn-chart-role': () => this._setChartMode('role'),
            '#btn-chart-loading': () => this._setChartMode('loading'),

            // Radial Tree Zoom Controls
            '#btn-radial-zoom-in': () => this._zoomRadial(1.3),
            '#btn-radial-zoom-out': () => this._zoomRadial(0.7),
            '#btn-radial-reset': () => this._resetRadialZoom(),

            // Quick Navigation Rows
            '.slowest-bean-item': () => { window.location.hash = '#/timeline'; },
            '.hub-bean-item': () => { window.location.hash = '#/graph'; }
        };

        // 3. Register click events with the '.dashboard' namespace
        Object.entries(clickActions).forEach(([selector, handler]) => {
            $doc.on('click.dashboard', selector, handler);
        });

        // 4. Debounced Search Input with the '.dashboard' namespace
        $doc.on('input.dashboard', '#db-quick-search-input', (e) => {
            const query = (e.target?.value ?? '').trim();
            clearTimeout(this.searchDebounceTimer);
            this.searchDebounceTimer = setTimeout(() => {
                this.handleQuickSearch(query);
            }, 200);
        });

        // 5. Theme Change Listener (safe duplicate prevention)
        if (this._boundThemeHandler) {
            document.removeEventListener('themechanged', this._boundThemeHandler);
        }
        this._boundThemeHandler = () => {
            if (this.summaryData) this.renderDefinitionChart(this.summaryData);
            if (this.dependenciesData) this.renderRadialTidyTree(this.dependenciesData);
        };
        document.addEventListener('themechanged', this._boundThemeHandler);
    }

    /**
     * Fetches all required endpoints in parallel with resilient fallback.
     */
    async loadAllDashboardData() {
        const [
            appResult,
            summaryResult,
            instancesResult,
            conditionsResult,
            dependenciesResult
        ] = await Promise.allSettled([
            httpClient.get(this.endpoints.application),
            httpClient.get(this.endpoints.definitionsSummary),
            httpClient.getWithQuery(this.endpoints.instances, 'pageSize=100&sortBy=initDurationNanos&sortDir=DESC'),
            httpClient.getWithQuery(this.endpoints.conditions, 'pageSize=100'),
            httpClient.getWithQuery(this.endpoints.dependencies, 'pageSize=1000')
        ]);

        if (appResult.status === 'fulfilled') {
            this.applicationData = appResult.value;
            this.renderApplicationInfo(this.applicationData);
        } else {
            console.warn('Could not fetch Application Info:', appResult.reason);
            this.renderApplicationInfoFallback();
        }

        if (summaryResult.status === 'fulfilled') {
            this.summaryData = summaryResult.value;
            this.renderDefinitionKpi(this.summaryData);
            this.renderDefinitionChart(this.summaryData);
        }

        if (instancesResult.status === 'fulfilled') {
            this.instancesData = instancesResult.value;
            this.renderInstancesKpiAndBottlenecks(this.instancesData);
        }

        if (conditionsResult.status === 'fulfilled') {
            this.conditionsData = conditionsResult.value;
            this.renderConditionsKpiAndSummary(this.conditionsData);
        }

        if (dependenciesResult.status === 'fulfilled') {
            this.dependenciesData = dependenciesResult.value;
            this.renderDependenciesKpiAndHubs(this.dependenciesData);
            this.renderRadialTidyTree(this.dependenciesData);
        }

        // Cache bean items for quick search
        this._buildCachedBeansList();
    }

    /**
     * Renders Application information hero banner.
     */
    renderApplicationInfo(app) {
        if (!app) return;

        const name = app.name || 'Spring Application';
        $('#hero-app-name').text(name);

        // Spring Info
        const bootVersion = app.spring?.bootVersion || '3.x';
        const frameworkVersion = app.spring?.frameworkVersion || '6.x';
        $('#hero-spring-boot').html(`Boot: <span class="font-mono font-bold text-emerald-300">v${bootVersion}</span>`);
        $('#hero-spring-framework').html(`Framework: <span class="font-mono text-slate-300">v${frameworkVersion}</span>`);

        // Java Info
        const javaVersion = app.java?.version || '21';
        const javaVendor = app.java?.vendor || 'OpenJDK';
        $('#hero-java-version').html(`Version: <span class="font-mono font-bold text-amber-300">Java ${javaVersion}</span>`);
        $('#hero-java-vendor').html(`Vendor: <span class="font-mono text-slate-300">${javaVendor}</span>`);

        // Startup Info
        const rawDuration = app.startup?.startupDuration;
        const formattedDuration = this._formatStartupDuration(rawDuration);
        const rawStartedAt = app.startup?.startedAt;
        const formattedStartedAt = rawStartedAt ? new Date(rawStartedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--';

        $('#hero-startup-duration').html(`Duration: <span class="font-mono font-bold text-cyan-300">${formattedDuration}</span>`);
        $('#hero-started-at').html(`Started: <span class="font-mono text-slate-300">${formattedStartedAt}</span>`);

        // Profiles
        const activeProfiles = Array.from(app.activeProfiles || []);
        const $profilesContainer = $('#hero-profiles-list').empty();
        if (activeProfiles.length > 0) {
            activeProfiles.forEach(p => {
                $profilesContainer.append(`<span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-primary/40 text-purple-200 border border-purple-400/30">${p}</span>`);
            });
        } else {
            $profilesContainer.append('<span class="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-white/10 text-slate-300">default</span>');
        }

        // Live Uptime Ticker
        if (rawStartedAt) {
            this._startUptimeTracker(new Date(rawStartedAt));
        }
    }

    renderApplicationInfoFallback() {
        $('#hero-app-name').text('Spring Boot Application');
        $('#hero-spring-boot').html('Boot: <span class="font-mono text-emerald-300">Active</span>');
        $('#hero-spring-framework').html('Framework: <span class="font-mono text-slate-300">Detected</span>');
        $('#hero-java-version').html('Java: <span class="font-mono text-amber-300">Runtime</span>');
        $('#hero-java-vendor').html('Vendor: <span class="font-mono text-slate-300">Standard</span>');
        $('#hero-startup-duration').html('Duration: <span class="font-mono text-cyan-300">Ready</span>');
        $('#hero-started-at').html('Status: <span class="font-mono text-slate-300">Live</span>');
    }

    /**
     * Renders Bean Definitions KPI and prepares summary counts.
     */
    renderDefinitionKpi(summary) {
        if (!summary) return;

        const total = summary.totalBeanDefinitions || 0;
        $('#kpi-definitions-count').text(total.toLocaleString());

        const scopes = summary.scopeDistribution || {};
        const singletons = scopes.singleton || scopes.SINGLETON || 0;
        const prototypes = scopes.prototype || scopes.PROTOTYPE || 0;

        $('#kpi-definitions-sub').html(`
            <span><strong class="text-purple-600 dark:text-purple-400">${singletons}</strong> Singleton</span>
            <span><strong class="text-gray-700 dark:text-gray-300">${prototypes}</strong> Prototype</span>
        `);
    }

    /**
     * Renders Chart.js Doughnut for Bean Definition breakdown.
     */
    renderDefinitionChart(summary) {
        if (!summary) return;

        const total = summary.totalBeanDefinitions || 0;
        $('#db-chart-total').text(total.toLocaleString());

        let labels = [];
        let data = [];
        let colors = [];
        let footerText = '';

        const isDark = document.documentElement.classList.contains('dark');
        const borderColor = isDark ? '#0f172a' : '#ffffff';

        const CHART_CONFIGS = {
            scope: {
                getDistribution: (s) => s?.scopeDistribution,
                formatLabel: (k) => capitalize(k),
                getColor: (l) => SCOPE_COLORS[l] || '#a855f7',
                getFooter: (len) => `Showing ${len} active scope distributions`,
            },
            role: {
                getDistribution: (s) => s?.roleDistribution,
                formatLabel: (k) => capitalize(k.replace('ROLE_', '')),
                getColor: (l) => ROLE_COLORS[l] || '#3b82f6',
                getFooter: (len) => `Showing ${len} Spring bean roles`,
            },
            loading: {
                getDistribution: (s) => s?.loadingModeDistribution,
                formatLabel: (k) => capitalize(k),
                getColor: (l) => LOADING_MODE_COLORS[l] || '#3b82f6',
                getFooter: () => 'Showing Lazy vs Eager loading modes',
            },
        };

        const config = CHART_CONFIGS[this.activeChartMode];
        if (config) {
            const rawMap = config.getDistribution(summary) || {};
            const entries = Object.entries(rawMap);

            labels = entries.map(([key]) => config.formatLabel(key));
            data = entries.map(([, val]) => val);
            colors = labels.map((label) => config.getColor(label));
            footerText = config.getFooter(labels.length);
        }

        $('#db-chart-footer-info').text(footerText);

        // Render Custom Legend
        const $legend = $('#db-definition-legend').empty();
        labels.forEach((label, idx) => {
            const val = data[idx] || 0;
            const pct = formatPercentage(val, total);
            const col = colors[idx] || '#6366f1';

            $legend.append(`
                <div class="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors text-xs">
                    <div class="flex items-center gap-2 min-w-0">
                        <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background-color: ${col}"></span>
                        <span class="font-medium text-gray-700 dark:text-gray-300 truncate">${label}</span>
                    </div>
                    <div class="flex items-center gap-2 flex-shrink-0">
                        <span class="font-bold text-gray-800 dark:text-white font-mono">${val}</span>
                        <span class="text-[11px] text-gray-400 dark:text-gray-500 font-mono w-9 text-right">${pct}</span>
                    </div>
                </div>
            `);
        });

        // Render Chart.js
        const canvas = document.getElementById('dbDefinitionChart');
        if (!canvas) return;

        if (this.chartInstance) {
            this.chartInstance.destroy();
            this.chartInstance = null;
        }

        if (typeof Chart === 'undefined') return;

        this.chartInstance = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data: data.length > 0 ? data : [1],
                    backgroundColor: data.length > 0 ? colors : ['#94a3b8'],
                    borderWidth: 2,
                    borderColor: borderColor,
                    hoverOffset: 6
                }]
            },
            options: {
                cutout: '72%',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: true,
                        callbacks: {
                            label: (ctx) => {
                                const val = ctx.raw || 0;
                                const pct = formatPercentage(val, total);
                                return ` ${ctx.label}: ${val} (${pct})`;
                            }
                        }
                    }
                }
            }
        });
    }

    _setChartMode(mode) {
        this.activeChartMode = mode;

        $('#btn-chart-scope, #btn-chart-role, #btn-chart-loading')
            .removeClass('bg-white dark:bg-slate-700 text-gray-800 dark:text-white shadow-sm')
            .addClass('text-gray-500 dark:text-gray-400');

        $(`#btn-chart-${mode}`)
            .removeClass('text-gray-500 dark:text-gray-400')
            .addClass('bg-white dark:bg-slate-700 text-gray-800 dark:text-white shadow-sm');

        if (this.summaryData) {
            this.renderDefinitionChart(this.summaryData);
        }
    }

    /**
     * Renders Bean Instances KPI and top 5 slowest initializing beans.
     */
    renderInstancesKpiAndBottlenecks(instancesResponse) {
        if (!instancesResponse) return;

        const items = Array.isArray(instancesResponse?.content)
            ? instancesResponse.content
            : (Array.isArray(instancesResponse?.items)
                ? instancesResponse.items
                : (Array.isArray(instancesResponse) ? instancesResponse : []));

        const total = instancesResponse.totalElements ?? items.length;

        $('#kpi-instances-count').text(total.toLocaleString());

        // Compute total startup cost
        let totalNanos = 0;
        let maxNanos = 0;
        items.forEach(inst => {
            const nanos = inst.initDurationNanos || 0;
            totalNanos += nanos;
            if (nanos > maxNanos) maxNanos = nanos;
        });

        const formattedTotalCost = this._formatNanos(totalNanos);
        const formattedMaxLatency = this._formatNanos(maxNanos);

        $('#kpi-instances-sub').html(`
            <span>Total startup cost: <strong class="text-emerald-600 dark:text-emerald-400 font-mono">${formattedTotalCost}</strong></span>
        `);

        $('#db-slowest-total-cost').html(`Total Cost: <strong class="text-gray-700 dark:text-gray-300 font-mono">${formattedTotalCost}</strong>`);
        $('#db-slowest-max-latency').html(`Max Latency: <strong class="font-mono">${formattedMaxLatency}</strong>`);

        // Sort items by initDurationNanos descending and pick top 5
        const sorted = [...items].sort((a, b) => (b.initDurationNanos || 0) - (a.initDurationNanos || 0));
        const top5 = sorted.slice(0, 5);
        const topMaxNanos = top5.length > 0 ? (top5[0].initDurationNanos || 1) : 1;

        const $list = $('#db-slowest-beans-list').empty();
        const template = document.getElementById('tpl-dashboard-slowest-row');

        if (!template || top5.length === 0) {
            $list.append('<div class="text-center py-6 text-xs text-gray-400">No instance initialization records found.</div>');
            return;
        }

        top5.forEach((item, index) => {
            const clone = template.content.cloneNode(true);
            const $row = $(clone.querySelector('.slowest-bean-item'));

            const durationNanos = item.initDurationNanos || 0;
            const formattedDuration = this._formatNanos(durationNanos);
            const meta = resolveBeanMetadata(item);
            const pct = Math.max(8, Math.min(100, Math.round((durationNanos / topMaxNanos) * 100)));

            $row.attr('data-bean-name', item.beanName || '');
            $row.find('[data-field="rank"]').text(index + 1);
            $row.find('[data-field="icon"]')
                .css('color', meta.color)
                .text(meta.icon);
            $row.find('[data-field="name"]').text(item.beanName || '--');
            $row.find('[data-field="type"]').text(item.type || '--');

            const durationMs = durationNanos / 1_000_000;
            const $bar = $row.find('[data-field="latency-bar"]');
            $bar.css('width', `${pct}%`);

            const $badge = $row.find('[data-field="latency-badge"]');
            $badge.text(formattedDuration);

            // Latency color code
            if (durationMs >= 50) {
                $bar.addClass('bg-red-500');
                $badge.addClass('bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800');
            } else if (durationMs >= 10) {
                $bar.addClass('bg-amber-500');
                $badge.addClass('bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800');
            } else {
                $bar.addClass('bg-emerald-500');
                $badge.addClass('bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800');
            }

            // Click to navigate to timeline
            $row.on('click', () => {
                if (item.beanName) {
                    sessionStorage.setItem('springlens_selected_bean', item.beanName);
                }
                window.location.hash = '#/timeline';
            });

            $list.append($row);
        });
    }

    /**
     * Renders Condition evaluations KPI, match ratio progress bar, and notable auto-configs.
     */
    renderConditionsKpiAndSummary(conditionsResponse) {
        if (!conditionsResponse) return;

        const items = Array.isArray(conditionsResponse?.content)
            ? conditionsResponse.content
            : (Array.isArray(conditionsResponse?.items)
                ? conditionsResponse.items
                : (Array.isArray(conditionsResponse) ? conditionsResponse : []));

        const total = conditionsResponse.totalElements ?? items.length;

        let matched = 0;
        let notMatched = 0;

        items.forEach(c => {
            if (c.outcome === 'MATCHED') matched++;
            else notMatched++;
        });

        // Extrapolate or calculate percentages
        const evaluatedTotal = matched + notMatched || total || 1;
        const matchedPct = Math.round((matched / evaluatedTotal) * 100);
        const notMatchedPct = 100 - matchedPct;

        $('#kpi-conditions-count').text(total.toLocaleString());
        $('#kpi-conditions-sub').html(`
            <span><strong class="text-emerald-600 dark:text-emerald-400">${matched}</strong> Matched (${matchedPct}%)</span>
            <span><strong class="text-slate-500">${notMatched}</strong> Skipped</span>
        `);

        // Update Progress Bar
        $('#db-cond-matched-label').text(`${matched} (${matchedPct}%)`);
        $('#db-cond-unmatched-label').text(`${notMatched} (${notMatchedPct}%)`);
        $('#db-cond-matched-bar').css('width', `${matchedPct}%`);
        $('#db-cond-unmatched-bar').css('width', `${notMatchedPct}%`);

        $('#db-conditions-eval-count').text(`${total} Total Checked`);

        // Render Recent Samples
        const $list = $('#db-conditions-sample-list').empty();
        const template = document.getElementById('tpl-dashboard-condition-row');

        if (!template || items.length === 0) {
            $list.append('<div class="text-center py-4 text-xs text-gray-400">No condition reports available.</div>');
            return;
        }

        const sample = items.slice(0, 4);
        sample.forEach(cond => {
            const clone = template.content.cloneNode(true);
            const $row = $(clone.firstElementChild);

            const isMatch = cond.outcome === 'MATCHED';
            const shortSource = cond.source?.split('.').pop() || cond.source || '--';

            $row.find('[data-field="dot"]')
                .addClass(isMatch ? 'bg-emerald-500' : 'bg-slate-400');
            $row.find('[data-field="source"]')
                .text(shortSource)
                .attr('title', cond.source);

            const $badge = $row.find('[data-field="outcome-badge"]');
            $badge.text(cond.outcome || 'UNKNOWN');

            if (isMatch) {
                $badge.addClass('bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800');
            } else {
                $badge.addClass('bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700');
            }

            $list.append($row);
        });
    }

    /**
     * Renders Dependency Graph KPI and top hub beans (highest fan-in).
     */
    renderDependenciesKpiAndHubs(dependenciesResponse) {
        if (!dependenciesResponse) return;

        const items = Array.isArray(dependenciesResponse?.content)
            ? dependenciesResponse.content
            : (Array.isArray(dependenciesResponse?.items)
                ? dependenciesResponse.items
                : (Array.isArray(dependenciesResponse) ? dependenciesResponse : []));

        const totalBeans = dependenciesResponse.totalElements ?? items.length;

        // Build dependent fan-in counts
        const dependentCounts = new Map();
        let totalEdges = 0;

        items.forEach(item => {
            const deps = item.dependencies || [];
            totalEdges += deps.length;
            deps.forEach(dep => {
                const count = dependentCounts.get(dep) || 0;
                dependentCounts.set(dep, count + 1);
            });
        });

        $('#kpi-dependencies-count').text(totalBeans.toLocaleString());
        $('#kpi-dependencies-sub').html(`
            <span><strong class="text-blue-600 dark:text-blue-400">${totalEdges}</strong> Dependency Edges</span>
            <span><strong class="text-gray-700 dark:text-gray-300">${dependentCounts.size}</strong> Depended Beans</span>
        `);

        $('#db-graph-footer-stats').text(`${totalBeans} Beans • ${totalEdges} Connections`);

        // Sort Top Hub Beans by fan-in count
        const sortedHubs = Array.from(dependentCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        const $list = $('#db-dependency-hubs-list').empty();
        const template = document.getElementById('tpl-dashboard-hub-row');

        if (!template || sortedHubs.length === 0) {
            $list.append('<div class="text-center py-6 text-xs text-gray-400">No dependency connections detected.</div>');
            return;
        }

        sortedHubs.forEach(([beanName, count], idx) => {
            const clone = template.content.cloneNode(true);
            const $row = $(clone.querySelector('.hub-bean-item'));

            const meta = resolveBeanMetadata({ beanName });

            $row.find('[data-field="rank"]').text(idx + 1);
            $row.find('[data-field="icon"]')
                .css('color', meta.color)
                .text(meta.icon);
            $row.find('[data-field="name"]').text(beanName);
            $row.find('[data-field="type"]').text(`Referenced by other beans`);
            $row.find('[data-field="dependents-count"]').text(`${count} dependents`);

            $list.append($row);
        });
    }

    /**
     * Builds in-memory search lookup list from instances and dependencies.
     */
    _buildCachedBeansList() {
        const set = new Map();

        const instancesList = Array.isArray(this.instancesData?.content)
            ? this.instancesData.content
            : (Array.isArray(this.instancesData?.items) ? this.instancesData.items : []);

        instancesList.forEach(inst => {
            if (inst.beanName) {
                set.set(inst.beanName, {
                    name: inst.beanName,
                    type: inst.type || '',
                    contextId: inst.contextId || ''
                });
            }
        });

        const depsList = Array.isArray(this.dependenciesData?.content)
            ? this.dependenciesData.content
            : (Array.isArray(this.dependenciesData?.items) ? this.dependenciesData.items : []);

        depsList.forEach(item => {
            if (item.beanName && !set.has(item.beanName)) {
                set.set(item.beanName, {
                    name: item.beanName,
                    type: '',
                    contextId: item.contextId || ''
                });
            }
        });

        this.cachedBeansList = Array.from(set.values());
    }

    /**
     * Quick search handler.
     */
    handleQuickSearch(query) {
        const $resultsContainer = $('#db-quick-search-results');
        const $chipsContainer = $('#db-quick-search-chips').empty();

        if (!query || query.length < 2) {
            $resultsContainer.addClass('hidden');
            return;
        }

        const lower = query.toLowerCase();
        const matches = this.cachedBeansList.filter(b =>
            b.name.toLowerCase().includes(lower) || b.type.toLowerCase().includes(lower)
        ).slice(0, 9);

        if (matches.length === 0) {
            $chipsContainer.append('<div class="col-span-full text-xs text-gray-400 py-2">No matching beans found for query.</div>');
            $resultsContainer.removeClass('hidden');
            return;
        }

        matches.forEach(b => {
            const meta = resolveBeanMetadata({ beanName: b.name, type: b.type });
            const chip = $(`
                <div class="flex items-center justify-between p-2 rounded-xl bg-gray-50 dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-purple-950/30 border border-gray-200 dark:border-slate-700 hover:border-primary/40 transition-all cursor-pointer group">
                    <div class="flex items-center gap-2 min-w-0 flex-1">
                        <span class="material-symbols-outlined text-[16px]" style="color: ${meta.color}">${meta.icon}</span>
                        <span class="text-xs font-bold text-gray-800 dark:text-gray-200 group-hover:text-primary transition-colors truncate">${b.name}</span>
                    </div>
                    <div class="flex items-center gap-1">
                        <a href="#/definitions" class="px-1.5 py-0.5 text-[10px] font-semibold text-primary dark:text-purple-300 hover:underline">Def</a>
                        <a href="#/timeline" class="px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline">Inst</a>
                    </div>
                </div>
            `);
            $chipsContainer.append(chip);
        });

        $resultsContainer.removeClass('hidden');
    }

    /**
     * Starts interval to calculate live uptime.
     */
    _startUptimeTracker(startDate) {
        if (this.uptimeInterval) clearInterval(this.uptimeInterval);

        const $heroAppUptime = $('#hero-app-uptime');

        const update = () => {
            const diffMs = Date.now() - startDate.getTime();
            if (diffMs < 0) {
                $heroAppUptime.text('Just started');
                return;
            }

            const totalSec = Math.floor(diffMs / 1000);
            const hrs = Math.floor(totalSec / 3600);
            const mins = Math.floor((totalSec % 3600) / 60);
            const secs = totalSec % 60;

            let formatted = '';
            if (hrs > 0) {
                formatted = `${hrs}h ${mins}m ${secs}s`;
            } else if (mins > 0) {
                formatted = `${mins}m ${secs}s`;
            } else {
                formatted = `${secs}s`;
            }

            $heroAppUptime.text(formatted);
        };

        update();
        this.uptimeInterval = setInterval(update, 1000);
    }

    /**
     * Formats startup duration string or object into human-readable seconds/millis.
     */
    _formatStartupDuration(val) {
        if (!val) return '--';

        if (typeof val === 'number') {
            return `${val.toFixed(2)}s`;
        }

        if (typeof val === 'string') {
            // ISO-8601 duration: PT1.854S or PT2M1.5S
            if (val.startsWith('PT')) {
                const secondsMatch = val.match(/([\d.]+)S/);
                const minutesMatch = val.match(/(\d+)M/);

                let res = '';
                if (minutesMatch) res += `${minutesMatch[1]}m `;
                if (secondsMatch) res += `${parseFloat(secondsMatch[1]).toFixed(2)}s`;
                return res.trim() || val;
            }
            return val;
        }

        if (typeof val === 'object' && val.seconds !== undefined) {
            const sec = (val.seconds || 0) + ((val.nano || 0) / 1e9);
            return `${sec.toFixed(2)}s`;
        }

        return String(val);
    }

    /**
     * Formats nanoseconds into µs, ms, or s.
     */
    _formatNanos(nanos) {
        if (!nanos || isNaN(nanos)) return '0 ms';

        if (nanos < 1_000_000) {
            return `${(nanos / 1_000).toFixed(1)} µs`;
        }
        if (nanos < 1_000_000_000) {
            return `${(nanos / 1_000_000).toFixed(2)} ms`;
        }
        return `${(nanos / 1_000_000_000).toFixed(2)} s`;
    }

    /**
     * Renders Interactive D3 Force-Directed Tree with Precision Spring Root Core and Natural 3D Glass Orbs.
     * Node labels are removed from canvas and presented via floating glassmorphic tooltips.
     */
    renderRadialTidyTree(dependenciesResponse) {
        if (!dependenciesResponse) return;

        const $dbRadialLoading = $('#db-radial-loading');

        const items = Array.isArray(dependenciesResponse?.content)
            ? dependenciesResponse.content
            : (Array.isArray(dependenciesResponse?.items)
                ? dependenciesResponse.items
                : (Array.isArray(dependenciesResponse) ? dependenciesResponse : []));

        const $svg = $('#db-radial-tree-svg');
        const svgNode = $svg[0];
        if (!svgNode) return;

        if (items.length === 0) {
            $dbRadialLoading.addClass('hidden');
            $('#db-radial-stats').text('No dependencies found');
            return;
        }

        try {
            if (this.forceSimulation) {
                this.forceSimulation.stop();
                this.forceSimulation = null;
            }
            const treeData = GraphTreeBuilder.buildByContext(items);
            if (!treeData) {
                $dbRadialLoading.addClass('hidden');
                return;
            }

            const width = svgNode.clientWidth || 400;
            const height = svgNode.clientHeight || 340;

            const isDark = document.documentElement.classList.contains('dark');
            const defaultLinkStroke = isDark ? '#334155' : '#cbd5e1';
            const rootLinkStroke = '#10b981';

            const hierarchy = d3.hierarchy(treeData);
            const nodes = hierarchy.descendants();
            const links = hierarchy.links();
            const totalNodes = nodes.length;
            const treeDepth = hierarchy.height;
            $('#db-radial-stats').text(`${totalNodes} Beans • ${treeDepth} Levels • Hover or drag nodes`);

            const svg = d3.select(svgNode);
            svg.selectAll('*').remove();

            const getNodeColor = (d) => {
                if (d.depth === 0) return '#10b981';
                const text = `${d.data?.name || ''} ${d.data?.meta?.type || d.data?.type || ''}`.toLowerCase();
                if (/service/.test(text)) return '#34d399';
                if (/repo|data|entity|repository/.test(text)) return '#fbbf24';
                if (/controller|web|rest|endpoint/.test(text)) return '#f472b6';
                if (/config|security|filter|properties/.test(text)) return '#c084fc';
                return '#60a5fa';
            };

            // Main Zoomable SVG Group
            const g = svg.append('g');

            // Zoom Handling
            const zoom = d3.zoom()
                .scaleExtent([0.25, 4.5])
                .on('zoom', (event) => {
                    g.attr('transform', event.transform);
                });

            svg.call(zoom);
            this.radialZoom = zoom;
            this.radialSvg = svg;
            this.radialInitialTransform = d3.zoomIdentity;

            // 1. Render Links Group (Clean, thin linear lines)
            const linksGroup = g.append('g').attr('class', 'tree-links');
            const linkSelection = linksGroup.selectAll('line')
                .data(links)
                .join('line')
                .attr('class', 'tree-link')
                .attr('stroke', d => d.source.depth === 0 ? rootLinkStroke : defaultLinkStroke)
                .attr('stroke-opacity', 0.45)
                .attr('stroke-width', 0.75)
                .attr('stroke-linecap', 'round');

            // 2. Render Nodes Group (Clean, flat, natural solid colors with zero text clutter)
            const nodesGroup = g.append('g').attr('class', 'tree-nodes');
            const nodeGroups = nodesGroup.selectAll('g')
                .data(nodes)
                .join('g')
                .attr('class', 'tree-node cursor-pointer select-none');

            // Node Rendering (Simple clean solid dots for all nodes including root)
            nodeGroups.each(function (d) {
                const nodeEl = d3.select(this);
                const hasChildren = Boolean(d.children && d.children.length > 0);
                const isRoot = d.depth === 0;
                const nodeColor = getNodeColor(d);
                const radius = isRoot ? 6.0 : (hasChildren ? 5.2 : 4.0);

                // Clean Solid Colored Circle
                nodeEl.append('circle')
                    .attr('class', 'node-dot')
                    .attr('r', radius)
                    .attr('fill', nodeColor)
                    .attr('stroke', isDark ? '#0f172a' : '#ffffff')
                    .attr('stroke-width', 1.0);
            });

            // 3. Force Simulation Setup
            const simulation = d3.forceSimulation(nodes)
                .force('link', d3.forceLink(links)
                    .id(d => d.id)
                    .distance(d => d.depth === 1 ? 55 : (d.target.children ? 38 : 28))
                    .strength(0.85)
                )
                .force('charge', d3.forceManyBody()
                    .strength(d => d.depth === 0 ? -180 : (d.children ? -130 : -55))
                    .distanceMax(260)
                )
                .force('collide', d3.forceCollide()
                    .radius(d => (d.depth === 0 ? 10 : (d.children ? 8 : 6)) + 3)
                    .iterations(2)
                )
                .force('center', d3.forceCenter(width / 2, height / 2).strength(0.08))
                .force('x', d3.forceX(width / 2).strength(0.04))
                .force('y', d3.forceY(height / 2).strength(0.04));

            this.forceSimulation = simulation;

            // Tick updates
            simulation.on('tick', () => {
                linkSelection
                    .attr('x1', d => d.source.x)
                    .attr('y1', d => d.source.y)
                    .attr('x2', d => d.target.x)
                    .attr('y2', d => d.target.y);

                nodeGroups.attr('transform', d => `translate(${d.x}, ${d.y})`);
            });

            // 4. Drag & Drop Interaction
            const drag = d3.drag()
                .on('start', (event, d) => {
                    if (!event.active) simulation.alphaTarget(0.3).restart();
                    d.fx = d.x;
                    d.fy = d.y;
                })
                .on('drag', (event, d) => {
                    d.fx = event.x;
                    d.fy = event.y;
                })
                .on('end', (event, d) => {
                    if (!event.active) simulation.alphaTarget(0);
                    d.fx = null;
                    d.fy = null;
                });

            nodeGroups.call(drag);

            // 5. Interactive Hover & Path Tracing
            const $tooltip = $('#db-radial-tooltip');

            const getAncestors = (node) => {
                const ancestors = [];
                let curr = node;
                while (curr) {
                    ancestors.push(curr);
                    curr = curr.parent;
                }
                return ancestors;
            };

            const getDescendants = (node) => {
                const descendants = [];
                const traverse = (n) => {
                    descendants.push(n);
                    if (n.children) n.children.forEach(traverse);
                };
                traverse(node);
                return descendants;
            };

            nodeGroups.on('mouseenter', (event, d) => {
                const ancestors = new Set(getAncestors(d));
                const descendants = new Set(getDescendants(d));

                // 1. Highlight connected links with slim normal color (no yellow/orange)
                const hoverActiveColor = isDark ? '#94a3b8' : '#475569';
                linkSelection
                    .transition().duration(150)
                    .attr('stroke', (link) => {
                        if ((ancestors.has(link.target) && ancestors.has(link.source)) ||
                            (descendants.has(link.target) && descendants.has(link.source))) {
                            return hoverActiveColor;
                        }
                        return defaultLinkStroke;
                    })
                    .attr('stroke-width', (link) => {
                        if ((ancestors.has(link.target) && ancestors.has(link.source)) ||
                            (descendants.has(link.target) && descendants.has(link.source))) return 0.95;
                        return 0.5;
                    })
                    .attr('stroke-opacity', (link) => {
                        if ((ancestors.has(link.target) && ancestors.has(link.source)) ||
                            (descendants.has(link.target) && descendants.has(link.source))) return 0.9;
                        return 0.15;
                    });

                // 2. Highlight active nodes & dim others
                nodeGroups
                    .transition().duration(150)
                    .attr('opacity', (node) => {
                        if (ancestors.has(node) || descendants.has(node)) return 1;
                        return 0.2;
                    });

                // Subtle scale for hovered element
                d3.select(event.currentTarget).selectAll('circle.node-dot')
                    .transition().duration(150)
                    .attr('transform', 'scale(1.3)')
                    .attr('stroke', isDark ? '#ffffff' : '#0f172a')
                    .attr('stroke-width', 1.5);

                // 3. Render Rich Glassmorphic Tooltip Card
                const isRootNode = d.depth === 0;
                const meta = resolveBeanMetadata(d.data);
                const titleName = isRootNode ? contextName : d.data.name;
                const type = isRootNode ? 'Root Application Context' : (d.data.meta?.type || d.data.type || 'Spring Bean');
                const scope = isRootNode ? 'CONTEXT' : (d.data.meta?.scope || 'singleton');
                const directChildren = d.children ? d.children.length : 0;
                const totalSubtree = descendants.size - 1;
                const parentName = d.parent ? (d.parent.data.name || d.parent.data.fullName || 'Root') : 'None';

                // Resolve matching badge color
                let badgeClass = 'bg-blue-400/20 text-blue-300';
                let iconColor = '#60a5fa';
                if (isRootNode) {
                    badgeClass = 'bg-emerald-500/20 text-emerald-300';
                    iconColor = '#10b981';
                } else {
                    const color = getNodeColor(d);
                    if (color === '#34d399') { badgeClass = 'bg-emerald-400/20 text-emerald-300'; iconColor = '#34d399'; }
                    else if (color === '#fbbf24') { badgeClass = 'bg-amber-400/20 text-amber-300'; iconColor = '#fbbf24'; }
                    else if (color === '#f472b6') { badgeClass = 'bg-pink-400/20 text-pink-300'; iconColor = '#f472b6'; }
                    else if (color === '#c084fc') { badgeClass = 'bg-purple-400/20 text-purple-300'; iconColor = '#c084fc'; }
                }

                $tooltip.html(`
                    <div class="flex items-center gap-2 mb-1.5">
                        <span class="material-symbols-outlined text-[16px]" style="color: ${iconColor}">${isRootNode ? 'account_tree' : meta.icon}</span>
                        <span class="font-bold text-white text-xs truncate flex-1">${titleName}</span>
                        <span class="px-1.5 py-0.2 rounded text-[9px] font-mono uppercase ${badgeClass} border border-white/10">${scope}</span>
                    </div>
                    <div class="text-[10px] text-gray-300 font-mono truncate mb-2" title="${type}">${type}</div>
                    <div class="grid grid-cols-2 gap-1.5 text-[10px] pt-1.5 border-t border-white/10 text-gray-300">
                        <div><span class="text-gray-400">Depth:</span> <strong class="text-white font-mono">L${d.depth}</strong></div>
                        <div><span class="text-gray-400">Direct Deps:</span> <strong class="text-blue-300 font-mono">${directChildren}</strong></div>
                        <div><span class="text-gray-400">Subtree:</span> <strong class="text-amber-300 font-mono">${totalSubtree}</strong></div>
                        <div class="truncate" title="${parentName}"><span class="text-gray-400">Parent:</span> <strong class="text-white font-mono">${parentName}</strong></div>
                    </div>
                    ${!isRootNode ? `
                    <div class="mt-2 pt-1.5 border-t border-white/10 flex items-center justify-between text-[10px] text-blue-400 font-semibold">
                        <span>Inspect in Full Graph</span>
                        <span class="material-symbols-outlined text-[12px]">open_in_new</span>
                    </div>` : ''}
                `).removeClass('hidden');
            })
                .on('mousemove', (event) => {
                    const containerRect = svgNode.getBoundingClientRect();
                    const x = event.clientX - containerRect.left + 14;
                    const y = event.clientY - containerRect.top - 20;
                    $tooltip.css({ left: `${Math.min(x, containerRect.width - 240)}px`, top: `${Math.max(10, y)}px` });
                })
                .on('mouseleave', (event, d) => {
                    linkSelection
                        .transition().duration(200)
                        .attr('stroke', d => d.source.depth === 0 ? rootLinkStroke : defaultLinkStroke)
                        .attr('stroke-width', 0.75)
                        .attr('stroke-opacity', 0.45);

                    nodeGroups
                        .transition().duration(200)
                        .attr('opacity', 1);

                    d3.select(event.currentTarget).selectAll('circle.node-dot')
                        .transition().duration(200)
                        .attr('transform', 'scale(1)')
                        .attr('stroke', isDark ? '#0f172a' : '#ffffff')
                        .attr('stroke-width', 1.0);

                    $tooltip.addClass('hidden');
                })
                .on('click', (event, d) => {
                    if (d.data.fullName) {
                        sessionStorage.setItem('springlens_selected_bean', d.data.fullName);
                    }
                    window.location.hash = '#/graph';
                });

            $dbRadialLoading.addClass('hidden');
        } catch (err) {
            console.error('Error rendering Force-Directed Tree:', err);
            $dbRadialLoading.addClass('hidden');
        }
    }

    _resetRadialZoom() {
        if (this.radialSvg && this.radialZoom && this.radialInitialTransform) {
            this.radialSvg.transition().duration(300).call(this.radialZoom.transform, this.radialInitialTransform);
            if (this.forceSimulation) {
                this.forceSimulation.alpha(0.3).restart();
            }
        }
    }
}
