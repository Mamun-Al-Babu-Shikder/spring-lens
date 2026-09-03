import httpClient from '../../client/http-client.js';
import {
    CSS_CLASSES, SCOPE_COLORS, TemplateEngine, QueryParam, Pagination, Sidebar,
    resolveScopeStyle, downloadJson, debounce
} from '../../utils/index.js';

export default class InstancesController {

    constructor(beanInstanceApi, beanInstanceFindApi, beanInstanceProxyApi, beanDefinitionFindApi) {
        this.beanInstanceApi = beanInstanceApi;
        this.beanInstanceFindApi = beanInstanceFindApi;
        this.beanInstanceProxyApi = beanInstanceProxyApi;
        this.beanDefinitionFindApi = beanDefinitionFindApi;

        // Current table state
        this.instances = [];
        this.selectedInstance = null;
        this.selectedProxyInfo = null;
        this.activeSidebarTab = 'telemetry';

        // Filtering & Pagination State
        this.currentPage = 1;
        this.pageSize = 25;
        this.searchQuery = '';
        this.filterCriteria = {
            contextId: '',
            duration: '',
            createdOrder: ''
        };
        this.sortColumn = '';
        this.sortDirection = 'ASC';

        this.paginationState = {
            totalElements: 0,
            totalPages: 1,
            pageNumber: 0,
            pageSize: 25,
            isFirstPage: true,
            isLastPage: true
        };

        // Cache for summary metrics
        this.allContexts = new Set();
        this.scopeChart = null;

        // Debounced search
        this._debouncedFetch = debounce(() => {
            this.currentPage = 1;
            this.fetchTableData();
        }, 220);
    }

    /**
     * Lifecycle enter hook.
     * @param {string} params URL route parameters
     */
    async enter(params) {
        try {
            this._resetFilterState();
            this.closeSidebar(true);
            this.bindEvents();

            const queryParams = QueryParam.parse(params);
            const targetBean = QueryParam.get(queryParams, 'search', 'bean');
            const targetContextId = QueryParam.get(queryParams, 'contextId', 'context');

            if (targetBean) {
                this.searchQuery = targetBean;
                $('#inst-search-input').val(targetBean);
            }
            if (targetContextId) {
                this.filterCriteria.contextId = targetContextId;
                $('#inst-filter-context').val(targetContextId);
            }

            await this.fetchTableData();

            if (targetBean) {
                await this.selectInstance(targetContextId || '', targetBean);
            }
        } catch (error) {
            console.error('Error entering Bean Instances view:', error);
        }
    }

    /**
     * Resets filter and search parameters to defaults.
     * @private
     */
    _resetFilterState() {
        this.searchQuery = '';
        this.filterCriteria = {
            contextId: '',
            duration: '',
            createdOrder: ''
        };
        this.sortColumn = '';
        this.sortDirection = 'ASC';
        this.currentPage = 1;
        this.pageSize = 25;
        this.selectedInstance = null;
        this.selectedProxyInfo = null;

        $('#inst-search-input').val('');
        $('#inst-filter-context').val('');
        $('#inst-filter-duration').val('');
        $('#inst-filter-created').val('');
        $('#inst-filter-size').val('25');
        this._updateSortHeaderIcons();
    }

    /**
     * Builds URL query parameters for backend /instances endpoint.
     * @private
     * @returns {QueryParam}
     */
    _buildApiQueryParams() {
        const queryParams = QueryParam.build({
            pageNumber: this.currentPage - 1,
            pageSize: this.pageSize
        });

        if (this.searchQuery) {
            queryParams.append('search', this.searchQuery);
        }
        if (this.filterCriteria.contextId) {
            queryParams.append('contextId', this.filterCriteria.contextId);
        }
        if (this.filterCriteria.scope) {
            queryParams.append('scope', this.filterCriteria.scope);
        }
        if (this.sortColumn) {
            queryParams.append('sortBy', this.sortColumn);
            queryParams.append('sortDir', this.sortDirection);
        }

        return queryParams;
    }

    /**
     * Fetches paginated bean instances from REST API.
     */
    async fetchTableData() {
        this.renderLoadingState();

        try {
            const queryParams = this._buildApiQueryParams();
            const responseData = await httpClient.getWithQuery(
                this.beanInstanceApi,
                queryParams.toString()
            );

            this.processPaginatedResponse(responseData);
            this.renderKpiSummary();
            this.renderTableRows();
            this.renderPagination();
        } catch (error) {
            console.error('Error fetching bean instance data:', error);
            this.renderErrorState(error.message || 'Unable to connect to server');
        }
    }

