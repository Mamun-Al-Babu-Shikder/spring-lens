import httpClient from '../../client/http-client.js';
import GraphTreeBuilder from '../../builder/graph-tree-builder.js';
import beanDataStore from '../../storage/bean-data-store.js';
import {
    CLASSES, DURATION_BAR_RULES,
    TemplateEngine, QueryParam, Pagination
} from '../../utils/index.js';

export default class InstanceController {
    constructor(beanInstanceApi, beanInstanceFindApi) {
        this.beanInstanceApi = beanInstanceApi;
        this.beanInstanceFindApi = beanInstanceFindApi;

        this.instances = [];
        this.filteredInstances = [];
        this.selectedBeanInstance = null;

        this.currentPage = 1;
        this.pageSize = 15;
        this.searchQuery = '';
        this.scopeFilter = '';
        this.minDurationMs = 0;
        this.sortBy = 'createdAt';
        this.sortDir = 'ASC';
        this.selectedBeanName = null;
        this.selectedContextId = null;

        this.paginationState = {
            totalElements: 0,
            totalPages: 1,
            pageNumber: 0,
            pageSize: 15,
            isFirstPage: true,
            isLastPage: true
        };

        this.maxTimeMs = 100;
        this._searchDebounceTimer = null;
    }

    async enter() {
        try {
            this.initEvents();
            await this.fetchInstanceData();
        } catch (error) {
            console.error('Error in InstanceController enter:', error);
        }
    }

    /**
     * Fetches bean instance page data from backend REST API (/instances).
     */
    async fetchInstanceData() {
        this.renderLoadingState();

        const queryParams = this._buildApiQueryParams();

        try {
            const responseData = await httpClient.getWithQuery(
                this.beanInstanceApi,
                queryParams.toString()
            );

            this.processPaginatedResponse(responseData);
            this.computeTimelineMetrics();
            this.applyLocalFilters();

            this.renderInstanceSummary();
            this.renderGridHeaderAndLines();
            this.renderGanttRows();
            this.renderPagination();
        } catch (error) {
            console.error('Error fetching bean instance data:', error);
            this.renderErrorState(error.message);
        }
    }

    _buildApiQueryParams() {
        return QueryParam.build({
            pageNumber: this.currentPage - 1,
            pageSize: this.pageSize,
            search: this.searchQuery,
            scope: this.scopeFilter,
            sortBy: this.sortBy,
            sortDir: this.sortDir
        });
    }

