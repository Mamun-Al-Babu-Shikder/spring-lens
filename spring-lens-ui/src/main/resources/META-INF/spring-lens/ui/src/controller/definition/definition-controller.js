import BaseController from '../base-controller.js';
import {
    DefinitionService,
    DefinitionChartsWidget,
    DefinitionTableWidget,
    DefinitionSidebarWidget,
    DefinitionGraphModalWidget,
    beanDataStore,
    DomUtils,
    QueryParam,
    ToastNotification,
    AsyncUtils
} from './index.js';

/**
 * Controller Facade for Bean Definitions registry.
 * Orchestrates summary metrics, interactive Chart.js doughnut charts,
 * server-paginated data table, slide-over details panel, and D3 graph modal.
 */
export class DefinitionController extends BaseController {

    /**
     * @param {Object} [endpoints] - API endpoint mappings.
     */
    constructor(endpoints = {}) {
        super('beanDefs');
        this.service = new DefinitionService(endpoints);

        // Sub-widgets
        this.chartsWidget = new DefinitionChartsWidget();
        this.tableWidget = new DefinitionTableWidget();
        this.sidebarWidget = new DefinitionSidebarWidget();
        this.modalWidget = new DefinitionGraphModalWidget({
            findBeanEndpoint: this.beanDefinitionSearchEndpoint,
            onSelectBean: async (beanName) => {
                const success = await this.selectBean(beanName);
                if (success) {
                    await this.openGraphModal();
                } else {
                    ToastNotification.show({
                        title: 'Bean Definition Not Found',
                        message: `Bean definition for <strong class="font-mono text-purple-600 dark:text-purple-400 font-bold">${beanName}</strong> is unavailable or not registered.`,
                        type: 'warning',
                        duration: 4000
                    });
                }
            }
        });

        this.addDisposable(this.chartsWidget);
        this.addDisposable(this.modalWidget);

        this.allBeans = [];
        this.beanDefinitionSummary = null;
        this.currentPageBeans = [];
        this.searchQuery = '';

        // API Pagination Metadata state
        this.paginationState = {
            totalElements: 0,
            totalPages: 1,
            pageNumber: 0,
            pageSize: 20,
            isFirstPage: true,
            isLastPage: true
        };

        this.filterCriteria = {
            contextId: '',
            beanName: '',
            scope: '',
            role: '',
            primary: '',
            lazyInit: ''
        };

        this.currentPage = 1;
        this.itemsPerPage = 20;
        this.sortColumn = '';
        this.sortDirection = 'asc';

        this.selectedBeanId = null;
        this.selectedBeanName = null;
        this.selectedContextId = null;

        this._hasFetchedTableData = false;
        this._debouncedFetchTableData = null;
    }

    /**
     * Initializes the view and fetches initial datasets.
     */
    async enter(params) {
        await super.enter(params);
        try {
            this.initEvents();

            const queryParams = QueryParam.parse(params);
            const targetBean = QueryParam.get(queryParams, 'search', 'bean', 'beanName');
            const targetContextId = QueryParam.get(queryParams, 'contextId', 'context');

            if (targetBean) {
                this.searchQuery = targetBean;
                this.filterCriteria.beanName = targetBean;
                $('#bean-definition-search-input').val(targetBean);
            }

            if (targetContextId) {
                this.filterCriteria.contextId = targetContextId;
            }

            this.tableWidget.renderLoading();

            await Promise.all([
                this.fetchSummaryStatistics(),
                this.fetchTableData()
            ]);

            if (targetBean) {
                setTimeout(async () => {
                    const success = await this.selectBean(targetBean, targetContextId);
                    if (!success) {
                        ToastNotification.show({
                            title: 'Bean Definition',
                            message: `Bean <strong class="font-mono text-purple-600 dark:text-purple-400 font-bold">${targetBean}</strong> definition details could not be found.`,
                            type: 'warning',
                            duration: 4000
                        });
                    }
                }, 150);
            }
        } catch (error) {
            console.error('Error during Definitions enter:', error);
            this.tableWidget.renderError(error.message || 'Failed to initialize view');
        }
    }