    /**
     * Parses backend PageResponse into state.
     * @param {Object} responseData
     */
    processPaginatedResponse(responseData) {
        let rawContent = Array.isArray(responseData)
            ? responseData
            : (Array.isArray(responseData?.content) ? responseData.content : []);

        // Duration filtering
        if (this.filterCriteria.duration) {
            const dur = this.filterCriteria.duration;
            rawContent = rawContent.filter(item => {
                const nanos = item.initDurationNanos ?? 0;
                const ms = nanos / 1_000_000;
                if (dur === '<1ms') return ms < 1;
                if (dur === '1-10ms') return ms >= 1 && ms <= 10;
                if (dur === '10-50ms') return ms > 10 && ms <= 50;
                if (dur === '>50ms') return ms > 50;
                return true;
            });
        }

        // Created At ordering
        if (this.filterCriteria.createdOrder) {
            const order = this.filterCriteria.createdOrder;
            if (order === 'newest') {
                rawContent.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
            } else if (order === 'oldest') {
                rawContent.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
            }
        }

        this.instances = rawContent;

        this.paginationState = {
            totalElements: responseData?.totalElements ?? this.instances.length,
            totalPages: responseData?.totalPages ?? Math.max(1, Math.ceil((responseData?.totalElements ?? this.instances.length) / this.pageSize)),
            pageNumber: responseData?.pageNumber ?? (this.currentPage - 1),
            pageSize: responseData?.pageSize ?? this.pageSize,
            isFirstPage: responseData?.isFirstPage ?? (this.currentPage === 1),
            isLastPage: responseData?.isLastPage ?? (this.currentPage >= (responseData?.totalPages ?? 1))
        };

        // Collect distinct context IDs to populate dropdown
        this.instances.forEach(inst => {
            if (inst.contextId) this.allContexts.add(inst.contextId);
        });
        this._populateContextDropdown();
    }

    /**
     * Populates context filter select options.
     * @private
     */
    _populateContextDropdown() {
        const $select = $('#inst-filter-context');
        if (!$select.length) return;

        const currentVal = this.filterCriteria.contextId;
        const currentOptions = $select.find('option').map((_, el) => el.value).get();

        this.allContexts.forEach(ctx => {
            if (!currentOptions.includes(ctx)) {
                $select.append(`<option value="${ctx}">Context: ${ctx}</option>`);
            }
        });

        $select.val(currentVal);
    }

    /**
     * Computes and renders top KPI summary cards & Scope distribution chart.
     */
    renderKpiSummary() {
        const total = this.paginationState.totalElements;
        $('#inst-kpi-total').text(total.toLocaleString());

        // Context distribution pills
        const contextCounts = {};
        const scopeCounts = { singleton: 0, prototype: 0, other: 0 };
        let definedCount = 0;
        let totalInitNanos = 0;
        let validInitCount = 0;

        for (const inst of this.instances) {
            const ctx = inst.contextId || 'default';
            contextCounts[ctx] = (contextCounts[ctx] || 0) + 1;

            const scope = (inst.scope || 'singleton').toLowerCase();
            if (scope === 'singleton') scopeCounts.singleton++;
            else if (scope === 'prototype') scopeCounts.prototype++;
            else scopeCounts.other++;

            if (inst.hasDefinition) definedCount++;

            if (typeof inst.initDurationNanos === 'number' && inst.initDurationNanos > 0) {
                totalInitNanos += inst.initDurationNanos;
                validInitCount++;
            }
        }

        // Render context list
        const $contextList = $('#inst-context-list').empty();
        const ctxEntries = Object.entries(contextCounts);
        if (ctxEntries.length === 0) {
            $contextList.html('<span class="text-xs text-gray-400 italic">No contexts recorded</span>');
        } else {
            ctxEntries.forEach(([ctx, count]) => {
                $contextList.append(`
                    <div class="flex items-center justify-between text-xs py-0.5">
                        <span class="font-mono text-gray-600 dark:text-gray-300 truncate max-w-[130px] font-medium" title="${ctx}">${ctx}</span>
                        <span class="px-2 py-0.2 rounded-md bg-purple-50 text-primary dark:bg-purple-950/50 dark:text-purple-300 font-bold font-mono text-[11px]">${count}</span>
                    </div>
                `);
            });
        }

        // Definition status
        const definedPct = total > 0 ? Math.round((definedCount / this.instances.length) * 100) : 0;
        const dynamicCount = Math.max(0, this.instances.length - definedCount);
        const dynamicPct = total > 0 ? 100 - definedPct : 0;

        $('#inst-kpi-defined-count').text(definedCount);
        $('#inst-kpi-defined-pct').text(`(${definedPct}%)`);
        $('#inst-kpi-dynamic-count').text(dynamicCount);
        $('#inst-kpi-dynamic-pct').text(`(${dynamicPct}%)`);

        // Telemetry metrics
        const totalMs = (totalInitNanos / 1_000_000).toFixed(1);
        const avgMs = validInitCount > 0 ? (totalInitNanos / validInitCount / 1_000_000).toFixed(2) : '0.00';
        $('#inst-kpi-total-time').text(`${totalMs} ms`);
        $('#inst-kpi-avg-time').text(`${avgMs} ms`);

        // Render Scope Distribution chart
        this._renderScopeChart(scopeCounts);
    }