    processPaginatedResponse(responseData) {
        const content = Array.isArray(responseData?.content) ? responseData.content : [];
        this.instances = content;
        beanDataStore.addBeans(content);

        const totalElements = responseData?.totalElements ?? content.length;
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
     * Parses ISO timestamp string into millisecond accuracy (with microsecond fraction support).
     */
    parseIsoToMs(isoStr) {
        if (!isoStr || typeof isoStr !== 'string') return 0;

        // Matches fractional seconds (.123456) and captures everything before and after
        const match = isoStr.match(/^(.*?)(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/);
        if (!match) return 0;

        const [, base, fractionStr, tz = ''] = match;
        const baseMs = Date.parse(`${base}${tz}`);

        if (Number.isNaN(baseMs)) return 0;

        const fractionalMs = fractionStr ? parseFloat(fractionStr) * 1000 : 0;
        return baseMs + fractionalMs;
    }

    /**
     * Formats nanoseconds into readable time string (ns, µs, ms, s).
     */
    formatDuration(nanos) {
        if (nanos === undefined || nanos === null) return '0 ms';
        if (nanos >= 1_000_000_000) return (nanos / 1e9).toFixed(2) + ' s';
        if (nanos >= 1_000_000) return (nanos / 1e6).toFixed(2) + ' ms';
        if (nanos >= 1_000) return (nanos / 1e3).toFixed(2) + ' µs';
        return nanos + ' ns';
    }

    computeTimelineMetrics() {
        if (this.instances.length === 0) {
            this.maxTimeMs = 100;
            return;
        }

        const timestamps = this.instances.map(inst => this.parseIsoToMs(inst.createdAt));
        const minCreatedMs = Math.min(...timestamps);

        let maxEndOffsetMs = 0;

        this.instances.forEach(inst => {
            const createdMs = this.parseIsoToMs(inst.createdAt);
            const initDurationMs = (inst.initDurationNanos || 0) / 1e6;
            const relativeStartMs = Math.max(0, createdMs - minCreatedMs);
            const relativeEndMs = relativeStartMs + initDurationMs;

            inst.relativeStartMs = relativeStartMs;
            inst.initDurationMs = initDurationMs;
            inst.relativeEndMs = relativeEndMs;

            if (relativeEndMs > maxEndOffsetMs) {
                maxEndOffsetMs = relativeEndMs;
            }
        });

        this.maxTimeMs = maxEndOffsetMs > 0 ? maxEndOffsetMs * 1.05 : 100;
    }

    applyLocalFilters() {
        if (this.minDurationMs > 0) {
            this.filteredInstances = this.instances.filter(inst => inst.initDurationMs >= this.minDurationMs);
        } else {
            this.filteredInstances = [...this.instances];
        }
    }

    renderInstanceSummary() {
        let totalDurationMs = 0;
        let heavyCount = 0;
        let slowest = null;

        for (const inst of (this.instances || [])) {
            const ms = inst.initDurationMs || 0;
            const nanos = inst.initDurationNanos || 0;

            totalDurationMs += ms;
            if (ms >= 50) heavyCount++;
            if (!slowest || nanos > (slowest.initDurationNanos || 0)) {
                slowest = inst;
            }
        }

        const totalElements = this.paginationState?.totalElements || this.instances?.length || 0;
        const heavyPct = totalElements > 0 ? ((heavyCount / totalElements) * 100).toFixed(1) : '0';

        // Update KPI UI
        $('#time-kpi-total').text(this.formatDuration(totalDurationMs * 1e6));
        $('#time-kpi-slowest-name').text(slowest ? GraphTreeBuilder._displayName(slowest.beanName) : 'None');
        $('#time-kpi-slowest-val').text(slowest ? this.formatDuration(slowest.initDurationNanos) : '0 ms');
        $('#time-kpi-heavy').text(heavyCount);
        $('#time-kpi-heavy-pct').text(`${heavyPct}% of total instances`);
    }

    renderGridHeaderAndLines() {
        const $header = $('#time-grid-header');
        const $lines = $('#time-grid-lines');
        if (!$header.length || !$lines.length) return;

        $header.empty();
        $lines.empty();

        const numIntervals = 6;
        const maxTime = this.maxTimeMs || 0;
        const headerFrag = document.createDocumentFragment();
        const linesFrag = document.createDocumentFragment();

        for (let i = 0; i <= numIntervals; i++) {
            const leftPct = (i / numIntervals) * 100;
            const timeVal = ((i * maxTime) / numIntervals).toFixed(1);

            const markerClone = TemplateEngine.clone('tpl-time-grid-marker');
            if (markerClone?.firstElementChild) {
                $(markerClone.firstElementChild)
                    .css('left', `${leftPct}%`)
                    .text(`${timeVal}ms`);
                headerFrag.appendChild(markerClone);
            }

            if (i > 0 && i < numIntervals) {
                const lineClone = TemplateEngine.clone('tpl-time-grid-line');
                if (lineClone?.firstElementChild) {
                    $(lineClone.firstElementChild).css('left', `${leftPct}%`);
                    linesFrag.appendChild(lineClone);
                }
            }
        }

        $header.append(headerFrag);
        $lines.append(linesFrag);
    }

    renderGanttRows() {
        const $container = $('#time-rows-container');
        if (!$container.length) return;

        $container.empty();

        if (!this.filteredInstances?.length) {
            const emptyClone = TemplateEngine.clone('tpl-time-empty');
            if (emptyClone) $container.append(emptyClone);
            return;
        }

        const fragment = document.createDocumentFragment();

        for (const inst of this.filteredInstances) {
            const rowNode = this._createGanttRowNode(inst);
            if (rowNode) fragment.appendChild(rowNode);
        }

        $container.append(fragment);
    }

    _createGanttRowNode(inst) {
        const clone = TemplateEngine.clone('tpl-time-row');
        if (!clone?.firstElementChild) return null;

        const $row = $(clone.firstElementChild);
        const { beanName, contextId, initDurationMs = 0, relativeStartMs = 0, scope, type } = inst;

        // Selection styling
        const isSelected = (this.selectedBeanName === beanName)
            && (this.selectedContextId === contextId);

        if (isSelected) {
            $row.addClass(CLASSES.rowActive);
        }

        $row.attr({
            'data-context-id': contextId,
            'data-bean-name': beanName,
        });

        // Content bindings
        $row.find('[data-field="displayName"]')
            .text(GraphTreeBuilder._displayName(beanName))
            .attr('title', beanName);
        $row.find('[data-field="scope"]').text(scope || 'singleton');
        $row.find('[data-field="type"]').text(type || 'N/A').attr('title', type || '');

        // Positioning and Bar styling
        const maxTime = this.maxTimeMs || 1;
        const leftPct = (relativeStartMs / maxTime) * 100;
        const widthPct = Math.max((initDurationMs / maxTime) * 100, 1.2);
        const formattedDuration = this.formatDuration(inst.initDurationNanos);

        const $bar = $row.find('[data-field="bar"]');
        $bar.addClass(this.getBarColor(initDurationMs))
            .css({ left: `${leftPct}%`, width: `${widthPct}%` })
            .attr('title', `Start Offset: ${relativeStartMs.toFixed(2)}ms | Duration: ${formattedDuration}`);

        // Duration label positioning (inside bar if > 20ms, otherwise adjacent)
        if (initDurationMs > 20) {
            $bar.text(formattedDuration);
        } else {
            $row.find('[data-field="extLabel"]')
                .removeClass('hidden')
                .css('left', `calc(${leftPct}% + ${widthPct}% + 6px)`)
                .text(formattedDuration);
        }

        return clone;
    }

    getBarColor(durationMs) {
        const match = DURATION_BAR_RULES.find(rule => durationMs > rule.minDurationMs);
        return match ? match.classes : 'bg-primary hover:bg-primary/95';
    }

    renderPagination() {
        const { totalElements, pageNumber, pageSize } = this.paginationState;

        const infoText = Pagination.formatInfoText(totalElements, pageNumber, pageSize, 'beans');
        $('#time-pagination-info').text(infoText);

        Pagination.renderPaginationButtons($('#time-pagination-buttons'), this.paginationState);
    }

    renderLoadingState() {
        const $container = $('#time-rows-container');
        if (!$container.length) return;
        const clone = TemplateEngine.clone('tpl-time-loading');
        if (clone) $container.empty().append(clone);
    }

    renderErrorState(errorMessage) {
        const $container = $('#time-rows-container');
        if (!$container.length) return;
        const clone = TemplateEngine.clone('tpl-time-error');
        if (clone) {
            $(clone).find('[data-field="errorMessage"]').text(`Failed to fetch bean instances: ${errorMessage}`);
            $container.empty().append(clone);
        }
    }

    /**
     * Selects a bean instance and fetches single instance details from backend (/instances/find).
     */
    async selectBean(contextId, beanName) {
        if (!contextId || !beanName) return;

        this.selectedContextId = contextId;
        this.selectedBeanName = beanName;

        $('.time-row').removeClass(CLASSES.rowActive);
        $(`.time-row[data-context-id="${contextId}"][data-bean-name="${beanName}"]`).addClass(CLASSES.rowActive);

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

        const {beanName, type, scope, initDurationNanos, relativeStartMs, contextId, createdAt} = instance;

        const data = {
            name: GraphTreeBuilder._displayName(beanName),
            type: type || 'N/A',
            scope: scope || 'singleton',
            duration: this.formatDuration(initDurationNanos),
            start: relativeStartMs != null ? `${instance.relativeStartMs.toFixed(2)} ms` : '-',
            context: contextId || 'N/A',
            created: createdAt || 'N/A',
            nanos: (initDurationNanos || 0).toLocaleString()
        };

        $('#time-details-sidebar').removeClass('hidden').show()
            .find('[data-field]').each((_, el) => {
                const field = el.dataset.field;
                if (data[field] != null) {
                    $(el).text(data[field]);
                }
            });
    }

    initEvents() {
        this._initActionHandlers();
        this._bindSearchInput();
        this._bindFilterChangeEvents();
        this._bindClickActionDelegation();
    }

    /**
     * Initializes handler routing maps once to prevent object re-creation on every interaction.
     */
    _initActionHandlers() {
        // Action router for [data-action] clicks
        this._clickActions = {
            'refresh-data': ($target) => this._handleRefreshData($target),
            'reset-filters': () => {
                this._resetFilterState();
                return this.fetchInstanceData();
            },
            'select-bean': ($target) => this._handleSelectBean($target),
            'change-page': ($target) => this._handleChangePage($target),
            'prev-page': () => this._handlePrevPage(),
            'next-page': () => this._handleNextPage(),
            'close-sidebar': () => this._handleCloseSidebar(),
            'download-report': () => this._downloadReport()
        };

        // Filter change router mapped by element ID
        this._filterChangeActions = {
            'time-filter-scope': (val) => {
                this.scopeFilter = val;
                return this._resetPageAndFetch();
            },
            'time-filter-duration': (val) => {
                this.minDurationMs = parseFloat(val) || 0;
                this.applyLocalFilters();
                this.renderGanttRows();
            },
            'time-sort-by': (val) => {
                const [field, dir = 'ASC'] = val.split('_');
                this.sortBy = field;
                this.sortDir = dir.toUpperCase();
                return this._resetPageAndFetch();
            },
            'time-filter-size': (val) => {
                this.pageSize = parseInt(val, 10) || 15;
                return this._resetPageAndFetch();
            }
        };
    }

    /**
     * Handles debounced text search.
     */
    _bindSearchInput() {
        this._on('#time-search-input', 'input', (e) => {
            clearTimeout(this._searchDebounceTimer);
            this.searchQuery = e.target.value.trim();
            this._searchDebounceTimer = setTimeout(() => this._resetPageAndFetch(), 300);
        });
    }

    /**
     * Routes change events via the _filterChangeActions map.
     */
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

    /**
     * Centralized click router using the _clickActions routing map.
     */
    _bindClickActionDelegation() {
        this._on(document, 'click', '[data-action]', (e) => {
            const $target = $(e.currentTarget);
            const action = $target.data('action');
            const handler = this._clickActions[action];

            if (handler) {
                e.preventDefault();
                handler($target, e);
            } else {
                console.warn(`Unhandled action: ${action}`);
            }
        });
    }

    async _handleRefreshData($target) {
        const $icon = $target.find('.material-symbols-outlined').addClass('animate-spin');
        try {
            await this.fetchInstanceData();
        } catch (err) {
            console.error('Error refreshing bean instances:', err);
        } finally {
            setTimeout(() => $icon.removeClass('animate-spin'), 500);
        }
    }

    async _handleSelectBean($target) {
        const { beanName, contextId } = $target.data();
        if (beanName && contextId) {
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

    _handleCloseSidebar() {
        $('#time-details-sidebar').addClass('hidden').hide();
        this.selectedBeanName = null;
        this.selectedContextId = null;
        this.selectedBeanInstance = null;
        $('.time-row').removeClass(CLASSES.rowActive);
    }

    _on(target, event, delegateOrHandler, maybeHandler) {
        const namespace = '.beanInstances';
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
            scopeFilter: '',
            minDurationMs: 0,
            pageSize: 15,
            currentPage: 1,
            sortBy: 'createdAt',
            sortDir: 'ASC',
        });

        const defaults = {
            '#time-search-input': '',
            '#time-filter-scope': '',
            '#time-filter-duration': '0',
            '#time-sort-by': 'createdAt_asc',
            '#time-filter-size': '15',
        };

        Object.entries(defaults).forEach(([selector, val]) => $(selector).val(val));
    }

    _downloadReport() {
        const reportData = {
            title: 'SpringLens Bean Instantiation Report',
            timestamp: new Date().toISOString(),
            totalElements: this.paginationState.totalElements,
            instances: this.instances
        };

        const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');

        anchor.href = url;
        anchor.download = `spring-lens-instances-${Date.now()}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
    }

    leave() {
        this._handleCloseSidebar();
        if (this._searchDebounceTimer) {
            clearTimeout(this._searchDebounceTimer);
        }
        $(document).off('.beanInstances');
        $('#time-search-input, #time-filter-scope, #time-filter-duration, #time-sort-by, #time-filter-size').off('.beanInstances');
    }
}
