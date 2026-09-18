import {
    Formatter,
    SCOPE_COLORS,
    ROLE_COLORS,
    LOADING_MODE_COLORS
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
 * mode toggles (scope/role/loading), and custom legend calculations.
 */
class DefinitionChartWidget {

    constructor() {
        this.chartInstance = null;
        this.activeMode = 'scope'; // 'scope' | 'role' | 'loading'
        this.summaryData = null;
    }

    /**
     * Computes definition KPI numbers.
     * @param {Object} beanDefinitionSummary
     * @returns {Object}
     */
    computeKpi(beanDefinitionSummary) {
        if (!beanDefinitionSummary) {
            return {
                total: '--',
                singletons: '0',
                prototypes: '0'
            };
        }

        const {totalBeanDefinitions, scopeDistribution} = beanDefinitionSummary;

        return {
            total: totalBeanDefinitions.toLocaleString(),
            singletons: (scopeDistribution.singleton || 0).toLocaleString(),
            prototypes: (scopeDistribution.prototype || 0).toLocaleString()
        };
    }

    /**
     * Computes legend items, percentages, and footer for the active mode.
     * @param {Object} [beanDefinitionSummary]
     * @param {string} [mode]
     * @returns {Object}
     */
    computeLegend(beanDefinitionSummary = this.summaryData, mode = this.activeMode) {
        if (!beanDefinitionSummary) {
            return {
                total: '--',
                footerText: 'Showing scope breakdown',
                legendItems: [],
                labels: [],
                data: [],
                colors: []
            };
        }

        const total = beanDefinitionSummary.totalBeanDefinitions || 0;
        const config = CHART_CONFIGS[mode] || CHART_CONFIGS.scope;
        const rawMap = config.getDistribution(beanDefinitionSummary) || {};
        const entries = Object.entries(rawMap);

        const labels = entries.map(([key]) => config.formatLabel(key));
        const data = entries.map(([, val]) => val);
        const colors = labels.map((label) => config.getColor(label));
        const footerText = config.getFooter(labels.length);

        const legendItems = labels.map((label, idx) => {
            const val = data[idx] || 0;
            const pct = Formatter.formatPercentage(val, total);
            const color = colors[idx] || '#6366f1';
            return {
                label,
                value: val,
                percentage: pct,
                color
            };
        });

        return {
            total: total.toLocaleString(),
            footerText,
            labels,
            data,
            colors,
            legendItems
        };
    }

    /**
     * Renders definition KPIs and the doughnut chart canvas.
     * @param {Object} summary - Definitions summary data.
     * @returns {Object} Computed legend and KPI metrics
     */
    render(summary) {
        if (!summary) return null;
        this.summaryData = summary;
        this.renderChart(summary);
        return {
            kpi: this.computeKpi(summary),
            legend: this.computeLegend(summary, this.activeMode)
        };
    }

    /**
     * Renders or refreshes Chart.js doughnut chart on canvas.
     * @param {Object} [summary]
     * @param {string} [mode]
     */
    renderChart(summary = this.summaryData, mode = this.activeMode) {
        if (!summary) return;
        this.summaryData = summary;
        this.activeMode = mode;

        const { labels, data, colors, total } = this.computeLegend(summary, mode);
        const isDark = document.documentElement.classList.contains('dark');
        const rawTotal = summary.totalBeanDefinitions || 0;

        // Render Chart.js Canvas
        this._renderCanvasChart(labels, data, colors, rawTotal, isDark);
    }

    /**
     * Switches the active chart mode (scope | role | loading) and redraws canvas.
     * @param {string} mode
     * @returns {Object} Updated legend data
     */
    setMode(mode) {
        if (!CHART_CONFIGS[mode]) return null;
        this.activeMode = mode;

        if (this.summaryData) {
            this.renderChart(this.summaryData, mode);
            return this.computeLegend(this.summaryData, mode);
        }
        return null;
    }

    /**
     * Re-renders chart when theme changes.
     */
    onThemeChanged() {
        if (this.summaryData) {
            this.renderChart(this.summaryData, this.activeMode);
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

const chartWidget = new DefinitionChartWidget();
export default chartWidget;
