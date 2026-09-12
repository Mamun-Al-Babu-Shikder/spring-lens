import {
    Formatter,
    ROLE_COLORS,
    SCOPE_COLORS,
    LOADING_MODE_COLORS,
    CONTEXT_THEME_COLORS,
    TemplateEngine
} from '../../helper/index.js';

/**
 * Widget responsible for bean definition summary statistics, context distribution,
 * Scope, Role, and Loading Mode Doughnut charts, and filter dropdown population.
 */
export default class DefinitionChartsWidget {

    constructor() {
        this.activeCharts = {
            scopeChart: null,
            roleChart: null,
            loadingModeChart: null
        };
    }

    /**
     * Renders summary statistics, context bars, and doughnut distribution charts.
     * @param {Object} beanSummaryData
     */
    render(beanSummaryData) {
        if (!beanSummaryData) return;

        const { contextDistribution, totalBeanDefinitions } = beanSummaryData;
        this.updateTotalCount(totalBeanDefinitions);
        this.updateContextDistribution(contextDistribution, totalBeanDefinitions);
        this.renderDistributionCharts(beanSummaryData);
    }

    /**
     * Updates total bean count card.
     * @param {number} totalBeanDefinitions
     */
    updateTotalCount(totalBeanDefinitions) {
        $('#def-total-count').text(totalBeanDefinitions ?? 0);
    }

    /**
     * Updates context distribution list and progress bars.
     * @param {Object} contextDistribution
     * @param {number} totalBeanDefinitions
     */
    updateContextDistribution(contextDistribution, totalBeanDefinitions) {
        if (!contextDistribution) return;

        const $container = $('#def-context-list');
        $container.empty();
        const fragment = document.createDocumentFragment();

        Object.entries(contextDistribution).forEach(([contextId, count], index) => {
            const percentage = totalBeanDefinitions > 0 ? Math.round((count / totalBeanDefinitions) * 100) : 0;
            const colorClass = CONTEXT_THEME_COLORS[index % CONTEXT_THEME_COLORS.length];
            const clone = TemplateEngine.clone('tpl-context-list-item');
            if (clone) {
                const $el = $(clone.firstElementChild);
                $el.find('[data-field="contextId"]').text(contextId).attr('title', contextId);
                $el.find('[data-field="bar"]').addClass(colorClass).css('width', `${percentage}%`);
                $el.find('[data-field="pct"]').text(`${percentage}% (${count})`);
                fragment.appendChild(clone);
            }
        });

        $container.append(fragment);
    }

    /**
     * Renders Scope, Role, and Loading Mode Doughnut charts.
     * @param {Object} beanSummary
     */
    renderDistributionCharts(beanSummary) {
        this.destroyCharts();
        const { scopeDistribution, roleDistribution, loadingModeDistribution } = beanSummary || {};

        if (scopeDistribution) {
            this._createChartFromDistribution(
                'scopeChart',
                'scopeChart',
                '#def-scope-legend',
                scopeDistribution,
                key => Formatter.capitalize(key),
                SCOPE_COLORS,
                '#a855f7'
            );
        }

        if (roleDistribution) {
            this._createChartFromDistribution(
                'roleChart',
                'roleChart',
                '#def-role-legend',
                roleDistribution,
                key => Formatter.capitalize(key.replace(/^ROLE_/, '')),
                ROLE_COLORS,
                '#cbd5e1'
            );
        }

        if (loadingModeDistribution) {
            this._createChartFromDistribution(
                'loadingModeChart',
                'loadingModeChart',
                '#def-loading-mode-legend',
                loadingModeDistribution,
                key => Formatter.capitalize(key),
                LOADING_MODE_COLORS,
                '#a855f7'
            );
        }
    }

    /**
     * Populates context dropdown selector.
     * @param {Object} beanSummary
     * @param {string} [currentValue='']
     */
    populateContextDropdown(beanSummary, currentValue = '') {
        const $contextDropdown = $('#bean-definition-filter-context');
        if (!$contextDropdown.length || !beanSummary?.contextDistribution) return;

        const contextIds = Object.keys(beanSummary.contextDistribution);
        this._populateSelectDropdown(
            $contextDropdown,
            contextIds,
            'Context: All',
            contextId => contextId
        );
        $contextDropdown.val(currentValue);
    }

    /**
     * Populates scope dropdown selector.
     * @param {Object} beanSummary
     * @param {string} [currentValue='']
     */
    populateScopeDropdown(beanSummary, currentValue = '') {
        const $scopeDropdown = $('#bean-definition-filter-scope');
        if (!$scopeDropdown.length || !beanSummary?.scopeDistribution) return;

        const scopes = Object.keys(beanSummary.scopeDistribution);
        this._populateSelectDropdown(
            $scopeDropdown,
            scopes,
            'Scope: All',
            scope => Formatter.capitalize(scope)
        );
        $scopeDropdown.val(currentValue);
    }

    /**
     * Destroys existing Chart.js instances to avoid canvas drawing conflicts and leaks.
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
     * Alias for destroyCharts for BaseController disposable interface.
     */
    destroy() {
        this.destroyCharts();
    }

    /**
     * Renders fallback error state when summary statistics cannot be loaded.
     */
    renderSummaryError() {
        $('#def-total-count').text('-');
        $('#def-context-list').html('<div class="text-sm text-gray-500 italic p-3">Failed to load context distribution</div>');
    }

    /**
     * @private
     */
    _populateSelectDropdown($selectElement, optionsSet, defaultLabel, labelFormatter) {
        $selectElement.html(`<option value="">${defaultLabel}</option>`);
        Array.from(optionsSet).sort().forEach(value => {
            $selectElement.append(`<option value="${value}">${labelFormatter(value)}</option>`);
        });
    }

    /**
     * @private
     */
    _createChartFromDistribution(chartKey, canvasId, legendContainerId, distributionObj, keyFormatter, colorMap, fallbackColor) {
        const itemFrequencies = {};
        let totalCount = 0;

        for (const [rawKey, count] of Object.entries(distributionObj)) {
            const formattedKey = keyFormatter(rawKey) || 'unknown';
            itemFrequencies[formattedKey] = (itemFrequencies[formattedKey] || 0) + count;
            totalCount += count;
        }

        const chartTitles = Object.keys(itemFrequencies);
        const chartData = Object.values(itemFrequencies);
        const segmentColors = chartTitles.map(label => colorMap[label] || fallbackColor);

        const $legend = $(legendContainerId);
        $legend.empty();
        const legendFragment = document.createDocumentFragment();

        chartTitles.forEach((label, index) => {
            const count = chartData[index];
            const pctStr = Formatter.formatPercentage(count, totalCount);
            const color = segmentColors[index];
            const clone = TemplateEngine.clone('tpl-chart-legend-item');
            if (clone) {
                const $el = $(clone.firstElementChild);
                $el.find('[data-field="dot"]').css('background-color', color);
                $el.find('[data-field="label"]').text(`${label} (${count}) · ${pctStr}`).attr('title', label);
                legendFragment.appendChild(clone);
            }
        });

        $legend.append(legendFragment);

        this.activeCharts[chartKey] = this._instantiateDoughnutChart(
            canvasId,
            chartTitles,
            chartData,
            segmentColors
        );
    }

    /**
     * @private
     */
    _instantiateDoughnutChart(canvasId, labels, data, backgroundColor) {
        const canvasElement = document.getElementById(canvasId);
        if (!canvasElement) return null;

        const isDark = document.documentElement.classList.contains('dark');
        const total = data.reduce((sum, val) => sum + val, 0);

        return new Chart(canvasElement, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor,
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
                    duration: 700,
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
