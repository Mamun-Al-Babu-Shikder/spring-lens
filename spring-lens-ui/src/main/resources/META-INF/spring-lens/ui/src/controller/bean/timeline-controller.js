import httpClient from '../../client/http-client.js';
import GraphTreeBuilder from '../../builder/graph-tree-builder.js';
import beanDataStore from '../../storage/bean-data-store.js';
import {
    capitalize, resolveBeanMetadata, resolveScopeStyle, resolveScopeBadgeClass, downloadJson,
    TemplateEngine, QueryParam, Pagination, debounce
} from '../../utils/index.js';

export default class TimelineController {
    constructor(beanInstanceApi, beanInstanceFindApi, beanDefinitionFindApi, beanInstanceSummaryApi) {
        this.instances = [];
        this.filteredInstances = [];
        this.selectedBeanInstance = null;

        this.currentPage = 1;
        this.pageSize = 20;
        this.searchQuery = '';
        this.minDurationMs = 0;
        this.quickFilter = 'all'; // 'all', 'bottlenecks', 'slow', 'fast'
        this.sortBy = 'createdAt';
        this.sortDir = 'ASC';
        this.activeView = 'timeline'; // 'timeline' or 'table'
        this.zoomLevel = 1;

        this.selectedBeanName = null;
        this.selectedContextId = null;

        this.paginationState = {
            totalElements: 0,
            totalPages: 1,
            pageNumber: 0,
            pageSize: 20,
            isFirstPage: true,
            isLastPage: true
        };

        this.maxTimeMs = 100;
        this.instanceSummary = null;

        this._debouncedSearch = debounce(() => this._resetPageAndFetch(), 250);

        this.beanInstanceApi = beanInstanceApi;
        this.beanInstanceFindApi = beanInstanceFindApi;
        this.beanDefinitionFindApi = beanDefinitionFindApi;
        this.beanInstanceSummaryApi = beanInstanceSummaryApi;
    }

    async enter(params) {
        try {
            this._resetFilterState();
            this._handleCloseSidebar(true);

            const queryParams = QueryParam.parse(params);
            const targetBean = QueryParam.get(queryParams, 'search', 'bean');
            const targetContextId = QueryParam.get(queryParams, 'contextId', 'context');

            if (targetBean) {
                this.searchQuery = targetBean;
                $('#time-search-input').val(targetBean);
                $('#time-search-clear').removeClass('hidden');
            }

            this.initEvents();
            await Promise.all([
                this.fetchSummaryData(),
                this.fetchInstanceData()
            ]);

            if (targetBean && this.instances && this.instances.length > 0) {
                const match = this.instances.find(i => i.beanName === targetBean) || this.instances[0];
                if (match) {
                    await this.selectBean(targetContextId || match.contextId, match.beanName);
                }
            }
        } catch (error) {
            console.error('Error in TimelineController enter:', error);
        }
    }

    /**
     * Fetches application-wide bean instance summary metrics directly from endpoint.
     */
    async fetchSummaryData() {
        if (!this.beanInstanceSummaryApi) return;
        try {
            const summaryData = await httpClient.get(this.beanInstanceSummaryApi);
            this.instanceSummary = summaryData;
            this.renderKpiSummary(summaryData);
        } catch (error) {
            console.error('Error fetching bean instance summary:', error);
        }
    }

    /**
     * Renders KPI metrics from backend summary endpoint without calculating locally.
     */
    renderKpiSummary(summaryData) {
        if (!summaryData) return;
        const {
            totalCreatedInstances = 0,
            instancesWithDefinition = 0,
            instancesWithoutDefinition = 0,
            totalInitializationDurationNanos = 0,
            maxInitializationDurationNanos = 0,
            averageInitializationDurationNanos = 0
        } = summaryData;

        $('#time-kpi-total-instances').text(totalCreatedInstances.toLocaleString());
        $('#time-kpi-with-def').text(instancesWithDefinition.toLocaleString());
        $('#time-kpi-without-def').text(`${instancesWithoutDefinition} dynamic`);

        $('#time-kpi-total-duration').text(this.formatDuration(totalInitializationDurationNanos));
        $('#time-kpi-total-duration-nanos').text(`${totalInitializationDurationNanos.toLocaleString()} ns`);

        $('#time-kpi-max-duration').text(this.formatDuration(maxInitializationDurationNanos));
        $('#time-kpi-max-duration-nanos').text(`${maxInitializationDurationNanos.toLocaleString()} ns`);

        $('#time-kpi-avg-duration').text(this.formatDuration(averageInitializationDurationNanos));
        $('#time-kpi-avg-duration-nanos').text(`${averageInitializationDurationNanos.toLocaleString()} ns`);
    }

    /**
     * Fetches bean instance page data from backend REST API (/instances).
     */
    async fetchInstanceData(append = false) {
        if (!append) {
            this.renderLoadingState();
        }

        const queryParams = this._buildApiQueryParams();

        try {
            const responseData = await httpClient.getWithQuery(
                this.beanInstanceApi,
                queryParams.toString()
            );

            this.processPaginatedResponse(responseData, append);
            this.computeTimelineMetrics();
            this.applyLocalFilters();
            this._populateContextDropdown();
            this.renderCurrentView();
        } catch (error) {
            console.error('Error fetching bean instance timeline data:', error);
            this.renderErrorState(error.message || 'Unknown network error');
        }
    }

    _buildApiQueryParams() {
        return QueryParam.build({
            pageNumber: this.currentPage - 1,
            pageSize: this.pageSize,
            search: this.searchQuery,
            sortBy: this.sortBy,
            sortDir: this.sortDir
        });
    }

