import BaseController from '../base-controller.js';
import {
    instanceKpiWidget,
    instanceTableWidget,
    instanceWaterfallWidget,
    instanceSidebarWidget,
    beanDataStore,
    AsyncUtils,
    Formatter,
    QueryParam,
    BeanMetadataRules,
    Pagination
} from './index.js';
import container from '../../core/container.js';

export class InstanceController extends BaseController {
    constructor() {
        super('instances');

        this.service = container.make('instanceService');
        this.applicationState = container.make('applicationState');
        this.kpiWidget = instanceKpiWidget;
        this.tableWidget = instanceTableWidget;
        this.waterfallWidget = instanceWaterfallWidget;
        this.sidebarWidget = instanceSidebarWidget;

        const savedThreshold = parseInt(localStorage.getItem('sl-bottleneck-threshold-nanos'), 10);
        const bottleneckThreshold = Number.isFinite(savedThreshold) && savedThreshold > 0 ? savedThreshold : 500000;

        this.state = {
            appName: this.applicationState?.getAppName?.() || 'SpringLens',
            kpi: this.kpiWidget.formatSummary(null),
            summaryLoading: true,

            searchQuery: '',
            sortCreated: 'ASC',
            sortDuration: '',
            sortBy: 'createdAt',
            sortDir: 'ASC',
            bottleneckThresholdNanos: bottleneckThreshold,
            pageSize: 20,
            currentPage: 1,
            activeView: 'instance',
            zoomLevel: 1,

            ganttRows: [],
            tableRows: [],
            rulerTicks: [],
            visibleCount: 0,
            maxTimeMs: 10,
            maxDurationNanos: 0,

            pagination: Pagination.defaultState(20),
            paginationInfo: Pagination.formatInfoText(0, 0, 20, 'instances'),
            pageButtons: [],
            hasMoreGantt: false,
            loadMoreText: '+ 0 more beans',
            loadedSummaryText: 'Showing beans in chronological sequence',

            loading: false,
            error: null,
            refreshing: false,

            selectedBeanName: null,
            selectedContextId: null,
            selectedInstance: null,
            sidebarDetails: null,
            sidebarOpen: false,
            sidebarTab: 'telemetry',
            proxyLoading: false,
            proxyInfo: null,
            scrubber: {
                left: 0,
                badgeTop: 0,
                formattedTime: '+0.00ms',
                visible: false
            }
        };

        this.instances = [];
        this.instanceSummary = null;

        for (const key of Object.keys(this.state)) {
            Object.defineProperty(this, key, {
                get: () => (this.alpine ? this.alpine[key] : this.state[key]),
                set: (value) => this.setState({ [key]: value }),
                configurable: true,
                enumerable: true
            });
        }

        this._debouncedSearch = AsyncUtils.debounce(() => this._resetPageAndFetch(), 250);
        this.addDisposable(this._debouncedSearch);
    }

    setState(patch) {
        if (!patch) return;
        Object.assign(this.state, patch);
        if (this.alpine) {
            Object.assign(this.alpine, patch);
        }
    }

    createAlpineState() {
        return {
            ...this.state,
            onSearchInput: (event) => this.onSearchInput(event),
            clearSearch: () => this.clearSearch(),
            onSortCreatedChange: (event) => this.onSortCreatedChange(event),
            onSortDurationChange: (event) => this.onSortDurationChange(event),
            onBottleneckThresholdChange: (event) => this.onBottleneckThresholdChange(event),
            onPageSizeChange: (event) => this.onPageSizeChange(event),
            resetFilters: () => this.resetFilters(),
            switchView: (view) => this.switchView(view),
            toggleSort: () => this.toggleSort(),
            setZoom: (level) => this.setZoom(level),
            zoomIn: () => this.zoomIn(),
            zoomOut: () => this.zoomOut(),
            zoomReset: () => this.zoomReset(),
            onZoomSliderInput: (event) => this.onZoomSliderInput(event),
            onScrubberMouseMove: (event) => this.onScrubberMouseMove(event),
            onScrubberMouseLeave: () => this.onScrubberMouseLeave(),
            loadMore: () => this.loadMore(),
            sort: (column) => this.sort(column),
            getSortIcon: (column) => this.getSortIcon(column),
            prevPage: () => this.prevPage(),
            nextPage: () => this.nextPage(),
            goToPage: (page) => this.goToPage(page),
            selectBean: (beanName, contextId) => this.selectBean(beanName, contextId),
            closeSidebar: () => this.closeSidebar(),
            switchSidebarTab: (tab) => this.switchSidebarTab(tab),
            focusSlowest: () => this.focusSlowest(),
            refreshData: () => this.refreshData(),
            downloadReport: () => this.downloadReport()
        };
    }