    /**
     * Renders or updates the Scope Chart.js donut.
     * @private
     */
    _renderScopeChart(scopeCounts) {
        const canvas = document.getElementById('instScopeChart');
        if (!canvas) return;

        const dataVals = [scopeCounts.singleton, scopeCounts.prototype, scopeCounts.other];
        const labels = ['Singleton', 'Prototype', 'Other'];
        const colors = [
            SCOPE_COLORS['Singleton'] || '#8b5cf6',
            SCOPE_COLORS['Prototype'] || '#06b6d4',
            SCOPE_COLORS['Request'] || '#f59e0b'
        ];

        // Render legend
        const $legend = $('#inst-scope-legend').empty();
        labels.forEach((label, idx) => {
            const count = dataVals[idx];
            if (count > 0 || idx === 0) {
                $legend.append(`
                    <div class="flex items-center justify-between text-xs">
                        <span class="flex items-center gap-1.5 text-gray-600 dark:text-gray-300 text-[11px]">
                            <span class="w-2 h-2 rounded-full" style="background-color: ${colors[idx]}"></span>
                            <span>${label}</span>
                        </span>
                        <span class="font-bold font-mono text-gray-800 dark:text-gray-200 text-[11px]">${count}</span>
                    </div>
                `);
            }
        });

        if (typeof Chart === 'undefined') return;

        if (this.scopeChart) {
            this.scopeChart.data.datasets[0].data = dataVals;
            this.scopeChart.update();
            return;
        }

        try {
            this.scopeChart = new Chart(canvas, {
                type: 'doughnut',
                data: {
                    labels,
                    datasets: [{
                        data: dataVals,
                        backgroundColor: colors,
                        borderWidth: 0,
                        borderRadius: 4,
                        spacing: 2,
                        hoverOffset: 3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '72%',
                    animation: {
                        animateScale: true,
                        animateRotate: true,
                        duration: 700,
                        easing: 'easeOutQuart'
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (ctx) => ` ${ctx.label}: ${ctx.raw}`
                            }
                        }
                    }
                }
            });
        } catch (e) {
            console.warn('Could not initialize Chart.js scope chart:', e);
        }
    }

    /**
     * Formats nanoseconds into human-readable duration strings (ms or µs).
     * @param {number} nanos
     * @returns {string}
     */
    formatDuration(nanos) {
        if (typeof nanos !== 'number' || nanos < 0) return '-';
        if (nanos === 0) return '0 ms';
        if (nanos < 1_000) return `${nanos} ns`;
        if (nanos < 1_000_000) return `${(nanos / 1_000).toFixed(1)} µs`;
        return `${(nanos / 1_000_000).toFixed(2)} ms`;
    }

