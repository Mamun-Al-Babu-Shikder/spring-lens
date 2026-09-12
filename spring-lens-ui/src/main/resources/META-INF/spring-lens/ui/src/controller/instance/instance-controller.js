import {
    BaseController,
    beanDataStore,
    AsyncUtils,
    Formatter,
    QueryParam,
    BeanMetadataRules,
    InstanceService,
    InstanceKpiWidget,
    InstanceWaterfallWidget,
    InstanceTableWidget,
    InstanceSidebarWidget
} from './index.js';

/**
 * Controller Facade for Bean Instances (Startup Waterfall & Profiler).
 * Coordinates executive summary KPIs, Gantt waterfall timeline visualization,
 * tabular data grid, and slide-over telemetry/AOP proxy inspection panel.
 */
export class InstanceController extends BaseController {

    /**
     * @param {Object} [endpoints={}] - API endpoints mapping
     */
    constructor(endpoints = {}) {
        super('instanceController');
        this.service = new InstanceService(endpoints);
        this.kpiWidget = new InstanceKpiWidget();
        this.waterfallWidget = new InstanceWaterfallWidget();
        this.tableWidget = new InstanceTableWidget();
        this.sidebarWidget = new InstanceSidebarWidget();

        this.addDisposable(this.waterfallWidget);
        this.addDisposable(this.sidebarWidget);
        this.addDisposable(this.tableWidget);

        this.instances = [];
        this.filteredInstances = [];

        // Decoupled selection state: separate Gantt vs Table
        this.selectedGanttBeanName = null;
        this.selectedGanttContextId = null;
        this.selectedGanttInstance = null;

        this.selectedTableBeanName = null;
        this.selectedTableContextId = null;
        this.selectedTableInstance = null;

        this.currentPage = 1;
        this.pageSize = 20;
        this.searchQuery = '';
        this.minDurationMs = 0;
        this.quickFilter = 'all';
        this.sortBy = 'createdAt';
        this.sortDir = 'ASC';
        this.activeView = 'instance'; // 'instance' (waterfall) or 'table'

        const savedThreshold = parseInt(localStorage.getItem('sl-bottleneck-threshold-nanos'), 10);
        this.bottleneckThresholdNanos = Number.isFinite(savedThreshold) && savedThreshold > 0 ? savedThreshold : 500000;

        this.paginationState = {
            totalElements: 0,
            totalPages: 1,
            pageNumber: 0,
            pageSize: 20,
            isFirstPage: true,
            isLastPage: true
        };

        this.maxTimeMs = 100;
        this.maxDurationNanos = 0;
        this.instanceSummary = null;

        this._debouncedSearch = AsyncUtils.debounce(() => this._resetPageAndFetch(), 250);
        this.addDisposable(this._debouncedSearch);
    }

    // --- Backward Compatible Getters & Setters ---

    get selectedBeanName() {
        return this.activeView === 'instance' ? this.selectedGanttBeanName : this.selectedTableBeanName;
    }

    set selectedBeanName(val) {
        if (this.activeView === 'instance') {
            this.selectedGanttBeanName = val;
        } else {
            this.selectedTableBeanName = val;
        }
    }

    get selectedContextId() {
        return this.activeView === 'instance' ? this.selectedGanttContextId : this.selectedTableContextId;
    }

    set selectedContextId(val) {
        if (this.activeView === 'instance') {
            this.selectedGanttContextId = val;
        } else {
            this.selectedTableContextId = val;
        }
    }

    get selectedBeanInstance() {
        return this.activeView === 'instance' ? this.selectedGanttInstance : this.selectedTableInstance;
    }

    set selectedBeanInstance(val) {
        if (this.activeView === 'instance') {
            this.selectedGanttInstance = val;
        } else {
            this.selectedTableInstance = val;
        }
    }

    get activeSidebarTab() {
        return this.sidebarWidget.activeTab;
    }

    set activeSidebarTab(val) {
        this.sidebarWidget.activeTab = val;
    }

    get zoomLevel() {
        return this.waterfallWidget.zoomLevel;
    }