    async enter(params) {
        try {
            this._resetFilterState();
            this.closeSidebar();

            const queryParams = QueryParam.parse(params);
            const targetBean = QueryParam.get(queryParams, 'search', 'bean');
            const targetContextId = QueryParam.get(queryParams, 'contextId', 'context');

            if (targetBean) {
                this.searchQuery = targetBean;
            }

            this.on(document, 'keydown', (e) => {
                if (e.key === 'Escape') {
                    this.closeSidebar();
                }
            });

            await Promise.all([
                this.fetchSummaryData(),
                this.fetchInstanceData()
            ]);

            if (targetBean && this.instances && this.instances.length > 0) {
                const match = this.instances.find(i => i.beanName === targetBean) || this.instances[0];
                if (match) {
                    await this.selectBean(match.beanName, targetContextId || match.contextId);
                }
            }
        } catch (error) {
            console.error('Error in Instance enter:', error);
        }
    }

    async fetchSummaryData() {
        this.setState({ summaryLoading: true });
        try {
            const summaryData = await this.service.fetchSummaryData();
            this.instanceSummary = summaryData;
            this.setState({
                kpi: this.kpiWidget.formatSummary(summaryData),
                summaryLoading: false
            });
        } catch (error) {
            console.error('Error fetching bean instance summary:', error);
            this.setState({ summaryLoading: false });
        }
    }

    async fetchInstanceData(append = false) {
        if (!append) {
            this.setState({ loading: true, error: null });
        }

        try {
            const responseData = await this.service.fetchInstanceData({
                pageNumber: this.currentPage - 1,
                pageSize: this.pageSize,
                search: this.searchQuery,
                sortBy: this.sortBy,
                sortDir: this.sortDir
            });

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

            const paginationState = {
                totalElements,
                totalPages,
                pageNumber,
                pageSize,
                isFirstPage: responseData?.first ?? (pageNumber === 0),
                isLastPage: responseData?.last ?? (pageNumber >= totalPages - 1)
            };

            this.computeInstanceMetrics();

            this.setState({
                pagination: paginationState,
                loading: false,
                error: null
            });

            this.updatePresentationModels();
        } catch (error) {
            console.error('Error fetching bean instance data:', error);
            this.setState({
                loading: false,
                error: error.message || 'Unknown network error'
            });
        }
    }

    computeInstanceMetrics() {
        if (!this.instances || this.instances.length === 0) {
            this.setState({
                maxTimeMs: 10,
                maxDurationNanos: 0
            });
            return;
        }

        let maxNanos = 0;
        this.instances.forEach(inst => {
            const nanos = inst.initDurationNanos || 0;
            inst.initDurationMs = nanos / 1e6;
            inst.layer = BeanMetadataRules.resolveBeanLayer(inst);
            if (nanos > maxNanos) {
                maxNanos = nanos;
            }
        });

        const maxDurationMs = maxNanos / 1e6;
        const maxTimeMs = maxDurationMs > 0 ? (maxDurationMs * 1.08) : 10;

        this.setState({
            maxDurationNanos: maxNanos,
            maxTimeMs
        });
    }