    /**
     * Renders table rows in Explorer view.
     */
    renderTableRows() {
        const $tbody = $('#beanInstanceTableBody');
        if (!$tbody.length) return;

        $tbody.empty();

        if (this.instances.length === 0) {
            const emptyClone = TemplateEngine.clone('tpl-instance-empty');
            if (emptyClone) $tbody.append(emptyClone);
            return;
        }

        const fragment = document.createDocumentFragment();

        for (const instance of this.instances) {
            const clone = TemplateEngine.clone('tpl-instance-row');
            if (!clone?.firstElementChild) continue;

            const $row = $(clone.firstElementChild);
            const { beanName, type = '', scope = 'singleton', hasDefinition, initDurationNanos, contextId = '' } = instance;

            $row.attr('data-bean', beanName);
            $row.attr('data-context-id', contextId);

            // Active row highlight
            if (this.selectedInstance?.beanName === beanName && this.selectedInstance?.contextId === contextId) {
                $row.addClass(CSS_CLASSES.rowActive);
            }

            // Bean Name & Package Subtitle
            $row.find('[data-field="beanName"]').text(beanName);
            const pkg = type.includes('.') ? type.substring(0, type.lastIndexOf('.')) : '';
            $row.find('[data-field="packageName"]').text(pkg || 'default package');

            // Type Name
            const shortType = type.includes('.') ? type.substring(type.lastIndexOf('.') + 1) : type;
            $row.find('[data-field="typeName"]').text(shortType || '-').attr('title', type);

            // Scope Badge
            $row.find('[data-field="scopeBadge"]')
                .text(scope ? scope.toUpperCase() : 'SINGLETON')
                .css(resolveScopeStyle(scope));

            // Duration
            const formattedTime = this.formatDuration(initDurationNanos);
            $row.find('[data-field="durationFormatted"]').text(formattedTime);

            // Context ID
            $row.find('[data-field="contextId"]').text(contextId || '-').attr('title', contextId);

            fragment.appendChild(clone);
        }

        $tbody.append(fragment);
    }

    /**
     * Renders pagination metadata and page navigation buttons.
     */
    renderPagination() {
        const { totalElements, pageNumber, pageSize } = this.paginationState;
        const infoText = Pagination.formatInfoText(totalElements, pageNumber, pageSize, 'instances');
        $('#inst-pagination-info').text(infoText);

        Pagination.renderPaginationButtons($('#inst-pagination-buttons'), this.paginationState);
    }

    /**
     * Shows loading placeholder in table.
     */
    renderLoadingState() {
        const $tbody = $('#beanInstanceTableBody');
        if (!$tbody.length) return;
        const clone = TemplateEngine.clone('tpl-instance-loading');
        if (clone) $tbody.empty().append(clone);
    }

    /**
     * Shows error state in table.
     * @param {string} errorMessage
     */
    renderErrorState(errorMessage) {
        const $tbody = $('#beanInstanceTableBody');
        if (!$tbody.length) return;
        const clone = TemplateEngine.clone('tpl-instance-error');
        if (clone) {
            $(clone).find('[data-field="errorMessage"]').text(`Failed to fetch bean instances: ${errorMessage}`);
            $tbody.empty().append(clone);
        }
    }

    /**
     * Selects a bean instance and opens the side inspector drawer.
     * @param {string} contextId
     * @param {string} beanName
     */
    async selectInstance(contextId, beanName) {
        if (!beanName) return;

        // Toggle if already selected
        if (this.selectedInstance?.beanName === beanName && this.selectedInstance?.contextId === contextId) {
            this.closeSidebar();
            return;
        }

        // Highlight table row
        $('.instance-row').removeClass(CSS_CLASSES.rowActive);
        $(`.instance-row[data-bean="${beanName}"][data-context-id="${contextId}"]`).addClass(CSS_CLASSES.rowActive);

        // Find instance from current list or fetch single
        let instance = this.instances.find(i => i.beanName === beanName && (contextId ? i.contextId === contextId : true));
        if (!instance && this.beanInstanceFindApi) {
            try {
                const queryParams = QueryParam.build({ contextId, beanName });
                instance = await httpClient.getWithQuery(this.beanInstanceFindApi, queryParams.toString());
            } catch (err) {
                console.warn('Could not fetch individual bean instance:', err);
            }
        }

        if (!instance) return;
        this.selectedInstance = instance;

        // Open sidebar
        const $sidebar = $('#inst-details-sidebar');
        Sidebar.open($sidebar);

        // Fetch AOP Proxy Info concurrently
        this.selectedProxyInfo = null;
        if (this.beanInstanceProxyApi) {
            try {
                const proxyParams = QueryParam.build({ contextId: instance.contextId, beanName: instance.beanName });
                this.selectedProxyInfo = await httpClient.getWithQuery(this.beanInstanceProxyApi, proxyParams.toString());
            } catch (err) {
                // Not proxied or 404 is normal for plain beans
                this.selectedProxyInfo = null;
            }
        }

        this.renderSidebarContent();
    }