    /**
     * Fetches top-level summary metrics and doughnut chart data.
     */
    async fetchSummaryStatistics() {
        try {
            const summary = await this.service.fetchSummary();
            this.beanDefinitionSummary = summary;
            this.chartsWidget.render(summary);
            this.chartsWidget.renderDistributionCharts(summary);
        } catch (error) {
            console.error('Error fetching summary statistics:', error);
            this.chartsWidget.renderSummaryError();
        }
    }

    /**
     * Fetches paginated table rows based on active filters and sorting criteria.
     */
    async fetchTableData() {
        this.tableWidget.renderLoading();

        try {
            const pageNumber = this.currentPage - 1;
            const pageSize = this.itemsPerPage;

            const response = await this.service.fetchTableData({
                pageNumber,
                pageSize,
                sortColumn: this.sortColumn,
                sortDirection: this.sortDirection,
                filterCriteria: this.filterCriteria
            });

            this.currentPageBeans = response?.content ?? (Array.isArray(response) ? response : []);
            beanDataStore.addBeans(this.currentPageBeans);

            this.paginationState = {
                totalElements: response?.totalElements ?? this.currentPageBeans.length,
                totalPages: response?.totalPages ?? 1,
                pageNumber: response?.pageNumber ?? pageNumber,
                pageSize: response?.pageSize ?? pageSize,
                isFirstPage: response?.first ?? (pageNumber === 0),
                isLastPage: response?.last ?? ((pageNumber + 1) >= (response?.totalPages ?? 1))
            };

            this._hasFetchedTableData = true;

            this.tableWidget.render(this.currentPageBeans, {
                selectedBeanId: this.selectedBeanId,
                selectedBeanName: this.selectedBeanName,
                selectedContextId: this.selectedContextId
            });

            this.tableWidget.renderPagination(this.paginationState);
            this.tableWidget.updateSortHeaderIcons(this.sortColumn, this.sortDirection);
        } catch (error) {
            console.error('Error fetching bean definitions table data:', error);
            this.tableWidget.renderError(error.message || 'Error loading bean definitions');
        }
    }

    /**
     * Selects a bean, loads its complete definition details, and opens the sidebar.
     *
     * @param {string} beanName
     * @param {string} [contextId]
     * @returns {Promise<boolean>}
     */
    async selectBean(beanName, contextId) {
        if (!beanName || !contextId) return false;

        this.selectedBeanName = beanName;
        this.selectedContextId = contextId;

        const localMatch = this.currentPageBeans.find(b =>
            b.beanName === beanName && (b.contextId === contextId)
        ) || beanDataStore.findBeanByName(beanName, contextId);

        if (localMatch) {
            this.selectedBeanId = `${localMatch.contextId}:${localMatch.beanName}`;
            this.tableWidget.highlightSelectedRow(this.selectedBeanId, this.selectedBeanName, this.selectedContextId);
            this.openSidebar(localMatch);
        }

        try {
            const freshDetails = await this.service.findBeanDefinition(beanName, contextId);

            if (freshDetails) {
                this.selectedBeanId = `${freshDetails.contextId}:${freshDetails.beanName}`;
                this.selectedBeanName = freshDetails.beanName;
                this.selectedContextId = freshDetails.contextId;

                beanDataStore.addBeans([freshDetails]);

                this.tableWidget.highlightSelectedRow(this.selectedBeanId, this.selectedBeanName);
                this.openSidebar(freshDetails);
                return true;
            }
            return Boolean(localMatch);
        } catch (error) {
            console.warn(`Could not load fresh definition details for ${beanName}:`, error);
            return Boolean(localMatch);
        }
    }

    /**
     * Opens the slide-over details drawer and populates it with bean data.
     * @param {Object} beanDetails
     */
    openSidebar(beanDetails) {
        this.sidebarWidget.open(beanDetails);
    }

    /**
     * Closes the slide-over details drawer.
     * @param {boolean} [immediate=false]
     */
    closeSidebar(immediate = false) {
        this.sidebarWidget.close(immediate);
        this.selectedBeanId = null;
        this.selectedBeanName = null;
        this.selectedContextId = null;
        this.tableWidget.clearSelection();
    }