    updatePresentationModels() {
        const {
            selectedBeanName,
            selectedContextId,
            maxDurationNanos,
            maxTimeMs,
            bottleneckThresholdNanos,
            pagination
        } = this.state;

        const ganttRows = this.waterfallWidget.formatGanttRows(
            this.instances,
            selectedBeanName,
            selectedContextId,
            maxDurationNanos,
            maxTimeMs,
            bottleneckThresholdNanos
        );

        const tableRows = this.tableWidget.formatTableRows(
            this.instances,
            selectedBeanName,
            selectedContextId,
            maxDurationNanos,
            bottleneckThresholdNanos
        );

        const rulerTicks = this.waterfallWidget.calculateTicks(maxTimeMs);
        const totalElements = pagination?.totalElements || 0;
        const remaining = Math.max(0, totalElements - this.instances.length);
        const hasMoreGantt = remaining > 0;
        const loadMoreText = hasMoreGantt ? `+ ${remaining.toLocaleString()} more beans` : `All ${totalElements.toLocaleString()} beans loaded`;
        const loadedSummaryText = `Showing ${this.instances.length.toLocaleString()} of ${totalElements.toLocaleString()} instances (max latency ${Formatter.formatDuration((maxTimeMs || 0) * 1e6)})`;
        const paginationInfo = Pagination.formatInfoText(totalElements, pagination.pageNumber, pagination.pageSize, 'instances');
        const pageButtons = Pagination.getButtons(pagination);

        this.setState({
            ganttRows,
            tableRows,
            rulerTicks,
            visibleCount: this.instances.length,
            hasMoreGantt,
            loadMoreText,
            loadedSummaryText,
            paginationInfo,
            pageButtons
        });

        if (this.selectedBeanName && this.sidebarOpen) {
            const currentInst = this.instances.find(i => i.beanName === this.selectedBeanName && (!this.selectedContextId || i.contextId === this.selectedContextId));
            if (currentInst) {
                this.setState({
                    sidebarDetails: this.sidebarWidget.formatDetails(currentInst, maxDurationNanos, bottleneckThresholdNanos)
                });
            }
        }
    }

    onSearchInput(event) {
        this.searchQuery = (event.target.value || '').trim();
        this._debouncedSearch();
    }

    clearSearch() {
        this._debouncedSearch.cancel();
        this.searchQuery = '';
        this._resetPageAndFetch();
    }

    onSortCreatedChange(event) {
        const val = event.target.value;
        if (val) {
            this.sortBy = 'createdAt';
            this.sortDir = val;
            this.sortCreated = val;
            this.sortDuration = '';
        } else {
            this.sortBy = 'createdAt';
            this.sortDir = 'ASC';
            this.sortCreated = '';
            this.sortDuration = '';
        }
        this._resetPageAndFetch();
    }

    onSortDurationChange(event) {
        const val = event.target.value;
        if (val) {
            this.sortBy = 'initDurationNanos';
            this.sortDir = val;
            this.sortDuration = val;
            this.sortCreated = '';
        } else {
            this.sortBy = 'createdAt';
            this.sortDir = 'ASC';
            this.sortDuration = '';
            this.sortCreated = 'ASC';
        }
        this._resetPageAndFetch();
    }