    /**
     * Renders detailed metadata, telemetry, and AOP proxy info in the side drawer.
     */
    renderSidebarContent() {
        const instance = this.selectedInstance;
        if (!instance) return;

        const { beanName, type = '', scope = 'singleton', hasDefinition, initDurationNanos, contextId, createdAt } = instance;
        const proxyInfo = this.selectedProxyInfo;
        const isProxied = Boolean(proxyInfo && proxyInfo.proxyType && proxyInfo.proxyType !== 'NONE');

        const scopeStyle = resolveScopeStyle(scope);
        const durationFormatted = this.formatDuration(initDurationNanos);
        const createdFormatted = createdAt ? new Date(createdAt).toLocaleString() : 'Bootstrap';

        const $sidebar = $('#inst-details-sidebar');
        $sidebar.html(`
            <div class="w-[380px] h-full flex flex-col">
                <!-- Sidebar Header -->
                <div class="p-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-gray-50/50 dark:bg-slate-900/60">
                    <div class="min-w-0 flex-1 pr-2">
                        <div class="flex items-center gap-2 flex-wrap mb-1">
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border shadow-xs" style="background-color: ${scopeStyle.backgroundColor}; color: ${scopeStyle.color}; border-color: ${scopeStyle.borderColor}">${scope.toUpperCase()}</span>
                            <span class="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 text-[10px] font-mono font-semibold">${contextId || 'default'}</span>
                            ${isProxied ? `<span class="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300 text-[10px] font-bold border border-indigo-200 dark:border-indigo-800/40">PROXIED</span>` : ''}
                        </div>
                        <h3 class="font-bold text-sm font-mono text-gray-900 dark:text-white truncate" title="${beanName}">${beanName}</h3>
                        <div class="text-[11px] text-gray-400 dark:text-gray-500 font-mono truncate mt-0.5" title="${type}">${type}</div>
                    </div>
                    <button class="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer flex-shrink-0"
                        data-action="close-sidebar" title="Close drawer (Esc)">
                        <span class="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>

                <!-- 3 Quick KPI Stat Blocks -->
                <div class="p-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50/20 dark:bg-slate-900/20">
                    <div class="grid grid-cols-3 gap-2 text-center">
                        <div class="bg-white dark:bg-slate-950 p-2.5 rounded-xl border border-gray-100 dark:border-slate-800 shadow-xs">
                            <div class="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Duration</div>
                            <div class="text-xs font-mono font-bold text-primary dark:text-purple-300 mt-0.5">${durationFormatted}</div>
                        </div>
                        <div class="bg-white dark:bg-slate-950 p-2.5 rounded-xl border border-gray-100 dark:border-slate-800 shadow-xs">
                            <div class="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Definition</div>
                            <div class="text-xs font-mono font-bold ${hasDefinition ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500'} mt-0.5">
                                ${hasDefinition ? 'Defined' : 'Dynamic'}
                            </div>
                        </div>
                        <div class="bg-white dark:bg-slate-950 p-2.5 rounded-xl border border-gray-100 dark:border-slate-800 shadow-xs">
                            <div class="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Proxy Type</div>
                            <div class="text-[11px] font-mono font-bold text-indigo-600 dark:text-indigo-400 mt-0.5 truncate" title="${proxyInfo?.proxyType || 'NONE'}">
                                ${proxyInfo?.proxyType || 'NONE'}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Drawer Navigation Tabs -->
                <div class="flex border-b border-gray-100 dark:border-slate-800 px-4 bg-gray-50/40 dark:bg-slate-900/40 gap-2">
                    <button data-action="switch-sidebar-tab" data-tab="telemetry"
                        class="py-2.5 px-3 text-xs font-bold transition-all cursor-pointer ${this.activeSidebarTab === 'telemetry' ? 'text-primary dark:text-purple-300 border-b-2 border-primary' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800'}">
                        Telemetry
                    </button>
                    <button data-action="switch-sidebar-tab" data-tab="proxy"
                        class="py-2.5 px-3 text-xs font-bold transition-all cursor-pointer ${this.activeSidebarTab === 'proxy' ? 'text-primary dark:text-purple-300 border-b-2 border-primary' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800'}">
                        AOP / Proxy ${isProxied ? '<span class="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block ml-1"></span>' : ''}
                    </button>
                    <button data-action="switch-sidebar-tab" data-tab="raw"
                        class="py-2.5 px-3 text-xs font-bold transition-all cursor-pointer ${this.activeSidebarTab === 'raw' ? 'text-primary dark:text-purple-300 border-b-2 border-primary' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800'}">
                        Raw JSON
                    </button>
                </div>

                <!-- Tab Panes Container -->
                <div class="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
                    <!-- Tab 1: Telemetry -->
                    <div id="inst-tab-pane-telemetry" class="${this.activeSidebarTab === 'telemetry' ? '' : 'hidden'} space-y-4">
                        <div class="space-y-2.5 text-xs">
                            <div class="flex justify-between items-center py-2 border-b border-gray-100 dark:border-slate-800/80">
                                <span class="text-gray-500 dark:text-gray-400 font-medium">Context ID</span>
                                <span class="font-mono text-gray-800 dark:text-gray-200 font-bold">${contextId || 'default'}</span>
                            </div>
                            <div class="flex justify-between items-center py-2 border-b border-gray-100 dark:border-slate-800/80">
                                <span class="text-gray-500 dark:text-gray-400 font-medium">Created At</span>
                                <span class="font-mono text-gray-800 dark:text-gray-200 font-semibold">${createdFormatted}</span>
                            </div>
                            <div class="flex justify-between items-center py-2 border-b border-gray-100 dark:border-slate-800/80">
                                <span class="text-gray-500 dark:text-gray-400 font-medium">Duration (nanos)</span>
                                <span class="font-mono text-primary dark:text-purple-300 font-bold">${(initDurationNanos ?? 0).toLocaleString()} ns</span>
                            </div>
                            <div class="flex justify-between items-center py-2 border-b border-gray-100 dark:border-slate-800/80">
                                <span class="text-gray-500 dark:text-gray-400 font-medium">Definition Registered</span>
                                <span class="font-mono font-bold ${hasDefinition ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}">${hasDefinition ? 'Yes' : 'No (Transient/Dynamic)'}</span>
                            </div>
                        </div>

                        <!-- Full Class Name Box -->
                        <div class="bg-gray-50 dark:bg-slate-950/80 p-3 rounded-xl border border-gray-100 dark:border-slate-800/80">
                            <span class="text-[10px] text-gray-400 font-bold uppercase block mb-1">Target Class</span>
                            <span class="text-xs font-mono text-gray-800 dark:text-gray-200 font-medium break-all">${type}</span>
                        </div>
                    </div>

                    <!-- Tab 2: AOP / Proxy Info -->
                    <div id="inst-tab-pane-proxy" class="${this.activeSidebarTab === 'proxy' ? '' : 'hidden'} space-y-4">
                        ${!proxyInfo ? `
                            <div class="py-8 text-center text-gray-400 dark:text-gray-500 space-y-1.5">
                                <span class="material-symbols-outlined text-3xl">security</span>
                                <p class="text-xs font-semibold">No AOP Proxy configured</p>
                                <span class="text-[11px] block text-gray-400">This bean instance runs directly as a plain target instance.</span>
                            </div>
                        ` : `
                            <div class="space-y-3">
                                <div class="p-3 bg-gray-50 dark:bg-slate-950/80 rounded-xl border border-gray-100 dark:border-slate-800 text-xs space-y-2">
                                    <div class="flex justify-between items-center">
                                        <span class="text-gray-400 font-medium">Proxy Type:</span>
                                        <span class="font-mono font-bold text-indigo-600 dark:text-indigo-400">${proxyInfo.proxyType}</span>
                                    </div>
                                    <div class="flex justify-between items-center">
                                        <span class="text-gray-400 font-medium">Advice Frozen:</span>
                                        <span class="font-mono font-bold text-gray-700 dark:text-gray-300">${proxyInfo.adviceFrozen ? 'True' : 'False'}</span>
                                    </div>
                                    <div>
                                        <span class="text-gray-400 font-medium block mb-0.5">Target Class:</span>
                                        <span class="font-mono font-bold text-gray-800 dark:text-gray-200 break-all">${proxyInfo.targetClass || type}</span>
                                    </div>
                                </div>

                                <!-- Advices List -->
                                <div class="space-y-1.5">
                                    <h5 class="text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Advices / Interceptors (${proxyInfo.advices?.length || 0})</h5>
                                    ${(!proxyInfo.advices || proxyInfo.advices.length === 0) ? '<p class="text-xs text-gray-400 italic">No advices recorded.</p>' : `
                                        <div class="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                                            ${proxyInfo.advices.map(adv => `
                                                <div class="p-2 rounded-lg bg-gray-50 dark:bg-slate-950 border border-gray-100 dark:border-slate-800/60 font-mono text-[11px] text-gray-700 dark:text-gray-300 break-all flex items-center gap-1.5">
                                                    <span class="material-symbols-outlined text-[14px] text-indigo-500 flex-shrink-0">adjust</span>
                                                    <span>${adv}</span>
                                                </div>
                                            `).join('')}
                                        </div>
                                    `}
                                </div>

                                <!-- Proxied Interfaces -->
                                <div class="space-y-1.5">
                                    <h5 class="text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Proxied Interfaces (${proxyInfo.proxiedInterfaces?.length || 0})</h5>
                                    ${(!proxyInfo.proxiedInterfaces || proxyInfo.proxiedInterfaces.length === 0) ? '<p class="text-xs text-gray-400 italic">No proxied interfaces recorded.</p>' : `
                                        <div class="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                                            ${proxyInfo.proxiedInterfaces.map(iface => `
                                                <div class="p-2 rounded-lg bg-gray-50 dark:bg-slate-950 border border-gray-100 dark:border-slate-800/60 font-mono text-[11px] text-gray-700 dark:text-gray-300 break-all flex items-center gap-1.5">
                                                    <span class="material-symbols-outlined text-[14px] text-emerald-500 flex-shrink-0">cable</span>
                                                    <span>${iface}</span>
                                                </div>
                                            `).join('')}
                                        </div>
                                    `}
                                </div>
                            </div>
                        `}
                    </div>

                    <!-- Tab 3: Raw JSON -->
                    <div id="inst-tab-pane-raw" class="${this.activeSidebarTab === 'raw' ? '' : 'hidden'} space-y-3">
                        <pre class="bg-gray-50 dark:bg-slate-950 p-3 rounded-xl border border-gray-200 dark:border-slate-800 text-[11px] font-mono text-gray-800 dark:text-gray-200 overflow-x-auto custom-scrollbar max-h-[380px]">${JSON.stringify({ instance, proxyInfo }, null, 2)}</pre>
                    </div>
                </div>

                <!-- Sidebar Footer Actions -->
                <div class="p-4 border-t border-gray-100 dark:border-slate-800 mt-auto bg-gray-50/50 dark:bg-slate-900/50 flex gap-2">
                    ${hasDefinition ? `
                        <a href="#/definitions?bean=${encodeURIComponent(beanName)}&contextId=${encodeURIComponent(contextId || '')}"
                            class="flex-1 py-2 px-3 bg-gradient-to-r from-primary via-purple-600 to-indigo-600 hover:from-primary/95 hover:to-indigo-600/95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm shadow-primary/25 hover:shadow-md transition-all cursor-pointer">
                            <span class="material-symbols-outlined text-[16px]">open_in_new</span> Open Definition
                        </a>
                    ` : ''}
                    <button data-action="close-sidebar"
                        class="px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-gray-100 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-xs">
                        Close
                    </button>
                </div>
            </div>
        `);
    }