    set zoomLevel(val) {
        this.waterfallWidget.zoomLevel = val;
    }

    get beanInstanceApi() {
        return this.service.beanInstanceApi;
    }

    get beanInstanceFindApi() {
        return this.service.beanInstanceFindApi;
    }

    get beanInstanceSummaryApi() {
        return this.service.beanInstanceSummaryApi;
    }

    get beanInstanceProxyApi() {
        return this.service.beanInstanceProxyApi;
    }

    // --- Lifecycle Methods ---

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
            console.error('Error in Instance enter:', error);
        }
    }

    async fetchSummaryData() {
        try {
            const summaryData = await this.service.fetchSummaryData();
            this.instanceSummary = summaryData;
            this.renderKpiSummary(summaryData);
        } catch (error) {
            console.error('Error fetching bean instance summary:', error);
        }
    }

    renderKpiSummary(summaryData) {
        this.kpiWidget.render(summaryData);
    }

    async fetchInstanceData(append = false) {
        if (!append) {
            this.renderLoadingState();
        }

        try {
            const responseData = await this.service.fetchInstanceData({
                pageNumber: this.currentPage - 1,
                pageSize: this.pageSize,
                search: this.searchQuery,
                sortBy: this.sortBy,
                sortDir: this.sortDir
            });

            this.processPaginatedResponse(responseData, append);
            this.computeInstanceMetrics();
            this.applyLocalFilters();
            this._populateContextDropdown();
            this.renderCurrentView();
        } catch (error) {
            console.error('Error fetching bean instance data:', error);
            this.renderErrorState(error.message || 'Unknown network error');
        }
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

    formatDuration(nanos) {
        return Formatter.formatDuration(nanos);
    }

    getDurationColor(initDurationNanos, maxDurationNanos = 0) {
        return BeanMetadataRules.resolveDurationColor(initDurationNanos, maxDurationNanos, this.bottleneckThresholdNanos);
    }

    getBeanLayer(bean) {
        return BeanMetadataRules.resolveBeanLayer(bean);
    }

    computeInstanceMetrics() {
        if (!this.instances || this.instances.length === 0) {
            this.maxTimeMs = 10;
            this.maxDurationNanos = 0;
            return;
        }

        let maxDurationNanos = 0;

        this.instances.forEach(inst => {
            const nanos = inst.initDurationNanos || 0;
            const initDurationMs = nanos / 1e6;

            inst.initDurationMs = initDurationMs;
            inst.relativeStartMs = 0;
            inst.relativeEndMs = initDurationMs;
            inst.layer = this.getBeanLayer(inst);

            if (nanos > maxDurationNanos) {
                maxDurationNanos = nanos;
            }
        });

        this.maxDurationNanos = maxDurationNanos;
        const maxDurationMs = maxDurationNanos / 1e6;
        this.maxTimeMs = maxDurationMs > 0 ? (maxDurationMs * 1.08) : 10;
    }

    applyLocalFilters() {
        let result = [...this.instances];

        if (this.quickFilter === 'bottlenecks') {
            result = result.filter(inst => {
                const dur = this.getDurationColor(inst.initDurationNanos, this.maxDurationNanos);
                return dur.isBottleneck || dur.tier === 'bottleneck';
            });
        } else if (this.quickFilter === 'slow') {
            result = result.filter(inst => {
                const dur = this.getDurationColor(inst.initDurationNanos, this.maxDurationNanos);
                return dur.tier === 'high' || dur.tier === 'medium' || dur.tier === 'heavy' || dur.tier === 'slow' || dur.tier === 'elevated' || dur.tier === 'notable';
            });
        } else if (this.quickFilter === 'fast') {
            result = result.filter(inst => {
                const dur = this.getDurationColor(inst.initDurationNanos, this.maxDurationNanos);
                return dur.tier === 'submicro' || dur.tier === 'ultrafast' || dur.tier === 'optimal' || dur.tier === 'fast' || dur.tier === 'moderate';
            });
        }

        if (this.minDurationMs > 0) {
            result = result.filter(inst => (inst.initDurationMs || 0) >= this.minDurationMs);
        }

        this.filteredInstances = result;
        $('#time-visible-count-badge').text(this.filteredInstances.length.toLocaleString());
    }

    renderCurrentView() {
        if (this.activeView === 'instance') {
            $('#instance-gantt-card').removeClass('hidden');
            $('#instance-table-card').addClass('hidden');
            this.renderGanttView();
        } else {
            $('#instance-gantt-card').addClass('hidden');
            $('#instance-table-card').removeClass('hidden');
            this.renderTableRows();
            this.renderPagination();
        }
    }

    renderGanttView() {
        this.renderTimeRulerAndGrid();
        this.renderGanttRows();
        this.renderLoadMore();
    }

    renderTimeRulerAndGrid() {
        this.waterfallWidget.renderTimeRulerAndGrid(this.maxTimeMs);
    }

    renderGanttRows() {
        this.waterfallWidget.renderGanttRows(
            this.filteredInstances,
            this.selectedGanttBeanName,
            this.selectedGanttContextId,
            this.maxDurationNanos,
            this.maxTimeMs,
            this.bottleneckThresholdNanos
        );
    }

    renderLoadMore() {
        this.waterfallWidget.renderLoadMore(
            this.paginationState,
            this.instances.length,
            this.maxTimeMs
        );
    }

    renderTableRows() {
        this.tableWidget.renderTableRows(
            this.filteredInstances,
            this.selectedTableBeanName,
            this.selectedTableContextId,
            this.maxDurationNanos,
            this.bottleneckThresholdNanos
        );
    }

    renderPagination() {
        this.tableWidget.renderPagination(this.paginationState);
    }

    renderLoadingState() {
        if (this.activeView === 'instance') {
            this.waterfallWidget.renderLoadingState();
        } else {
            this.tableWidget.renderLoadingState();
        }
    }

    renderErrorState(errorMessage) {
        if (this.activeView === 'instance') {
            this.waterfallWidget.renderErrorState(errorMessage);
        } else {
            this.tableWidget.renderErrorState(errorMessage);
        }
    }

    // --- Bean Selection & Detail Flyout ---

    async selectBean(contextId, beanName) {
        if (this.activeView === 'table') {
            return this.selectTableBean(contextId, beanName);
        }
        return this.selectGanttBean(contextId, beanName);
    }

    async selectGanttBean(contextId, beanName) {
        if (!contextId || !beanName) return;

        this.selectedGanttContextId = contextId;
        this.selectedGanttBeanName = beanName;

        $('.waterfall-row').removeClass('gantt-row-selected');
        $(`.waterfall-row[data-context-id="${contextId}"][data-bean-name="${beanName}"]`).addClass('gantt-row-selected');

        await this._loadBeanDetailsAndProxy(contextId, beanName, 'instance');
    }

    async selectTableBean(contextId, beanName) {
        if (!contextId || !beanName) return;

        this.selectedTableContextId = contextId;
        this.selectedTableBeanName = beanName;

        $('.instance-table-row, .instance-row').removeClass('instance-row-selected font-semibold bg-primary/10 dark:bg-purple-950/30 border-l-4 border-primary');
        $(`.instance-table-row[data-context-id="${contextId}"][data-bean-name="${beanName}"], .instance-row[data-context-id="${contextId}"][data-bean-name="${beanName}"]`).addClass('instance-row-selected font-semibold');

        await this._loadBeanDetailsAndProxy(contextId, beanName, 'table');
    }

    async _loadBeanDetailsAndProxy(contextId, beanName, viewType) {
        const localInstance = this.instances.find(i => i.contextId === contextId && i.beanName === beanName);
        if (localInstance && this.activeView === viewType) {
            this.renderSidebarDetails(localInstance);
        }

        const isStillSelected = () => {
            if (viewType === 'table') {
                return this.selectedTableContextId === contextId && this.selectedTableBeanName === beanName;
            }
            return this.selectedGanttContextId === contextId && this.selectedGanttBeanName === beanName;
        };

        const fetchDetailsPromise = (async () => {
            try {
                const instanceDetails = await this.service.findBeanInstance(contextId, beanName);

                if (isStillSelected()) {
                    if (viewType === 'table') {
                        this.selectedTableInstance = instanceDetails;
                    } else {
                        this.selectedGanttInstance = instanceDetails;
                    }
                    if (this.activeView === viewType) {
                        this.renderSidebarDetails(instanceDetails);
                    }
                }
            } catch (error) {
                console.warn('Could not fetch single bean instance details:', error);
                if (isStillSelected() && this.activeView === viewType) {
                    const fallback = this.instances.find(i => i.contextId === contextId && i.beanName === beanName);
                    if (fallback) this.renderSidebarDetails(fallback);
                }
            }
        })();

        const fetchProxyPromise = (async () => {
            if (this.activeView === viewType) {
                await this.fetchProxyInfo(contextId, beanName);
            }
        })();

        await Promise.allSettled([fetchDetailsPromise, fetchProxyPromise]);
    }

    async fetchProxyInfo(contextId, beanName) {
        this.sidebarWidget.setProxyLoading(true);

        try {
            const proxyInfo = await this.service.fetchProxyInfo(contextId, beanName);
            if (proxyInfo) {
                this.renderProxyInfo(proxyInfo);
            } else {
                this.renderProxyEmptyState();
            }
        } catch (error) {
            console.warn('Failed to fetch or render proxy info:', error);
            this.renderProxyEmptyState();
        } finally {
            this.sidebarWidget.setProxyLoading(false);
        }
    }

    renderProxyInfo(proxyInfo) {
        this.sidebarWidget.renderProxyInfo(proxyInfo);
    }

    renderProxyEmptyState() {
        this.sidebarWidget.renderProxyEmptyState();
    }

    switchSidebarTab(tabName) {
        this.sidebarWidget.switchTab(tabName);
    }

    renderSidebarDetails(instance) {
        this.sidebarWidget.renderSidebarDetails(instance, this.maxDurationNanos, this.bottleneckThresholdNanos);
    }

    // --- UI Controls & Event Initialization ---

    initEvents() {
        this._initActionHandlers();
        this._bindSearchInput();
        this._bindFilterChangeEvents();
        this._bindSortHeaders();
        this._bindZoomEvents();
        this.waterfallWidget.bindScrubberEvents(() => this.maxTimeMs);
        this._bindClickActionDelegation();
        this._syncBottleneckDropdown();
        this.waterfallWidget.updateBottleneckUI(this.bottleneckThresholdNanos);
    }

    _initActionHandlers() {
        this._clickActions = {
            'refresh-data': ($target) => this._handleRefreshData($target),
            'reset-filters': () => {
                this._resetFilterState(true);
                this.tableWidget.updateSortHeaderIcons(this.sortBy, this.sortDir);
                return this.fetchInstanceData();
            },
            'select-bean': ($target) => this._handleSelectGanttBean($target),
            'select-instance': ($target) => this._handleSelectTableBean($target),
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
            'focus-slowest': () => this._handleFocusSlowest(),
            'switch-sidebar-tab': ($target) => {
                const tab = $target.data('tab') || $target.closest('[data-tab]').data('tab');
                this.switchSidebarTab(tab);
            }
        };

        this._filterChangeActions = {
            'time-filter-duration': (val) => this._handleSortFilter('initDurationNanos', val),
            'time-filter-created': (val) => this._handleSortFilter('createdAt', val),
            'time-filter-size': (val) => {
                this.pageSize = parseInt(val, 10) || 20;
                return this._resetPageAndFetch();
            },
            'time-filter-bottleneck': (val) => this._handleBottleneckThresholdChange(val)
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
        this.quickFilter = $target.data('filter') || 'all';

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
            if (this.activeView === 'table') {
                this.selectTableBean(contextId, beanName);
                const $targetRow = $(`.instance-table-row[data-bean-name="${beanName}"], .instance-row[data-bean-name="${beanName}"]`);
                if ($targetRow.length) {
                    $targetRow[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            } else {
                this.selectGanttBean(contextId, beanName);
                const $targetRow = $(`.waterfall-row[data-bean-name="${beanName}"]`);
                if ($targetRow.length) {
                    $targetRow[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
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

    _handleSortFilter(field, dir) {
        if (dir) {
            this.sortBy = field;
            this.sortDir = dir;
        } else {
            this.sortBy = 'createdAt';
            this.sortDir = 'ASC';
        }
        this._syncSortDropdowns();
        this.tableWidget.updateSortHeaderIcons(this.sortBy, this.sortDir);
        return this._resetPageAndFetch();
    }

    _syncSortDropdowns() {
        $('#time-filter-duration').val(this.sortBy === 'initDurationNanos' ? this.sortDir : '');
        $('#time-filter-created').val(this.sortBy === 'createdAt' ? this.sortDir : '');

        if (this.sortBy === 'initDurationNanos') {
            $('#time-sort-label').text('Duration');
            $('#time-sort-icon').text(this.sortDir === 'ASC' ? 'arrow_upward' : 'arrow_downward');
        } else {
            $('#time-sort-label').text('Order');
            $('#time-sort-icon').text('swap_vert');
        }
    }

    _handleBottleneckThresholdChange(val) {
        if (val === 'custom') {
            const currentFormatted = Formatter.formatDuration(this.bottleneckThresholdNanos);
            const input = prompt('Enter custom bottleneck threshold (e.g. "750µs", "2.5ms", "1000000ns", or number in µs):', currentFormatted);
            if (!input) {
                this._syncBottleneckDropdown();
                return;
            }

            const parsedNanos = this._parseDurationToNanos(input);
            if (!parsedNanos || parsedNanos <= 0) {
                alert('Invalid duration value. Please enter a duration like "800µs" or "3ms".');
                this._syncBottleneckDropdown();
                return;
            }

            this.bottleneckThresholdNanos = parsedNanos;
        } else {
            const nanos = parseInt(val, 10);
            if (Number.isFinite(nanos) && nanos > 0) {
                this.bottleneckThresholdNanos = nanos;
            }
        }

        localStorage.setItem('sl-bottleneck-threshold-nanos', this.bottleneckThresholdNanos);
        this._syncBottleneckDropdown();
        this.waterfallWidget.updateBottleneckUI(this.bottleneckThresholdNanos);
        this.applyLocalFilters();
        this.renderCurrentView();

        if (this.selectedBeanName) {
            const selectedInst = this.instances?.find(i => i.beanName === this.selectedBeanName && (!this.selectedContextId || i.contextId === this.selectedContextId));
            if (selectedInst) {
                this.renderSidebarDetails(selectedInst);
            }
        }
    }

    _parseDurationToNanos(str) {
        if (!str) return null;
        const trimmed = String(str).trim().toLowerCase().replace(/\s+/g, '');
        if (/^\d+(\.\d+)?$/.test(trimmed)) {
            const num = parseFloat(trimmed);
            return num < 10000 ? Math.round(num * 1000) : Math.round(num);
        }
        if (trimmed.endsWith('ns')) {
            return Math.round(parseFloat(trimmed));
        }
        if (trimmed.endsWith('us') || trimmed.endsWith('µs')) {
            return Math.round(parseFloat(trimmed) * 1000);
        }
        if (trimmed.endsWith('ms')) {
            return Math.round(parseFloat(trimmed) * 1e6);
        }
        if (trimmed.endsWith('s')) {
            return Math.round(parseFloat(trimmed) * 1e9);
        }
        return null;
    }

    _syncBottleneckDropdown() {
        const val = String(this.bottleneckThresholdNanos);
        const $select = $('#time-filter-bottleneck');
        if ($select.length === 0) return;

        let $opt = $select.find(`option[value="${val}"]`);
        if ($opt.length > 0) {
            $select.val(val);
        } else {
            let $customOpt = $select.find('option[data-custom="true"]');
            if ($customOpt.length === 0) {
                $customOpt = $('<option data-custom="true"></option>').insertBefore($select.find('option[value="custom"]'));
            }
            $customOpt.val(val).text(`Bottleneck: > ${Formatter.formatDuration(this.bottleneckThresholdNanos)} (Custom)`).prop('selected', true);
            $select.val(val);
        }
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

            this._syncSortDropdowns();
            this.tableWidget.updateSortHeaderIcons(this.sortBy, this.sortDir);
            this.currentPage = 1;
            this.fetchInstanceData();
        });
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
        this.waterfallWidget.setZoom(level, this.maxTimeMs, updateSlider);
    }

    _bindClickActionDelegation() {
        this._on(document, 'click', '[data-action]', (e) => {
            const $target = $(e.currentTarget);
            const action = $target.data('action') || $target.attr('data-action');
            const handler = this._clickActions[action];

            if (handler) {
                if ($target.is('a') && $target.attr('href') && !$target.attr('href').startsWith('javascript:')) {
                    // Normal link navigation
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

    clearSelection() {
        this.selectedGanttBeanName = null;
        this.selectedGanttContextId = null;
        this.selectedGanttInstance = null;

        this.selectedTableBeanName = null;
        this.selectedTableContextId = null;
        this.selectedTableInstance = null;

        $('.waterfall-row').removeClass('gantt-row-selected');
        $('.instance-table-row, .instance-row').removeClass('instance-row-selected font-semibold bg-primary/10 dark:bg-purple-950/30 border-l-4 border-primary');
        this.sidebarWidget.closeSidebar();
    }

    _handleSwitchView($target) {
        const view = $target.data('view') || 'instance';
        if (this.activeView === view) return;
        this.activeView = view;

        this.clearSelection();

        if (view === 'instance') {
            $('#time-view-btn-instance')
                .addClass('bg-white dark:bg-slate-800 text-primary dark:text-purple-300 font-bold shadow-xs')
                .removeClass('text-gray-500 dark:text-gray-400 font-medium');
            $('#time-view-btn-table')
                .removeClass('bg-white dark:bg-slate-800 text-primary dark:text-purple-300 font-bold shadow-xs')
                .addClass('text-gray-500 dark:text-gray-400 font-medium');
        } else {
            $('#time-view-btn-table')
                .addClass('bg-white dark:bg-slate-800 text-primary dark:text-purple-300 font-bold shadow-xs')
                .removeClass('text-gray-500 dark:text-gray-400 font-medium');
            $('#time-view-btn-instance')
                .removeClass('bg-white dark:bg-slate-800 text-primary dark:text-purple-300 font-bold shadow-xs')
                .addClass('text-gray-500 dark:text-gray-400 font-medium');
        }

        this.renderCurrentView();
    }

    _handleToggleSort() {
        if (this.sortBy === 'createdAt') {
            this.sortBy = 'initDurationNanos';
            this.sortDir = 'DESC';
        } else {
            this.sortBy = 'createdAt';
            this.sortDir = 'ASC';
        }

        this._syncSortDropdowns();
        this.tableWidget.updateSortHeaderIcons(this.sortBy, this.sortDir);
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

    async _handleSelectGanttBean($target) {
        const $row = $target.closest('[data-bean-name]');
        const beanName = $row.data('bean-name') || $row.attr('data-bean-name');
        const contextId = $row.data('context-id') || $row.attr('data-context-id');

        if (beanName) {
            await this.selectGanttBean(contextId, beanName);
        }
    }

    async _handleSelectTableBean($target) {
        const $row = $target.closest('[data-bean-name]');
        const beanName = $row.data('bean-name') || $row.attr('data-bean-name');
        const contextId = $row.data('context-id') || $row.attr('data-context-id');

        if (beanName) {
            await this.selectTableBean(contextId, beanName);
        }
    }

    async _handleSelectBean($target) {
        if (this.activeView === 'table') {
            return this._handleSelectTableBean($target);
        }
        return this._handleSelectGanttBean($target);
    }

    _handleChangePage($target) {
        const targetPage = parseInt($target.data('page'), 10);
        if (!Number.isNaN(targetPage) && targetPage !== this.currentPage) {
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
        if (this.activeView === 'table') {
            this.selectedTableBeanName = null;
            this.selectedTableContextId = null;
            this.selectedTableInstance = null;
            $('.instance-table-row, .instance-row').removeClass('instance-row-selected font-semibold bg-primary/10 dark:bg-purple-950/30 border-l-4 border-primary');
        } else {
            this.selectedGanttBeanName = null;
            this.selectedGanttContextId = null;
            this.selectedGanttInstance = null;
            $('.waterfall-row').removeClass('gantt-row-selected');
        }

        this.sidebarWidget.closeSidebar();
    }

    _resetPageAndFetch() {
        this.currentPage = 1;
        return this.fetchInstanceData();
    }

    _resetFilterState(preserveView = false) {
        const targetView = preserveView ? this.activeView : 'instance';

        Object.assign(this, {
            searchQuery: '',
            minDurationMs: 0,
            quickFilter: 'all',
            pageSize: 20,
            currentPage: 1,
            sortBy: 'createdAt',
            sortDir: 'ASC',
            activeView: targetView,
            selectedGanttBeanName: null,
            selectedGanttContextId: null,
            selectedGanttInstance: null,
            selectedTableBeanName: null,
            selectedTableContextId: null,
            selectedTableInstance: null
        });

        this.waterfallWidget.zoomLevel = 1;

        $('.waterfall-row').removeClass('gantt-row-selected');
        $('.instance-table-row, .instance-row').removeClass('instance-row-selected font-semibold bg-primary/10 dark:bg-purple-950/30 border-l-4 border-primary');

        this.sidebarWidget.closeSidebar();

        const defaults = {
            '#time-search-input': '',
            '#inst-search-input': '',
            '#time-filter-created': 'ASC',
            '#time-filter-duration': '',
            '#time-filter-size': '20',
            '#time-zoom-slider': '1'
        };

        Object.entries(defaults).forEach(([selector, val]) => $(selector).val(val));
        $('#time-search-clear').addClass('hidden');
        $('#time-sort-label').text('Order');
        $('#time-sort-icon').text('swap_vert');
        $('#time-zoom-level-badge').text('100%');
        this._syncBottleneckDropdown();
        this.waterfallWidget.updateBottleneckUI(this.bottleneckThresholdNanos);

        if (!preserveView) {
            $('#time-view-btn-instance')
                .addClass('bg-white dark:bg-slate-800 text-primary dark:text-purple-300 font-bold shadow-xs')
                .removeClass('text-gray-500 dark:text-gray-400 font-medium');
            $('#time-view-btn-table')
                .removeClass('bg-white dark:bg-slate-800 text-primary dark:text-purple-300 font-bold shadow-xs')
                .addClass('text-gray-500 dark:text-gray-400 font-medium');
            $('#instance-gantt-card').removeClass('hidden');
            $('#instance-table-card').addClass('hidden');
        }

        $('.time-quick-filter-btn')
            .removeClass('bg-white dark:bg-slate-800 text-primary dark:text-purple-300 font-bold shadow-xs')
            .addClass('text-gray-600 dark:text-gray-400 font-semibold');
        $('.time-quick-filter-btn[data-filter="all"]')
            .addClass('bg-white dark:bg-slate-800 text-primary dark:text-purple-300 font-bold shadow-xs')
            .removeClass('text-gray-600 dark:text-gray-400 font-semibold');
    }

    _downloadReport() {
        const reportData = {
            appName: 'Spring Lens',
            reportType: 'Bean Instances Telemetry',
            timestamp: new Date().toISOString(),
            bottleneckThreshold: Formatter.formatDuration(this.bottleneckThresholdNanos),
            bottleneckThresholdNanos: this.bottleneckThresholdNanos,
            summary: this.instanceSummary,
            totalElements: this.paginationState.totalElements,
            instances: this.instances
        };

        this.service.downloadReport(`spring-lens-instance-${Date.now()}.json`, reportData);
    }

    /**
     * Helper for namespaced event binding, integrated with BaseController.
     * @private
     */
    _on(target, event, delegateOrHandler, maybeHandler) {
        this.on(target, event, delegateOrHandler, maybeHandler);
    }

    leave() {
        this._handleCloseSidebar(true);
        this._resetFilterState();
        this.clearSelection();
        super.leave();
    }
}

export default InstanceController;