    onBottleneckThresholdChange(event) {
        const val = event.target.value;
        if (val === 'custom') {
            const currentFormatted = Formatter.formatDuration(this.bottleneckThresholdNanos);
            const input = prompt('Enter custom bottleneck threshold (e.g. "750µs", "2.5ms", "1000000ns", or number in µs):', currentFormatted);
            if (!input) {
                event.target.value = String(this.bottleneckThresholdNanos);
                return;
            }

            const parsedNanos = this._parseDurationToNanos(input);
            if (!parsedNanos || parsedNanos <= 0) {
                alert('Invalid duration value. Please enter a duration like "800µs" or "3ms".');
                event.target.value = String(this.bottleneckThresholdNanos);
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
        this.updatePresentationModels();
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

    onPageSizeChange(event) {
        this.pageSize = parseInt(event.target.value, 10) || 20;
        this.currentPage = 1;
        this._resetPageAndFetch();
    }

    resetFilters() {
        this._resetFilterState();
        return this.fetchInstanceData();
    }

    _resetFilterState() {
        const savedThreshold = parseInt(localStorage.getItem('sl-bottleneck-threshold-nanos'), 10);
        const bottleneckThreshold = Number.isFinite(savedThreshold) && savedThreshold > 0 ? savedThreshold : 500000;

        this.setState({
            searchQuery: '',
            sortCreated: 'ASC',
            sortDuration: '',
            sortBy: 'createdAt',
            sortDir: 'ASC',
            bottleneckThresholdNanos: bottleneckThreshold,
            pageSize: 20,
            currentPage: 1,
            zoomLevel: 1
        });
    }

    _resetPageAndFetch() {
        this.currentPage = 1;
        return this.fetchInstanceData();
    }

    switchView(view) {
        if (this.activeView === view) return;
        this.setState({ activeView: view });
        this.closeSidebar();
    }

    toggleSort() {
        if (this.sortBy === 'createdAt') {
            this.sortBy = 'initDurationNanos';
            this.sortDir = 'DESC';
            this.sortDuration = 'DESC';
            this.sortCreated = '';
        } else {
            this.sortBy = 'createdAt';
            this.sortDir = 'ASC';
            this.sortCreated = 'ASC';
            this.sortDuration = '';
        }
        this._resetPageAndFetch();
    }

    setZoom(level) {
        const zoomLevel = Math.max(1, Math.min(4, level));
        this.setState({ zoomLevel });
    }

    zoomIn() {
        this.setZoom(this.zoomLevel + 0.5);
    }

    zoomOut() {
        this.setZoom(this.zoomLevel - 0.5);
    }

    zoomReset() {
        this.setZoom(1);
    }

    onZoomSliderInput(event) {
        this.setZoom(parseFloat(event.target.value) || 1);
    }

    onScrubberMouseMove(event) {
        const innerEl = document.getElementById('instance-inner-container');
        const scrollContainerEl = document.getElementById('instance-scroll-container');
        if (!innerEl || !scrollContainerEl) return;

        const result = this.waterfallWidget.calculateScrubber(event.pageX, innerEl, scrollContainerEl, this.maxTimeMs);
        if (result) {
            this.setState({ scrubber: result });
        }
    }

    onScrubberMouseLeave() {
        this.setState({
            scrubber: {
                ...this.state.scrubber,
                visible: false
            }
        });
    }

    async loadMore() {
        if (this.currentPage < this.pagination.totalPages) {
            this.currentPage++;
            await this.fetchInstanceData(true);
        }
    }

    sort(column) {
        if (!column) return;
        if (this.sortBy === column) {
            this.sortDir = this.sortDir === 'ASC' ? 'DESC' : 'ASC';
        } else {
            this.sortBy = column;
            this.sortDir = 'ASC';
        }

        if (this.sortBy === 'createdAt') {
            this.sortCreated = this.sortDir;
            this.sortDuration = '';
        } else if (this.sortBy === 'initDurationNanos') {
            this.sortDuration = this.sortDir;
            this.sortCreated = '';
        } else {
            this.sortCreated = '';
            this.sortDuration = '';
        }

        this.currentPage = 1;
        this.fetchInstanceData();
    }

    getSortIcon(column) {
        return this.tableWidget.getSortIcon(column, this.sortBy, this.sortDir);
    }

    prevPage() {
        if (!this.pagination.isFirstPage && this.currentPage > 1) {
            this.currentPage--;
            this.fetchInstanceData();
        }
    }

    nextPage() {
        if (!this.pagination.isLastPage && this.currentPage < this.pagination.totalPages) {
            this.currentPage++;
            this.fetchInstanceData();
        }
    }

    goToPage(page) {
        if (!page) return;
        const target = parseInt(page, 10);
        if (!Number.isNaN(target) && target !== this.currentPage && target >= 1 && target <= this.pagination.totalPages) {
            this.currentPage = target;
            this.fetchInstanceData();
        }
    }

    async selectBean(beanName, contextId) {
        if (!beanName) return;

        const resolvedContext = contextId || 'root';
        this.setState({
            selectedBeanName: beanName,
            selectedContextId: resolvedContext,
            sidebarOpen: true,
            sidebarTab: 'telemetry'
        });

        const localInst = this.instances.find(i => i.beanName === beanName && (!contextId || i.contextId === contextId)) || { beanName, contextId: resolvedContext };
        this.setState({
            sidebarDetails: this.sidebarWidget.formatDetails(localInst, this.maxDurationNanos, this.bottleneckThresholdNanos)
        });

        this.updatePresentationModels();

        const isCurrentSelection = () => this.selectedBeanName === beanName && this.selectedContextId === resolvedContext;

        const fetchDetailsPromise = (async () => {
            try {
                const details = await this.service.findBeanInstance(resolvedContext, beanName);
                if (details && isCurrentSelection()) {
                    this.setState({
                        selectedInstance: details,
                        sidebarDetails: this.sidebarWidget.formatDetails(details, this.maxDurationNanos, this.bottleneckThresholdNanos)
                    });
                }
            } catch (err) {
                console.warn('Could not fetch single bean instance details:', err);
            }
        })();

        const fetchProxyPromise = (async () => {
            this.setState({ proxyLoading: true });
            try {
                const proxyInfo = await this.service.fetchProxyInfo(resolvedContext, beanName);
                if (isCurrentSelection()) {
                    this.setState({
                        proxyInfo: this.sidebarWidget.formatProxyInfo(proxyInfo),
                        proxyLoading: false
                    });
                }
            } catch (err) {
                console.warn('Failed to fetch proxy info:', err);
                if (isCurrentSelection()) {
                    this.setState({
                        proxyInfo: this.sidebarWidget.formatProxyInfo(null),
                        proxyLoading: false
                    });
                }
            }
        })();

        await Promise.allSettled([fetchDetailsPromise, fetchProxyPromise]);
    }

    closeSidebar() {
        this.setState({
            selectedBeanName: null,
            selectedContextId: null,
            selectedInstance: null,
            sidebarOpen: false,
            sidebarDetails: null,
            proxyInfo: null,
            proxyLoading: false
        });
        this.updatePresentationModels();
    }

    switchSidebarTab(tab) {
        if (tab) {
            this.setState({ sidebarTab: tab });
        }
    }

    focusSlowest() {
        if (!this.instances || this.instances.length === 0) return;
        const slowest = this.instances.reduce((prev, current) =>
            ((prev?.initDurationNanos || 0) > (current?.initDurationNanos || 0)) ? prev : current
            , null);
        if (slowest) {
            this.selectBean(slowest.beanName, slowest.contextId);
        }
    }

    async refreshData() {
        this.setState({ refreshing: true });
        try {
            await Promise.all([
                this.fetchSummaryData(),
                this.fetchInstanceData()
            ]);
        } catch (err) {
            console.error('Error refreshing bean instances:', err);
        } finally {
            this.setState({ refreshing: false });
        }
    }

    downloadReport() {
        const reportData = {
            appName: 'Spring Lens',
            reportType: 'Bean Instances Telemetry',
            timestamp: new Date().toISOString(),
            bottleneckThreshold: Formatter.formatDuration(this.bottleneckThresholdNanos),
            bottleneckThresholdNanos: this.bottleneckThresholdNanos,
            summary: this.instanceSummary,
            totalElements: this.pagination.totalElements,
            instances: this.instances
        };

        this.service.downloadReport(`spring-lens-instance-${Date.now()}.json`, reportData);
    }

    leave() {
        this.closeSidebar();
        this._resetFilterState();
        super.leave();
    }
}

export default InstanceController;