    processPaginatedResponse(responseData, append = false) {
        const content = Array.isArray(responseData?.content) ? responseData.content : [];
        if (append) {
            this.instances = [...this.instances, ...content];
        } else {
            this.instances = content;
        }
        beanDataStore.addBeans(content);

        const totalElements = responseData?.totalElements ?? this.instances.length;
        const totalPages = Math.max(1, responseData?.totalPages ?? 1);
        const pageNumber = responseData?.pageNumber ?? 0;
        const pageSize = responseData?.pageSize ?? this.pageSize;

        this.paginationState = {
            totalElements,
            totalPages,
            pageNumber,
            pageSize,
            isFirstPage: responseData?.first ?? (pageNumber === 0),
            isLastPage: responseData?.last ?? (pageNumber >= totalPages - 1)
        };
    }

    /**
     * Parses ISO timestamp string into millisecond accuracy.
     */
    parseIsoToMs(isoStr) {
        if (!isoStr || typeof isoStr !== 'string') return 0;

        const match = isoStr.match(/^(.*?)(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/);
        if (!match) return 0;

        const [, base, fractionStr, tz = ''] = match;
        const baseMs = Date.parse(`${base}${tz}`);

        if (Number.isNaN(baseMs)) return 0;

        const fractionalMs = fractionStr ? parseFloat(fractionStr) * 1000 : 0;
        return baseMs + fractionalMs;
    }

    /**
     * Formats duration with clean units (µs, ms, s).
     */
    formatDuration(nanos) {
        if (nanos === undefined || nanos === null) return '0ms';
        if (nanos >= 1_000_000_000) return (nanos / 1e9).toFixed(2) + 's';
        const ms = nanos / 1e6;
        if (ms >= 100) return Math.round(ms) + 'ms';
        if (ms >= 10) return ms.toFixed(1) + 'ms';
        if (ms >= 1) return ms.toFixed(2) + 'ms';
        if (nanos >= 1_000) return (nanos / 1e3).toFixed(0) + 'µs';
        return nanos + 'ns';
    }

    formatMsValue(ms) {
        if (ms >= 1000) return (ms / 1000).toFixed(2) + ' s';
        if (ms >= 10) return ms.toFixed(1) + ' ms';
        return ms.toFixed(2) + ' ms';
    }

    /**
     * Categorizes bean into layer with color & icon matching the UI design.
     */
    getBeanLayer(bean) {
        if (!bean) {
            return { id: 'other', label: 'Other', color: '#94a3b8', icon: 'deployed_code' };
        }

        const name = (bean.beanName || '').toLowerCase();
        const type = (bean.type || '').toLowerCase();
        const combined = `${name} ${type}`;

        // 1. Web Layer (Red / Rose)
        if (
            combined.includes('controller') || combined.includes('rest') || combined.includes('mapper') ||
            combined.includes('objectmapper') || combined.includes('json') || combined.includes('jackson') ||
            combined.includes('serializer') || combined.includes('deserializer') || combined.includes('viewresolver') ||
            combined.includes('endpoint') || combined.includes('router') || combined.includes('feign') || combined.includes('web')
        ) {
            return { id: 'web', label: 'Web Layer', color: '#ef4444', icon: 'api' };
        }

        // 2. Business Logic (Yellow / Amber)
        if (
            combined.includes('service') || combined.includes('manager') || combined.includes('handler') ||
            combined.includes('facade') || combined.includes('usecase') || combined.includes('logic') ||
            combined.includes('processor') || combined.includes('validator')
        ) {
            return { id: 'business', label: 'Business Logic', color: '#f59e0b', icon: 'settings_input_component' };
        }

        // 3. Data Access (Green / Emerald)
        if (
            combined.includes('datasource') || combined.includes('entitymanager') || combined.includes('transaction') ||
            combined.includes('repository') || combined.includes('dao') || combined.includes('jpa') ||
            combined.includes('hibernate') || combined.includes('jdbc') || combined.includes('connection') ||
            combined.includes('flyway') || combined.includes('liquibase') || combined.includes('sql')
        ) {
            return { id: 'data', label: 'Data Access', color: '#10b981', icon: 'database' };
        }

        // 4. Infrastructure (Blue)
        if (
            combined.includes('logging') || combined.includes('logger') || combined.includes('scheduler') ||
            combined.includes('task') || combined.includes('security') || combined.includes('auth') ||
            combined.includes('filter') || combined.includes('cache') || combined.includes('meter') ||
            combined.includes('metrics') || combined.includes('health') || combined.includes('actuator') ||
            combined.includes('management') || combined.includes('kafka') || combined.includes('rabbit') ||
            combined.includes('jms') || combined.includes('template')
        ) {
            return { id: 'infra', label: 'Infrastructure', color: '#3b82f6', icon: 'memory' };
        }

        // 5. Configuration (Purple)
        if (
            combined.includes('config') || combined.includes('properties') || combined.includes('postprocessor') ||
            combined.includes('initializer') || combined.includes('environment') || combined.includes('autoconfiguration') ||
            combined.includes('factory') || combined.includes('context') || combined.includes('profile')
        ) {
            return { id: 'config', label: 'Configuration', color: '#8b5cf6', icon: 'settings' };
        }

        // 6. Other (Gray / Slate)
        return { id: 'other', label: 'Other', color: '#94a3b8', icon: 'deployed_code' };
    }

    computeTimelineMetrics() {
        if (!this.instances || this.instances.length === 0) {
            this.maxTimeMs = 100;
            return;
        }

        const timestamps = this.instances.map(inst => this.parseIsoToMs(inst.createdAt)).filter(t => t > 0);
        const minCreatedMs = timestamps.length > 0 ? Math.min(...timestamps) : 0;

        let maxEndOffsetMs = 0;

        this.instances.forEach(inst => {
            const createdMs = this.parseIsoToMs(inst.createdAt);
            const initDurationMs = (inst.initDurationNanos || 0) / 1e6;
            const relativeStartMs = createdMs > 0 ? Math.max(0, createdMs - minCreatedMs) : 0;
            const relativeEndMs = relativeStartMs + initDurationMs;

            inst.relativeStartMs = relativeStartMs;
            inst.initDurationMs = initDurationMs;
            inst.relativeEndMs = relativeEndMs;
            inst.layer = this.getBeanLayer(inst);

            if (relativeEndMs > maxEndOffsetMs) {
                maxEndOffsetMs = relativeEndMs;
            }
        });

        this.maxTimeMs = maxEndOffsetMs > 0 ? Math.max(maxEndOffsetMs * 1.05, 10) : 100;
    }

    applyLocalFilters() {
        let result = [...this.instances];

        // 1. Quick Filters
        if (this.quickFilter === 'bottlenecks') {
            result = result.filter(inst => (inst.initDurationMs || 0) >= 50);
        } else if (this.quickFilter === 'slow') {
            result = result.filter(inst => (inst.initDurationMs || 0) >= 10 && (inst.initDurationMs || 0) < 50);
        } else if (this.quickFilter === 'fast') {
            result = result.filter(inst => (inst.initDurationMs || 0) < 10);
        }

        // 2. Minimum Duration Filter
        if (this.minDurationMs > 0) {
            result = result.filter(inst => (inst.initDurationMs || 0) >= this.minDurationMs);
        }

        this.filteredInstances = result;
        $('#time-visible-count-badge').text(this.filteredInstances.length.toLocaleString());
    }

    renderCurrentView() {
        if (this.activeView === 'timeline') {
            $('#timeline-gantt-card').removeClass('hidden');
            $('#timeline-table-card').addClass('hidden');
            this.renderGanttView();
        } else {
            $('#timeline-gantt-card').addClass('hidden');
            $('#timeline-table-card').removeClass('hidden');
            this.renderTableRows();
            this.renderPagination();
        }
    }

    /* ======================================================================
       GANTT WATERFALL RENDERING
       ====================================================================== */

    renderGanttView() {
        this.renderTimeRulerAndGrid();
        this.renderGanttRows();
        this.renderLoadMore();
    }

    renderTimeRulerAndGrid() {
        const $ruler = $('#timeline-ruler-ticks');
        const $grid = $('#timeline-grid-lines');
        if (!$ruler.length) return;

        $ruler.empty();
        $grid.empty();

        const ticks = this._calculateTimeTicks(this.maxTimeMs);

        ticks.forEach((tick) => {
            const pct = (tick.ms / this.maxTimeMs) * 100;
            if (pct > 100) return;

            // Tick container on ruler
            const $tick = $(`
                <div class="absolute top-0 bottom-0 pointer-events-none" style="left: ${pct}%;">
                    <div class="ruler-tick-mark ${tick.isMajor ? 'ruler-tick-major' : ''}"></div>
                    <span class="absolute top-0 transform -translate-x-1/2 whitespace-nowrap ${tick.isMajor ? 'font-bold text-gray-700 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'}">
                        ${tick.label}
                    </span>
                </div>
            `);
            $ruler.append($tick);

            // Vertical dashed grid line
            const $gridLine = $(`<div class="absolute inset-y-0 pointer-events-none border-l ${tick.isMajor ? 'border-dashed border-gray-300/80 dark:border-slate-700/80' : 'border-dotted border-gray-200/60 dark:border-slate-800/60'}"></div>`);
            $gridLine.css('left', `calc(${pct}% + 340px)`);
            $grid.append($gridLine);
        });
    }

    _calculateTimeTicks(maxMs) {
        let majorStepMs;
        if (maxMs <= 20) majorStepMs = 5;
        else if (maxMs <= 50) majorStepMs = 10;
        else if (maxMs <= 100) majorStepMs = 20;
        else if (maxMs <= 250) majorStepMs = 50;
        else if (maxMs <= 500) majorStepMs = 100;
        else if (maxMs <= 1000) majorStepMs = 200;
        else if (maxMs <= 2000) majorStepMs = 400;
        else if (maxMs <= 5000) majorStepMs = 1000;
        else if (maxMs <= 10000) majorStepMs = 2000;
        else majorStepMs = Math.ceil(maxMs / 6 / 1000) * 1000;

        const minorStepMs = majorStepMs / 2;
        const ticks = [];

        for (let ms = 0; ms <= maxMs; ms += minorStepMs) {
            const isMajor = Math.round(ms) % Math.round(majorStepMs) === 0 || ms === 0;
            ticks.push({
                ms,
                isMajor,
                label: isMajor ? this._formatTickLabel(ms) : ''
            });
        }
        return ticks;
    }

    _formatTickLabel(ms) {
        if (ms === 0) return '0ms';
        if (ms < 1000) return `${Math.round(ms)}ms`;
        const sec = ms / 1000;
        return `${Number.isInteger(sec) ? sec : sec.toFixed(1)}s`;
    }

    renderGanttRows() {
        const $container = $('#timeline-waterfall-rows');
        if (!$container.length) return;

        // Keep grid overlay and scrubber needle, remove previous rows / loading spinner
        $container.children().not('#timeline-grid-lines, #timeline-scrubber-needle').remove();

        if (!this.filteredInstances || this.filteredInstances.length === 0) {
            const emptyClone = TemplateEngine.clone('tpl-timeline-empty');
            if (emptyClone) $container.append(emptyClone);
            return;
        }

        const fragment = document.createDocumentFragment();

        this.filteredInstances.forEach((inst) => {
            const node = this._createWaterfallRowNode(inst);
            if (node) fragment.appendChild(node);
        });

        $container.append(fragment);
    }

    _createWaterfallRowNode(inst) {
        const clone = TemplateEngine.clone('tpl-waterfall-row');
        if (!clone?.firstElementChild) return null;

        const $row = $(clone.firstElementChild);
        const { beanName, contextId, initDurationMs = 0, initDurationNanos = 0, relativeStartMs = 0, layer, scope } = inst;

        const isSelected = (this.selectedBeanName === beanName) && (this.selectedContextId === contextId);
        if (isSelected) {
            $row.addClass('gantt-row-selected');
        }

        $row.attr({
            'data-context-id': contextId || '',
            'data-bean-name': beanName || ''
        });

        // Category Icon Container
        const $iconContainer = $row.find('[data-field="iconContainer"]');
        const $icon = $row.find('[data-field="icon"]');
        $icon.text(layer.icon || 'deployed_code').css('color', layer.color);
        $iconContainer.css({
            backgroundColor: `${layer.color}15`,
            borderColor: `${layer.color}35`
        });

        // Name
        const displayName = GraphTreeBuilder._displayName(beanName);
        $row.find('[data-field="name"]').text(displayName).attr('title', beanName);

        // Duration Text & Badge Styling
        const formattedDuration = this.formatDuration(initDurationNanos);
        const $duration = $row.find('[data-field="duration"]');
        $duration.text(formattedDuration);

        const isBottleneck = initDurationMs >= 50;
        const isModerate = initDurationMs >= 10 && initDurationMs < 50;

        if (isBottleneck) {
            $duration.addClass('bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/40');
        } else if (isModerate) {
            $duration.addClass('bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/40');
        } else {
            $duration.addClass('bg-emerald-50/80 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/30');
        }

        // Waterfall Bar Layout
        const maxTime = this.maxTimeMs || 1;
        const leftPct = Math.min(Math.max((relativeStartMs / maxTime) * 100, 0), 98.5);
        const widthPct = Math.min(Math.max((initDurationMs / maxTime) * 100, 0.6), 100 - leftPct);

        const $bar = $row.find('[data-field="bar"]');
        $bar.css({
            left: `${leftPct}%`,
            width: `${widthPct}%`,
            background: `linear-gradient(135deg, ${layer.color}e6, ${layer.color}b3)`,
            border: `1px solid ${layer.color}`,
            '--bar-glow': `${layer.color}80`
        });

        // Bottleneck Flame Indicator
        if (isBottleneck) {
            $bar.addClass('gantt-bar-bottleneck');
            const $flame = $row.find('[data-field="bottleneckBadge"]');
            $flame.removeClass('hidden').css('left', `calc(${leftPct}% + ${widthPct}% + 6px)`);
        }

        // Bar Label
        const $barLabel = $row.find('[data-field="barLabel"]');
        if (widthPct > 6) {
            $barLabel.text(formattedDuration);
        } else {
            $barLabel.empty();
        }

        return clone;
    }

    renderLoadMore() {
        const totalElements = this.paginationState?.totalElements || 0;
        const currentCount = this.instances.length;
        const remaining = Math.max(0, totalElements - currentCount);

        const $btn = $('#time-btn-load-more');
        const $text = $('#time-load-more-text');

        if (remaining > 0) {
            $text.text(`+ ${remaining.toLocaleString()} more beans`);
            $btn.removeClass('hidden opacity-60 cursor-default pointer-events-none').show();
        } else {
            $text.text(`All ${totalElements.toLocaleString()} beans loaded`);
            $btn.addClass('opacity-60 cursor-default pointer-events-none');
        }

        $('#time-loaded-summary-text').text(`Showing ${currentCount.toLocaleString()} of ${totalElements.toLocaleString()} instances across ${this.formatMsValue(this.maxTimeMs || 0)} window`);
    }

    /* ======================================================================
       TABLE VIEW RENDERING (Matching Instances Table)
       ====================================================================== */

    renderTableRows() {
        const $tbody = $('#beanInstanceTableBody').length ? $('#beanInstanceTableBody') : $('#time-table-body');
        if (!$tbody.length) return;

        $tbody.empty();

        if (!this.filteredInstances || this.filteredInstances.length === 0) {
            const emptyClone = TemplateEngine.clone('tpl-instance-empty') || TemplateEngine.clone('tpl-timeline-empty');
            if (emptyClone) $tbody.append(emptyClone);
            return;
        }

        const fragment = document.createDocumentFragment();

        this.filteredInstances.forEach((inst) => {
            const rowNode = this._createTableRowNode(inst);
            if (rowNode) fragment.appendChild(rowNode);
        });

        $tbody.append(fragment);
    }

    _createTableRowNode(inst) {
        const clone = TemplateEngine.clone('tpl-instance-row') || TemplateEngine.clone('tpl-timeline-row');
        if (!clone?.firstElementChild) return null;

        const $row = $(clone.firstElementChild);
        const { beanName, contextId, initDurationNanos, scope, type, layer } = inst;

        const isSelected = (this.selectedBeanName === beanName) && (this.selectedContextId === contextId);
        if (isSelected) {
            $row.addClass('bg-primary/10 dark:bg-purple-950/30 border-l-4 border-primary font-semibold');
        }

        $row.attr({
            'data-context-id': contextId || '',
            'data-bean-name': beanName || '',
            'data-bean': beanName || ''
        });

        // Icon Container & Icon
        const $iconContainer = $row.find('[data-field="beanIconContainer"], [data-field="iconContainer"]');
        const $icon = $row.find('[data-field="beanIcon"], [data-field="icon"]');

        $icon.text(layer?.icon || 'deployed_code').css('color', layer?.color || '#8b5cf6');
        $iconContainer.css({
            backgroundColor: `${layer?.color || '#8b5cf6'}15`,
            borderColor: `${layer?.color || '#8b5cf6'}30`
        });

        // Display Name & Package Name / Subtitle
        $row.find('[data-field="beanName"], [data-field="displayName"]')
            .text(GraphTreeBuilder._displayName(beanName))
            .attr('title', beanName);

        const packagePart = type ? type.substring(0, type.lastIndexOf('.')) : '';
        $row.find('[data-field="packageName"]').text(packagePart || type || '').attr('title', type || '');
        $row.find('[data-field="typeName"], [data-field="type"]').text(type || 'N/A').attr('title', type || '');

        // Scope badge
        $row.find('[data-field="scopeBadge"], [data-field="scope"]')
            .text((scope || 'singleton').toUpperCase())
            .addClass(resolveScopeBadgeClass(scope));

        // Duration formatted
        const formattedDuration = this.formatDuration(initDurationNanos);
        $row.find('[data-field="durationFormatted"]').text(formattedDuration);

        // Context ID
        $row.find('[data-field="contextId"]').text(contextId || 'root');

        return clone;
    }

    renderPagination() {
        const { totalElements, pageNumber, pageSize } = this.paginationState;

        const infoText = Pagination.formatInfoText(totalElements, pageNumber, pageSize, 'instances');
        const $info = $('#inst-pagination-info').length ? $('#inst-pagination-info') : $('#time-pagination-info');
        $info.text(infoText);

        const $buttons = $('#inst-pagination-buttons').length ? $('#inst-pagination-buttons') : $('#time-pagination-buttons');
        Pagination.renderPaginationButtons($buttons, this.paginationState);
    }

    renderLoadingState() {
        if (this.activeView === 'timeline') {
            const $container = $('#timeline-waterfall-rows');
            $container.children().not('#timeline-grid-lines, #timeline-scrubber-needle').remove();
            const clone = TemplateEngine.clone('tpl-timeline-loading');
            if (clone) $container.append(clone);
        } else {
            const $tbody = $('#beanInstanceTableBody').length ? $('#beanInstanceTableBody') : $('#time-table-body');
            if (!$tbody.length) return;
            const clone = TemplateEngine.clone('tpl-instance-loading') || TemplateEngine.clone('tpl-timeline-loading');
            if (clone) $tbody.empty().append(clone);
        }
    }

    renderErrorState(errorMessage) {
        if (this.activeView === 'timeline') {
            const $container = $('#timeline-waterfall-rows');
            $container.children().not('#timeline-grid-lines, #timeline-scrubber-needle').remove();
            const clone = TemplateEngine.clone('tpl-timeline-error');
            if (clone) {
                $(clone).find('[data-field="errorMessage"]').text(`Failed to fetch bean timeline: ${errorMessage}`);
                $container.append(clone);
            }
        } else {
            const $tbody = $('#beanInstanceTableBody').length ? $('#beanInstanceTableBody') : $('#time-table-body');
            if (!$tbody.length) return;
            const clone = TemplateEngine.clone('tpl-instance-error') || TemplateEngine.clone('tpl-timeline-error');
            if (clone) {
                $(clone).find('[data-field="errorMessage"]').text(`Failed to fetch bean instances: ${errorMessage}`);
                $tbody.empty().append(clone);
            }
        }
    }

    /* ======================================================================
       SIDEBAR & DETAILS TELEMETRY
       ====================================================================== */

    async selectBean(contextId, beanName) {
        if (!contextId || !beanName) return;

        this.selectedContextId = contextId;
        this.selectedBeanName = beanName;

        $('.waterfall-row, .timeline-table-row').removeClass('gantt-row-selected bg-primary/10 dark:bg-purple-950/30 border-l-4 border-primary font-semibold');
        $(`.waterfall-row[data-context-id="${contextId}"][data-bean-name="${beanName}"]`).addClass('gantt-row-selected');
        $(`.timeline-table-row[data-context-id="${contextId}"][data-bean-name="${beanName}"]`).addClass('bg-primary/10 dark:bg-purple-950/30 font-semibold');

        try {
            const queryParams = QueryParam.build({ contextId, beanName });
            const instanceDetails = await httpClient.getWithQuery(
                this.beanInstanceFindApi,
                queryParams.toString()
            );

            this.selectedBeanInstance = instanceDetails;
            this.renderSidebarDetails(instanceDetails);
        } catch (error) {
            console.warn('Could not fetch single bean instance details:', error);
            const localInstance = this.instances.find(i => i.contextId === contextId && i.beanName === beanName);
            if (localInstance) {
                this.renderSidebarDetails(localInstance);
            }
        }
    }

    renderSidebarDetails(instance) {
        if (!instance) return;

        const { beanName, type, scope, initDurationNanos, relativeStartMs, contextId, createdAt, hasDefinition } = instance;
        const metadata = resolveBeanMetadata(instance);

        const data = {
            name: GraphTreeBuilder._displayName(beanName),
            type: type || 'N/A',
            scope: capitalize(scope || 'singleton'),
            duration: this.formatDuration(initDurationNanos),
            start: relativeStartMs != null ? `+${relativeStartMs.toFixed(2)} ms` : '-',
            context: contextId || 'root',
            created: createdAt || 'N/A',
            nanos: (initDurationNanos || 0).toLocaleString() + ' ns',
            definitionStatus: hasDefinition ? 'DEFINED' : 'DYNAMIC'
        };

        const $sidebar = $('#time-details-sidebar');
        $sidebar.removeClass('w-0 max-w-0 opacity-0 pointer-events-none -mr-6 border-0')
            .addClass('w-[380px] max-w-[380px] opacity-100 mr-0 border');

        $('#time-sidebar-icon').text(metadata.icon || 'schema');
        $('#time-sidebar-icon-container').css({
            backgroundColor: `${metadata.color}15`,
            color: metadata.color,
            borderColor: `${metadata.color}30`
        });

        $sidebar.find('[data-field]').each((_, el) => {
            const field = el.dataset.field;
            if (data[field] != null) {
                $(el).text(data[field]);
            }
        });

        const $defStatus = $('#time-sidebar-definition-status');
        if (hasDefinition) {
            $defStatus.removeClass('bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-400')
                .addClass('bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/40');
        } else {
            $defStatus.removeClass('bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/40')
                .addClass('bg-gray-100 text-gray-600 border border-gray-200 dark:bg-slate-800 dark:text-gray-400 dark:border-slate-700');
        }

        const $footer = $('#time-sidebar-footer');
        const $viewBtn = $('#time-btn-view-details');

        if (hasDefinition) {
            const href = `#/definitions?bean=${encodeURIComponent(beanName)}${contextId ? `&contextId=${encodeURIComponent(contextId)}` : ''}`;
            $viewBtn.attr('href', href);
            $footer.removeClass('hidden').show();
        } else {
            $viewBtn.attr('href', '#/definitions');
            $footer.addClass('hidden').hide();
        }
    }

    /* ======================================================================
       EVENTS & USER INTERACTIONS
       ====================================================================== */

    initEvents() {
        this._initActionHandlers();
        this._bindSearchInput();
        this._bindFilterChangeEvents();
        this._bindSortHeaders();
        this._bindZoomEvents();
        this._bindScrubberEvents();
        this._bindClickActionDelegation();
    }

    _initActionHandlers() {
        this._clickActions = {
            'refresh-data': ($target) => this._handleRefreshData($target),
            'reset-filters': () => {
                this._resetFilterState();
                return this.fetchInstanceData();
            },
            'select-bean': ($target) => this._handleSelectBean($target),
            'select-instance': ($target) => this._handleSelectBean($target),
            'change-page': ($target) => this._handleChangePage($target),
            'prev-page': () => this._handlePrevPage(),
            'next-page': () => this._handleNextPage(),
            'close-sidebar': () => this._handleCloseSidebar(),
            'download-report': () => this._downloadReport(),
            'switch-view': ($target) => this._handleSwitchView($target),
            'toggle-sort': () => this._handleToggleSort(),
            'load-more': () => this._handleLoadMore(),
            'zoom-in': () => this._setZoom(this.zoomLevel + 0.5),
            'zoom-out': () => this._setZoom(this.zoomLevel - 0.5),
            'zoom-reset': () => this._setZoom(1),
            'clear-search': () => this._handleClearSearch(),
            'quick-filter': ($target) => this._handleQuickFilter($target),
            'focus-slowest': () => this._handleFocusSlowest()
        };

        this._filterChangeActions = {
            'time-filter-duration': (val) => {
                this.minDurationMs = parseFloat(val) || 0;
                this.applyLocalFilters();
                this.renderCurrentView();
            },
            'time-filter-created': (val) => {
                if (val === 'newest') {
                    this.sortBy = 'createdAt';
                    this.sortDir = 'DESC';
                } else if (val === 'oldest') {
                    this.sortBy = 'createdAt';
                    this.sortDir = 'ASC';
                }
                return this._resetPageAndFetch();
            },
            'time-sort-by': (val) => {
                const [field, dir = 'ASC'] = val.split('_');
                this.sortBy = field;
                this.sortDir = dir.toUpperCase();
                return this._resetPageAndFetch();
            },
            'time-filter-size': (val) => {
                this.pageSize = parseInt(val, 10) || 20;
                return this._resetPageAndFetch();
            }
        };
    }

    _bindSearchInput() {
        const handleInput = (val) => {
            this.searchQuery = (val || '').trim();
            if (this.searchQuery) {
                $('#time-search-clear').removeClass('hidden');
            } else {
                $('#time-search-clear').addClass('hidden');
            }
            this._debouncedSearch();
        };

        this._on('#time-search-input, #inst-search-input', 'input', (e) => {
            handleInput(e.target.value);
        });

        this._on('#time-search-input, #inst-search-input', 'keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this._debouncedSearch.flush();
            } else if (e.key === 'Escape') {
                this._handleClearSearch();
            }
        });
    }

    _handleClearSearch() {
        this._debouncedSearch.cancel();
        this.searchQuery = '';
        $('#time-search-input, #inst-search-input').val('');
        $('#time-search-clear').addClass('hidden');
        this._resetPageAndFetch();
    }

    _handleQuickFilter($target) {
        const filter = $target.data('filter') || 'all';
        this.quickFilter = filter;

        $('.time-quick-filter-btn')
            .removeClass('bg-white dark:bg-slate-800 text-primary dark:text-purple-300 font-bold shadow-xs')
            .addClass('text-gray-600 dark:text-gray-400 font-semibold');

        $target
            .addClass('bg-white dark:bg-slate-800 text-primary dark:text-purple-300 font-bold shadow-xs')
            .removeClass('text-gray-600 dark:text-gray-400 font-semibold');

        this.applyLocalFilters();
        this.renderCurrentView();
    }

    _handleFocusSlowest() {
        if (!this.instances || this.instances.length === 0) return;
        const slowest = this.instances.reduce((prev, current) =>
            ((prev?.initDurationNanos || 0) > (current?.initDurationNanos || 0)) ? prev : current
        , null);
        if (slowest) {
            const { contextId, beanName } = slowest;
            this.selectBean(contextId, beanName);
            const $targetRow = $(`.waterfall-row[data-bean-name="${beanName}"]`);
            if ($targetRow.length) {
                $targetRow[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }

    _bindFilterChangeEvents() {
        const filterSelectors = Object.keys(this._filterChangeActions)
            .map(id => `#${id}`)
            .join(', ');

        this._on(filterSelectors, 'change', (e) => {
            const handler = this._filterChangeActions[e.target.id];
            if (handler) {
                handler(e.target.value);
            }
        });
    }

    _bindSortHeaders() {
        this._on('.th-sortable', 'click', (e) => {
            const $th = $(e.currentTarget);
            const sortCol = $th.data('sort');
            if (!sortCol) return;

            if (this.sortBy === sortCol) {
                this.sortDir = this.sortDir === 'ASC' ? 'DESC' : 'ASC';
            } else {
                this.sortBy = sortCol;
                this.sortDir = 'ASC';
            }

            this._updateSortHeaderIcons();
            this.currentPage = 1;
            this.fetchInstanceData();
        });
    }

    _updateSortHeaderIcons() {
        $('.th-sortable .sort-icon').text('unfold_more').removeClass('text-primary dark:text-purple-300').addClass('text-gray-400');

        if (this.sortBy) {
            const iconName = this.sortDir === 'ASC' ? 'expand_less' : 'expand_more';
            $(`.th-sortable[data-sort="${this.sortBy}"] .sort-icon`)
                .text(iconName)
                .removeClass('text-gray-400')
                .addClass('text-primary dark:text-purple-300 font-bold');
        }
    }

    _populateContextDropdown() {
        const $dropdown = $('#inst-filter-context');
        if (!$dropdown.length) return;

        const currentVal = $dropdown.val() || '';
        $dropdown.find('option:not(:first)').remove();

        const contexts = new Set();
        if (this.instanceSummary?.contextDistribution) {
            Object.keys(this.instanceSummary.contextDistribution).forEach(c => contexts.add(c));
        }
        this.instances.forEach(i => {
            if (i.contextId) contexts.add(i.contextId);
        });

        contexts.forEach(ctx => {
            $dropdown.append(`<option value="${ctx}">${ctx}</option>`);
        });

        if (currentVal) {
            $dropdown.val(currentVal);
        }
    }

    _bindZoomEvents() {
        this._on('#time-zoom-slider', 'input', (e) => {
            const val = parseFloat(e.target.value) || 1;
            this._setZoom(val, false);
        });
    }

    _setZoom(level, updateSlider = true) {
        this.zoomLevel = Math.max(1, Math.min(4, level));
        if (updateSlider) {
            $('#time-zoom-slider').val(this.zoomLevel);
        }

        const pct = Math.round(this.zoomLevel * 100);
        $('#time-zoom-level-badge').text(`${pct}%`);

        const widthPercent = this.zoomLevel * 100;
        $('#timeline-inner-container').css('min-width', `${widthPercent}%`);
        this.renderTimeRulerAndGrid();
    }

    _bindScrubberEvents() {
        const $needle = $('#timeline-scrubber-needle');
        const $badge = $('#timeline-scrubber-badge');

        // Mousemove scrubber needle
        this._on('#timeline-scroll-container', 'mousemove', (e) => {
            const $inner = $('#timeline-inner-container');
            const offset = $inner.offset();
            if (!offset) return;

            const manifestWidth = 340;
            const mouseX = e.pageX - offset.left;

            if (mouseX >= manifestWidth && mouseX <= $inner.outerWidth()) {
                const trackX = mouseX - manifestWidth;
                const trackWidth = $inner.outerWidth() - manifestWidth;
                const timeRatio = Math.max(0, Math.min(1, trackX / trackWidth));
                const currentMs = timeRatio * this.maxTimeMs;

                $needle.css({
                    left: `${mouseX}px`,
                    opacity: 1
                });
                $badge.text(`+${currentMs.toFixed(2)}ms`);
            } else {
                $needle.css('opacity', 0);
            }
        });

        this._on('#timeline-scroll-container', 'mouseleave', () => {
            $needle.css('opacity', 0);
        });
    }

    _bindClickActionDelegation() {
        this._on(document, 'click', '[data-action]', (e) => {
            const $target = $(e.currentTarget);
            const action = $target.data('action') || $target.attr('data-action');
            const handler = this._clickActions[action];

            if (handler) {
                if ($target.is('a') && $target.attr('href') && !$target.attr('href').startsWith('javascript:')) {
                    // Normal link
                } else {
                    e.preventDefault();
                }
                handler($target, e);
            }
        });

        this._on(document, 'keydown', (e) => {
            if (e.key === 'Escape') {
                this._handleCloseSidebar();
            }
        });
    }

    _handleSwitchView($target) {
        const view = $target.data('view') || 'timeline';
        this.activeView = view;

        if (view === 'timeline') {
            $('#time-view-btn-timeline')
                .addClass('bg-white dark:bg-slate-800 text-primary dark:text-purple-300 font-bold shadow-xs')
                .removeClass('text-gray-500 dark:text-gray-400 font-medium');
            $('#time-view-btn-table')
                .removeClass('bg-white dark:bg-slate-800 text-primary dark:text-purple-300 font-bold shadow-xs')
                .addClass('text-gray-500 dark:text-gray-400 font-medium');
        } else {
            $('#time-view-btn-table')
                .addClass('bg-white dark:bg-slate-800 text-primary dark:text-purple-300 font-bold shadow-xs')
                .removeClass('text-gray-500 dark:text-gray-400 font-medium');
            $('#time-view-btn-timeline')
                .removeClass('bg-white dark:bg-slate-800 text-primary dark:text-purple-300 font-bold shadow-xs')
                .addClass('text-gray-500 dark:text-gray-400 font-medium');
        }

        this.renderCurrentView();
    }

    _handleToggleSort() {
        if (this.sortBy === 'createdAt') {
            this.sortBy = 'initDurationNanos';
            this.sortDir = 'DESC';
            $('#time-sort-label').text('Duration');
            $('#time-sort-icon').text('arrow_downward');
        } else if (this.sortBy === 'initDurationNanos') {
            this.sortBy = 'beanName';
            this.sortDir = 'ASC';
            $('#time-sort-label').text('Name');
            $('#time-sort-icon').text('sort_by_alpha');
        } else {
            this.sortBy = 'createdAt';
            this.sortDir = 'ASC';
            $('#time-sort-label').text('Order');
            $('#time-sort-icon').text('swap_vert');
        }

        this._resetPageAndFetch();
    }

    async _handleLoadMore() {
        if (this.currentPage < this.paginationState.totalPages) {
            this.currentPage++;
            await this.fetchInstanceData(true);
        }
    }

    async _handleRefreshData($target) {
        const $icon = $target.find('.material-symbols-outlined').addClass('animate-spin');
        try {
            await Promise.all([
                this.fetchSummaryData(),
                this.fetchInstanceData()
            ]);
        } catch (err) {
            console.error('Error refreshing bean instances:', err);
        } finally {
            setTimeout(() => $icon.removeClass('animate-spin'), 500);
        }
    }

    async _handleSelectBean($target) {
        const $row = $target.closest('[data-bean-name]');
        const beanName = $row.data('bean-name') || $row.attr('data-bean-name');
        const contextId = $row.data('context-id') || $row.attr('data-context-id');

        if (beanName) {
            await this.selectBean(contextId, beanName);
        }
    }

    _handleChangePage($target) {
        const targetPage = parseInt($target.data('page'), 10);
        if (!isNaN(targetPage) && targetPage !== this.currentPage) {
            this.currentPage = targetPage;
            this.fetchInstanceData();
        }
    }

    _handlePrevPage() {
        if (!this.paginationState.isFirstPage && this.currentPage > 1) {
            this.currentPage--;
            this.fetchInstanceData();
        }
    }

    _handleNextPage() {
        if (!this.paginationState.isLastPage && this.currentPage < this.paginationState.totalPages) {
            this.currentPage++;
            this.fetchInstanceData();
        }
    }

    _handleCloseSidebar(immediate = false) {
        const $sidebar = $('#time-details-sidebar');
        $('#time-sidebar-footer').addClass('hidden').hide();
        this.selectedBeanName = null;
        this.selectedContextId = null;
        this.selectedBeanInstance = null;
        $('.waterfall-row, .timeline-table-row').removeClass('gantt-row-selected bg-primary/10 dark:bg-purple-950/30 font-semibold');

        if (!$sidebar.length) return;

        $sidebar.removeClass('w-[380px] max-w-[380px] opacity-100 mr-0 border')
            .addClass('w-0 max-w-0 opacity-0 pointer-events-none -mr-6 border-0');
    }

    _on(target, event, delegateOrHandler, maybeHandler) {
        const namespace = '.timelineController';
        const namespacedEvent = `${event}${namespace}`;
        const $target = $(target);

        if (typeof delegateOrHandler === 'string') {
            $target.off(namespacedEvent, delegateOrHandler).on(namespacedEvent, delegateOrHandler, maybeHandler);
        } else {
            $target.off(namespacedEvent).on(namespacedEvent, delegateOrHandler);
        }
    }

    _resetPageAndFetch() {
        this.currentPage = 1;
        return this.fetchInstanceData();
    }

    _resetFilterState() {
        Object.assign(this, {
            searchQuery: '',
            minDurationMs: 0,
            quickFilter: 'all',
            pageSize: 20,
            currentPage: 1,
            sortBy: 'createdAt',
            sortDir: 'ASC',
            zoomLevel: 1
        });

        const defaults = {
            '#time-search-input': '',
            '#time-filter-created': 'oldest',
            '#time-filter-size': '20',
            '#time-zoom-slider': '1'
        };

        Object.entries(defaults).forEach(([selector, val]) => $(selector).val(val));
        $('#time-search-clear').addClass('hidden');
        $('#time-sort-label').text('Order');
        $('#time-sort-icon').text('swap_vert');
        $('#time-zoom-level-badge').text('100%');
        $('.time-quick-filter-btn')
            .removeClass('bg-white dark:bg-slate-800 text-primary dark:text-purple-300 font-bold shadow-xs')
            .addClass('text-gray-600 dark:text-gray-400 font-semibold');
        $('.time-quick-filter-btn[data-filter="all"]')
            .addClass('bg-white dark:bg-slate-800 text-primary dark:text-purple-300 font-bold shadow-xs')
            .removeClass('text-gray-600 dark:text-gray-400 font-semibold');
    }

    _downloadReport() {
        const reportData = {
            title: 'SpringLens Bean Instantiation Timeline Report',
            timestamp: new Date().toISOString(),
            summary: this.instanceSummary,
            totalElements: this.paginationState.totalElements,
            instances: this.instances
        };

        downloadJson(`spring-lens-timeline-${Date.now()}.json`, reportData);
    }

    /**
     * Helper for namespaced event binding.
     * @private
     */
    _on(target, event, delegateOrHandler, maybeHandler, namespace = '.timelineController') {
        const namespacedEvent = `${event}${namespace}`;
        const $target = $(target);

        if (typeof delegateOrHandler === 'string') {
            $target.off(namespacedEvent, delegateOrHandler).on(namespacedEvent, delegateOrHandler, maybeHandler);
        } else {
            $target.off(namespacedEvent).on(namespacedEvent, delegateOrHandler);
        }
    }

    leave() {
        this._handleCloseSidebar(true);
        this._resetFilterState();
        this._debouncedSearch?.cancel();
        $(document).off('.timelineController');
        $('#time-search-input, #time-zoom-slider, #time-filter-created, #time-filter-size, #timeline-scroll-container').off('.timelineController');
    }
}