    /**
     * Opens the D3 dependency tree modal for the currently selected bean.
     */
    async openGraphModal() {
        if (!this.selectedBeanName) return;

        let beanData = this.currentPageBeans.find(b =>
            b.beanName === this.selectedBeanName && (!this.selectedContextId || b.contextId === this.selectedContextId)
        ) || beanDataStore.findBeanByName(this.selectedBeanName, this.selectedContextId);

        if (!beanData) {
            beanData = await this.service.findBeanDefinition(this.selectedBeanName, this.selectedContextId);
        }

        if (beanData) {
            this.modalWidget.open(beanData);
        }
    }

    /**
     * Closes the dependency graph modal.
     */
    closeGraphModal() {
        this.modalWidget.close();
    }

    /**
     * Cleans up resources when navigating away from the view.
     */
    leave() {
        this.chartsWidget.destroyCharts();
        this.closeGraphModal();
        this.closeSidebar(true);
        this._resetFilterState();
        super.leave();
    }

    /**
     * @private
     */
    _resetFilterState() {
        this.searchQuery = '';
        this.filterCriteria = {
            contextId: '',
            scope: '',
            role: '',
            primary: '',
            lazyInit: '',
            beanName: ''
        };
        this.itemsPerPage = 20;
        this.currentPage = 1;
        this.sortColumn = '';
        this.sortDirection = 'asc';

        $('#bean-definition-search-input').val('');
        $('#bean-definition-filter-context').val('');
        $('#bean-definition-filter-scope').val('');
        $('#bean-definition-filter-role').val('');
        $('#bean-definition-filter-primary').val('');
        $('#bean-definition-filter-lazy').val('');
        $('#bean-definition-filter-size').val('20');
    }

    /**
     * Initializes all event listeners and UI observers.
     */
    initEvents() {
        this._bindSearchInput();
        this._bindFilterDropdowns();
        this._bindClickActionDelegation();
        this._bindGlobalKeydown();
        if (typeof this.modalWidget.bindEvents === 'function') {
            this.modalWidget.bindEvents();
        } else if (typeof this.modalWidget.bindControls === 'function') {
            this.modalWidget.bindControls();
        }
    }

