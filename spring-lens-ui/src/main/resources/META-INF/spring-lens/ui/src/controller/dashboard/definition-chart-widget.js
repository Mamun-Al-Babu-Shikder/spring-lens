import {
    Formatter,
    SCOPE_COLORS,
    ROLE_COLORS,
    LOADING_MODE_COLORS,
    TemplateEngine
} from '../../helper/index.js';

/**
 * Strategy configurations for definition chart modes.
 */
const CHART_CONFIGS = {
    scope: {
        getDistribution: (s) => s?.scopeDistribution,
        formatLabel: (k) => Formatter.capitalize(k),
        getColor: (l) => SCOPE_COLORS[l] || '#a855f7',
        getFooter: (len) => `Showing ${len} active scope distributions`,
    },
    role: {
        getDistribution: (s) => s?.roleDistribution,
        formatLabel: (k) => Formatter.capitalize(k.replace('ROLE_', '')),
        getColor: (l) => ROLE_COLORS[l] || '#3b82f6',
        getFooter: (len) => `Showing ${len} Spring bean roles`,
    },
    loading: {
        getDistribution: (s) => s?.loadingModeDistribution,
        formatLabel: (k) => Formatter.capitalize(k),
        getColor: (l) => LOADING_MODE_COLORS[l] || '#3b82f6',
        getFooter: () => 'Showing Lazy vs Eager loading modes',
    },
};

/**
 * Widget responsible for the Bean Definitions KPI, Chart.js Doughnut breakdown,
 * mode toggles (scope/role/loading), and custom legend rendering.
 */
export default class DefinitionChartWidget {

    constructor() {
        this.chartInstance = null;
        this.activeMode = 'scope'; // 'scope' | 'role' | 'loading'
        this.summaryData = null;
    }

    /**
     * Renders definition KPIs and the doughnut chart.
     * @param {Object} summary - Definitions summary data.
     */
    render(summary) {
        if (!summary) return;
        this.summaryData = summary;
        this.renderKpi(summary);
        this.renderChart(summary);
    }

    /**
     * Renders Definition KPI summary numbers.
     * @param {Object} summary
     */
    renderKpi(summary) {
        if (!summary) return;

        const total = summary.totalBeanDefinitions || 0;
        $('#kpi-definitions-count').text(total.toLocaleString());

        const scopes = summary.scopeDistribution || {};
        const singletons = scopes.singleton || 0;
        const prototypes = scopes.prototype || 0;

        $('#kpi-def-singletons').text(singletons.toLocaleString());
        $('#kpi-def-prototypes').text(prototypes.toLocaleString());
    }

    /**
     * Renders or refreshes Chart.js doughnut chart and custom HTML legend.
     * @param {Object} [summary]
     */
    renderChart(summary = this.summaryData) {
        if (!summary) return;

        const total = summary.totalBeanDefinitions || 0;
        $('#db-chart-total').text(total.toLocaleString());

        let labels = [];
        let data = [];
        let colors = [];
        let footerText = '';

        const isDark = document.documentElement.classList.contains('dark');
        const config = CHART_CONFIGS[this.activeMode];
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
        this._renderLegend(labels, data, colors, total);

        // Render Chart.js Canvas
        this._renderCanvasChart(labels, data, colors, total, isDark);
    }

    /**
     * Switches the active chart mode (scope | role | loading).
     * @param {string} mode
     */
    setMode(mode) {
        if (!CHART_CONFIGS[mode]) return;
        if (this.activeMode === mode && this.chartInstance) return;

        this.activeMode = mode;

        const activeCls = 'bg-white dark:bg-slate-700 text-gray-800 dark:text-white shadow-sm';
        const inactiveCls = 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white';

        $('#chart-mode-toggle [data-chart-mode]').each(function () {
            const btnMode = $(this).data('chart-mode') || $(this).attr('data-chart-mode');
            const isCurrent = btnMode === mode;
            $(this)
                .toggleClass(activeCls, isCurrent)
                .toggleClass(inactiveCls, !isCurrent)
                .attr('aria-pressed', String(isCurrent));
        });

        if (this.summaryData) {
            this.renderChart(this.summaryData);
        }
    }

    /**
     * Re-renders chart when theme changes.
     */
    onThemeChanged() {
        if (this.summaryData) {
            this.renderChart(this.summaryData);
        }
    }

    /**
     * Destroys active Chart.js instance and cleans up references.
     */
    destroy() {
        if (this.chartInstance) {
            this.chartInstance.destroy();
            this.chartInstance = null;
        }
        this.summaryData = null;
    }

    /**
     * @private
     */
    _renderLegend(labels, data, colors, total) {
        const $legend = $('#db-definition-legend').empty();
        const fragment = document.createDocumentFragment();

        labels.forEach((label, idx) => {
            const val = data[idx] || 0;
            const pct = Formatter.formatPercentage(val, total);
            const col = colors[idx] || '#6366f1';

            const clone = TemplateEngine.clone('tpl-dashboard-chart-legend-item');
            if (!clone) return;

            const $item = $(clone.firstElementChild);
            $item.find('[data-field="dot"]').css('background-color', col);
            $item.find('[data-field="label"]').text(label).attr('title', label);
            $item.find('[data-field="val"]').text(val);
            $item.find('[data-field="pct"]').text(pct);

            fragment.appendChild(clone);
        });

        $legend.append(fragment);
    }

    /**
     * @private
     */
    _renderCanvasChart(labels, data, colors, total, isDark) {
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
                    borderWidth: 0,
                    borderRadius: 6,
                    spacing: 3,
                    hoverOffset: 6
                }]
            },
            options: {
                cutout: '74%',
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    animateScale: true,
                    animateRotate: true,
                    duration: 800,
                    easing: 'easeOutQuart'
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: true,
                        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.94)' : 'rgba(255, 255, 255, 0.96)',
                        titleColor: isDark ? '#f8fafc' : '#0f172a',
                        bodyColor: isDark ? '#cbd5e1' : '#334155',
                        borderColor: isDark ? 'rgba(51, 65, 85, 0.8)' : 'rgba(226, 232, 240, 0.9)',
                        borderWidth: 1,
                        padding: 10,
                        boxPadding: 5,
                        usePointStyle: true,
                        pointStyle: 'circle',
                        titleFont: { family: 'Inter, sans-serif', size: 12, weight: 'bold' },
                        bodyFont: { family: 'Inter, sans-serif', size: 12 },
                        callbacks: {
                            label: (ctx) => {
                                const val = ctx.raw || 0;
                                const pct = Formatter.formatPercentage(val, total);
                                return ` ${ctx.label}: ${val} (${pct})`;
                            }
                        }
                    }
                }
            }
        });
    }
}