    /**
     * Closes the side drawer smoothly.
     * @param {boolean} [immediate=false]
     */
    closeSidebar(immediate = false) {
        $('.instance-row').removeClass(CSS_CLASSES.rowActive);
        this.selectedInstance = null;
        this.selectedProxyInfo = null;

        const $sidebar = $('#inst-details-sidebar');
        if (immediate) {
            $sidebar.addClass('w-0 max-w-0 opacity-0 pointer-events-none -mr-6').removeClass('w-[380px] max-w-[380px] opacity-100 pointer-events-auto mr-0');
        } else {
            Sidebar.close($sidebar);
        }
    }

    /**
     * Binds DOM event listeners and delegates actions.
     */
    bindEvents() {
        this._initActionHandlers();
        this._bindSearchInput();
        this._bindFilterDropdowns();
        this._bindSortHeaders();
        this._bindGlobalKeydown();
        this._bindClickActionDelegation();
    }

    /**
     * Action dictionary for data-action elements.
     * @private
     */
    _initActionHandlers() {
        this._clickActions = {
            'refresh-data': () => this.fetchTableData(),
            'export-data': () => this.exportData(),
            'reset-filters': () => {
                this._resetFilterState();
                this.fetchTableData();
            },
            'select-instance': ($target) => {
                const beanName = $target.data('bean');
                const contextId = $target.data('context-id') || '';
                this.selectInstance(contextId, beanName);
            },
            'close-sidebar': () => this.closeSidebar(),
            'switch-sidebar-tab': ($target) => {
                const tab = $target.data('tab');
                if (tab) {
                    this.activeSidebarTab = tab;
                    this.renderSidebarContent();
                }
            },
            'change-page': ($target) => {
                const page = parseInt($target.data('page'), 10);
                if (!isNaN(page) && page !== this.currentPage) {
                    this.currentPage = page;
                    this.fetchTableData();
                }
            },
            'prev-page': () => {
                if (!this.paginationState.isFirstPage && this.currentPage > 1) {
                    this.currentPage--;
                    this.fetchTableData();
                }
            },
            'next-page': () => {
                if (!this.paginationState.isLastPage && this.currentPage < this.paginationState.totalPages) {
                    this.currentPage++;
                    this.fetchTableData();
                }
            }
        };
    }

