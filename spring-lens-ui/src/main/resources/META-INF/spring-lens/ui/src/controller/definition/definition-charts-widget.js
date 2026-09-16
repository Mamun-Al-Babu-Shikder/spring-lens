import {
    Formatter,
    ROLE_COLORS,
    SCOPE_COLORS,
    LOADING_MODE_COLORS,
    CONTEXT_THEME_COLORS
} from '../../helper/index.js';

/**
 * Widget responsible for bean definition summary statistics calculation,
 * context distribution, Scope, Role, and Loading Mode Doughnut charts,
 * and custom legend calculations.
 */
export default class DefinitionChartsWidget {

    constructor() {
        this.activeCharts = {
            scopeChart: null,
            roleChart: null,
            loadingModeChart: null
        };
        this.summaryData = null;
    }

    /**
     * Computes reactive view model metrics for summary cards and legends.
     * @param {Object} beanSummary
     * @returns {Object}
     */
    computeMetrics(beanSummary) {
        if (!beanSummary) {
            return {
                totalDefinitions: '--',
                contextDistributionList: [],
                scopeLegend: [],
                roleLegend: [],
                loadingModeLegend: [],
                contextOptions: [],
                scopeOptions: []
            };
        }

        this.summaryData = beanSummary;
        const total = beanSummary.totalBeanDefinitions || 0;

        // Context distribution list
        const contextEntries = Object.entries(beanSummary.contextDistribution || {});
        const contextDistributionList = contextEntries.map(([contextId, count], index) => {
            const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
            const colorClass = CONTEXT_THEME_COLORS[index % CONTEXT_THEME_COLORS.length];
            return {
                contextId,
                count,
                percentage,
                colorClass,
                label: `${percentage}% (${count})`
            };
        });

        // Scope Legend
        const scopeLegend = this._computeLegendItems(
            beanSummary.scopeDistribution || {},
            total,
            key => Formatter.capitalize(key),
            SCOPE_COLORS,
            '#a855f7'
        );

        // Role Legend
        const roleLegend = this._computeLegendItems(
            beanSummary.roleDistribution || {},
            total,
            key => Formatter.capitalize(String(key).replace(/^ROLE_/, '')),
            ROLE_COLORS,
            '#cbd5e1'
        );

        // Loading Mode Legend
        const loadingModeLegend = this._computeLegendItems(
            beanSummary.loadingModeDistribution || {},
            total,
            key => Formatter.capitalize(key),
            LOADING_MODE_COLORS,
            '#a855f7'
        );

        return {
            totalDefinitions: total.toLocaleString(),
            contextDistributionList,
            scopeLegend,
            roleLegend,
            loadingModeLegend,
            contextOptions: Object.keys(beanSummary.contextDistribution || {}),
            scopeOptions: Object.keys(beanSummary.scopeDistribution || {})
        };
    }

    /**
     * Renders Scope, Role, and Loading Mode Doughnut charts on their respective canvases.
     * @param {Object} beanSummary
     */
    renderCharts(beanSummary = this.summaryData) {
        if (!beanSummary) return;
        this.summaryData = beanSummary;
        this.destroyCharts();

        if (typeof Chart === 'undefined') return;

        const total = beanSummary.totalBeanDefinitions || 0;
        const isDark = document.documentElement.classList.contains('dark');

        const { scopeDistribution, roleDistribution, loadingModeDistribution } = beanSummary;

        if (scopeDistribution) {
            this._instantiateDoughnutChart(
                'scopeChart',
                'scopeChart',
                scopeDistribution,
                total,
                key => Formatter.capitalize(key),
                SCOPE_COLORS,
                '#a855f7',
                isDark
            );
        }

        if (roleDistribution) {
            this._instantiateDoughnutChart(
                'roleChart',
                'roleChart',
                roleDistribution,
                total,
                key => Formatter.capitalize(String(key).replace(/^ROLE_/, '')),
                ROLE_COLORS,
                '#cbd5e1',
                isDark
            );
        }

        if (loadingModeDistribution) {
            this._instantiateDoughnutChart(
                'loadingModeChart',
                'loadingModeChart',
                loadingModeDistribution,
                total,
                key => Formatter.capitalize(key),
                LOADING_MODE_COLORS,
                '#a855f7',
                isDark
            );
        }
    }

    /**
     * Backward-compatible render method that calculates metrics and renders charts.
     * @param {Object} beanSummaryData
     * @returns {Object}
     */
    render(beanSummaryData) {
        if (!beanSummaryData) return null;
        this.summaryData = beanSummaryData;
        const metrics = this.computeMetrics(beanSummaryData);
        this.renderCharts(beanSummaryData);
        return metrics;
    }

    /**
     * Re-renders charts on theme changes (light/dark mode).
     * @param {boolean} [isDark]
     */
    onThemeChanged(isDark) {
        if (this.summaryData) {
            this.renderCharts(this.summaryData);
        }
    }

    /**
     * Destroys existing Chart.js instances to avoid canvas conflicts and memory leaks.
     */
    destroyCharts() {
        for (const [key, chartInstance] of Object.entries(this.activeCharts)) {
            if (chartInstance) {
                chartInstance.destroy();
                this.activeCharts[key] = null;
            }
        }
    }

    /**
     * Disposable cleanup hook for BaseController.
     */
    destroy() {
        this.destroyCharts();
        this.summaryData = null;
    }

    /**
     * @private
     */
    _computeLegendItems(distributionObj, total, keyFormatter, colorMap, fallbackColor) {
        const itemFrequencies = {};

        for (const [rawKey, count] of Object.entries(distributionObj)) {
            const formattedKey = keyFormatter(rawKey) || 'unknown';
            itemFrequencies[formattedKey] = (itemFrequencies[formattedKey] || 0) + count;
        }

        return Object.entries(itemFrequencies).map(([label, count]) => {
            const percentage = Formatter.formatPercentage(count, total);
            const color = colorMap[label] || fallbackColor;
            return {
                label,
                value: count,
                percentage,
                color
            };
        });
    }

    /**
     * @private
     */
    _instantiateDoughnutChart(chartKey, canvasId, distributionObj, total, keyFormatter, colorMap, fallbackColor, isDark) {
        const canvasElement = document.getElementById(canvasId);
        if (!canvasElement) return;

        const itemFrequencies = {};
        for (const [rawKey, count] of Object.entries(distributionObj)) {
            const formattedKey = keyFormatter(rawKey) || 'unknown';
            itemFrequencies[formattedKey] = (itemFrequencies[formattedKey] || 0) + count;
        }

        const labels = Object.keys(itemFrequencies);
        const data = Object.values(itemFrequencies);
        const backgroundColor = labels.map(label => colorMap[label] || fallbackColor);

        this.activeCharts[chartKey] = new Chart(canvasElement, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data: data.length > 0 ? data : [1],
                    backgroundColor: data.length > 0 ? backgroundColor : ['#94a3b8'],
                    borderWidth: 0,
                    borderRadius: 4,
                    spacing: 2,
                    hoverOffset: 3
                }]
            },
            options: {
                cutout: '72%',
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    animateScale: true,
                    animateRotate: true,
                    duration: 600,
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
                        padding: 8,
                        boxPadding: 4,
                        usePointStyle: true,
                        pointStyle: 'circle',
                        titleFont: { family: 'Inter, sans-serif', size: 11, weight: 'bold' },
                        bodyFont: { family: 'Inter, sans-serif', size: 11 },
                        callbacks: {
                            label: function (context) {
                                const val = context.raw || 0;
                                const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                                return ` ${context.label}: ${val} (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });
    }
}