    /**
     * @private
     */
    _bindSearchInput() {
        this._debouncedFetchTableData = AsyncUtils.debounce(() => {
            this.currentPage = 1;
            this.fetchTableData();
        }, 220);

        this.addDisposable(this._debouncedFetchTableData);

        this.on('#bean-definition-search-input', 'input', (e) => {
            const val = e.target.value.trim();
            this.searchQuery = val;
            this.filterCriteria.beanName = val;
            this._debouncedFetchTableData();
        });

        this.on('#bean-definition-search-input', 'keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this._debouncedFetchTableData.flush();
            } else if (e.key === 'Escape') {
                this._debouncedFetchTableData.cancel();
                e.target.value = '';
                this.searchQuery = '';
                this.filterCriteria.beanName = '';
                this.currentPage = 1;
                this.fetchTableData();
            }
        });
    }

    /**
     * @private
     */
    _bindFilterDropdowns() {
        this.on('#bean-definition-filter-size', 'change', (e) => {
            this.itemsPerPage = parseInt(e.target.value, 10) || 20;
            this.currentPage = 1;
            this.fetchTableData();
        });

        const filterMappings = {
            '#bean-definition-filter-context': 'contextId',
            '#bean-definition-filter-scope': 'scope',
            '#bean-definition-filter-role': 'role',
            '#bean-definition-filter-primary': 'primary',
            '#bean-definition-filter-lazy': 'lazyInit'
        };

        Object.entries(filterMappings).forEach(([selector, prop]) => {
            this.on(selector, 'change', (e) => {
                this.filterCriteria[prop] = e.target.value;
                this.currentPage = 1;
                this.fetchTableData();
            });
        });
    }

    /**
     * @private
     */
    _bindGlobalKeydown() {
        this.on(document, 'keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.modalWidget.isOpen) {
                    this.closeGraphModal();
                } else if (this.sidebarWidget.isOpen) {
                    this.closeSidebar();
                }
            }
        });
    }

    /**
     * @private
     */
    _bindClickActionDelegation() {
        this._actionHandlers = {
            'prev-page': () => this._handlePrevPage(),
            'next-page': () => this._handleNextPage(),
            'view-graph': () => this._handleViewGraph(),
            'switch-tab': ($target) => this._handleSwitchTab($target),
            'select-bean': ($target) => this._handleSelectBean($target),
            'sort-column': ($target) => this._handleSortColumn($target),
            'export-data': () => this._downloadReport(),
            'change-page': ($target) => this._handleChangePage($target),
            'refresh-data': ($target) => this._handleRefreshData($target),
            'close-sidebar': () => this.closeSidebar(),
            'reset-filters': () => this._handleResetFilters(),
            'close-graph-modal': () => this.closeGraphModal(),
            'select-dependency': ($target) => this._handleSelectDependency($target),
        };

        this.on(document, 'click', '[data-action]', (e) => {
            const $target = $(e.currentTarget);
            const action = $target.data('action');
            const handler = this._actionHandlers[action];

            if (handler) {
                e.preventDefault();
                handler($target);
            }
        });
    }

    async _handleRefreshData($target) {
        const $icon = $target.find('.material-symbols-outlined').addClass('animate-spin');
        try {
            await this.enter();
        } catch (err) {
            console.error('Error refreshing bean definitions:', err);
        } finally {
            setTimeout(() => $icon.removeClass('animate-spin'), 500);
        }
    }

    _handleResetFilters() {
        this._resetFilterState();
        this.sortColumn = '';
        this.sortDirection = 'asc';
        this.fetchTableData();
    }

    _handleSortColumn($target) {
        const columnKey = $target.data('sort') || $target.attr('data-sort');
        if (!columnKey) return;

        this.sortDirection = (this.sortColumn === columnKey && this.sortDirection === 'asc') ? 'desc' : 'asc';
        this.sortColumn = columnKey;
        this.currentPage = 1;
        this.fetchTableData();
    }

    async _handleSelectBean($target) {

        const beanName = $target.data('bean-name');
        const contextId = $target.data('context-id');
        if (beanName) {
            const success = await this.selectBean(beanName, contextId);
            if (!success) {
                ToastNotification.show({
                    title: 'Bean Not Found',
                    message: `Bean definition for <strong class="font-mono text-purple-600 dark:text-purple-400 font-bold">${beanName}</strong> could not be loaded or is not registered in the application context.`,
                    type: 'warning',
                    duration: 4000
                });
            }
        }
    }

    async _handleSelectDependency($target) {
        const dependencyName = $target.data('fullname') || $target.find('[data-field="name"]').text().trim();
        const contextId = $target.data('context-id') || this.selectedContextId;
        if (!dependencyName) return;

        const success = await this.selectBean(dependencyName, contextId);
        if (!success) {
            ToastNotification.show({
                title: 'Dependency Not Found',
                message: `The bean <strong class="font-mono text-purple-600 dark:text-purple-400 font-bold">${dependencyName}</strong> is referenced as a dependency, but its definition is not registered or not found in the application context.`,
                type: 'warning',
                duration: 4500
            });
        }
    }

    _handleChangePage($target) {
        const targetPage = parseInt($target.data('page'), 10);
        if (!Number.isNaN(targetPage) && targetPage !== this.currentPage) {
            this.currentPage = targetPage;
            this.fetchTableData();
        }
    }

    _handlePrevPage() {
        if (!this.paginationState.isFirstPage && this.paginationState.pageNumber > 0) {
            this.currentPage = this.paginationState.pageNumber;
            this.fetchTableData();
        }
    }

    _handleNextPage() {
        if (!this.paginationState.isLastPage && this.paginationState.pageNumber < (this.paginationState.totalPages - 1)) {
            this.currentPage = this.paginationState.pageNumber + 2;
            this.fetchTableData();
        }
    }

    _handleSwitchTab($target) {
        const tab = $target.data('tab');
        if (tab) {
            this.sidebarWidget.switchTab(tab);
        }
    }

    _handleViewGraph() {
        if (this.selectedBeanName) {
            this.openGraphModal();
        }
    }

    _downloadReport() {
        const reportData = {
            title: 'SpringLens Bean Definitions Report',
            timestamp: new Date().toISOString(),
            totalElements: this.paginationState.totalElements || this.currentPageBeans.length,
            summary: this.beanDefinitionSummary,
            definitions: this.currentPageBeans
        };

        DomUtils.downloadJson(`spring-lens-definitions-${Date.now()}.json`, reportData);
    }
}