    /**
     * Debounced search input handler.
     * @private
     */
    _bindSearchInput() {
        this._on('#inst-search-input', 'input', (e) => {
            this.searchQuery = e.target.value.trim();
            this._debouncedFetch();
        });

        this._on('#inst-search-input', 'keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this._debouncedFetch.flush();
            } else if (e.key === 'Escape') {
                this._debouncedFetch.cancel();
                this.searchQuery = '';
                $('#inst-search-input').val('');
                this.currentPage = 1;
                this.fetchTableData();
            }
        });
    }

    /**
     * Filter change events.
     * @private
     */
    _bindFilterDropdowns() {
        this._on('#inst-filter-context', 'change', (e) => {
            this.filterCriteria.contextId = e.target.value;
            this.currentPage = 1;
            this.fetchTableData();
        });

        this._on('#inst-filter-duration', 'change', (e) => {
            this.filterCriteria.duration = e.target.value;
            this.currentPage = 1;
            this.fetchTableData();
        });

        this._on('#inst-filter-created', 'change', (e) => {
            this.filterCriteria.createdOrder = e.target.value;
            this.currentPage = 1;
            this.fetchTableData();
        });

        this._on('#inst-filter-size', 'change', (e) => {
            this.pageSize = parseInt(e.target.value, 10) || 25;
            this.currentPage = 1;
            this.fetchTableData();
        });
    }

    /**
     * Sort headers click handler.
     * @private
     */
    _bindSortHeaders() {
        this._on('.th-sortable', 'click', (e) => {
            const $th = $(e.currentTarget);
            const sortCol = $th.data('sort');
            if (!sortCol) return;

            if (this.sortColumn === sortCol) {
                this.sortDirection = this.sortDirection === 'ASC' ? 'DESC' : 'ASC';
            } else {
                this.sortColumn = sortCol;
                this.sortDirection = 'ASC';
            }

            this._updateSortHeaderIcons();
            this.currentPage = 1;
            this.fetchTableData();
        });
    }

    /**
     * Updates header sort arrow icons.
     * @private
     */
    _updateSortHeaderIcons() {
        $('.th-sortable .sort-icon').text('unfold_more').removeClass('text-primary dark:text-purple-300').addClass('text-gray-400');

        if (this.sortColumn) {
            const iconName = this.sortDirection === 'ASC' ? 'expand_less' : 'expand_more';
            $(`.th-sortable[data-sort="${this.sortColumn}"] .sort-icon`)
                .text(iconName)
                .removeClass('text-gray-400')
                .addClass('text-primary dark:text-purple-300 font-bold');
        }
    }

    /**
     * Keyboard shortcut handler (<kbd>Esc</kbd> closes sidebar).
     * @private
     */
    _bindGlobalKeydown() {
        this._on(document, 'keydown', (e) => {
            if (e.key === 'Escape' && this.selectedInstance) {
                this.closeSidebar();
            }
        });
    }

    /**
     * Delegated clicks for [data-action].
     * @private
     */
    _bindClickActionDelegation() {
        this._on(document, 'click', '[data-action]', (e) => {
            const $target = $(e.currentTarget);
            const action = $target.data('action');
            const handler = this._clickActions[action];

            if (handler) {
                e.preventDefault();
                handler($target, e);
            }
        });
    }

    /**
     * Downloads JSON payload of current instances.
     */
    exportData() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        downloadJson(this.instances, `springlens-bean-instances-${timestamp}.json`);
    }

    /**
     * Helper for jQuery event binding with namespacing.
     * @private
     */
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

    /**
     * Cleans up event listeners, charts, and debounced timers on route leave.
     */
    leave() {
        this.closeSidebar(true);
        this._debouncedFetch?.cancel();
        if (this.scopeChart) {
            this.scopeChart.destroy();
            this.scopeChart = null;
        }
        $(document).off('.beanInstances');
        $('#inst-search-input, #inst-filter-context, #inst-filter-duration, #inst-filter-created, #inst-filter-size').off('.beanInstances');
    }
}
