import BaseController from '../base-controller.js';
import {
    ConditionReportService,
    ConditionKpiWidget,
    ConditionTabsWidget,
    ConditionTableWidget,
    ConditionDetailWidget,
    QueryParam,
    AsyncUtils
} from './index.js';

/**
 * Facade Controller for Spring Boot Conditional Evaluation Reports.
 * Coordinates data fetching, KPI summary cards, outcome filtering tabs,
 * tabular presentation, and detailed evaluation inspection.
 */
export class ConditionalReportController extends BaseController {

    /**
     * @param {Object} [endpoints={}] - API endpoints mapping
     */
    constructor(endpoints = {}) {
        super('conditionReports');

        // Sub-modules
        this.service = new ConditionReportService(endpoints);
        this.kpiWidget = new ConditionKpiWidget();
        this.tabsWidget = new ConditionTabsWidget();
        this.tableWidget = new ConditionTableWidget();
        this.detailWidget = new ConditionDetailWidget();

        // Active data state
        this.conditions = [];
        this.selectedCondition = null;

        // View and filter criteria
        this.currentPage = 1;
        this.pageSize = 10;
        this.searchQuery = '';
        this.outcomeFilter = '';
        this.groupBy = 'none';
        this.sortBy = 'source';
        this.sortDir = 'ASC';
        this.detailViewStyle = localStorage.getItem('condition_detail_view_style') || 'side-sheet';

        // Pagination metadata
        this.paginationState = {
            totalElements: 0,
            totalPages: 1,
            pageNumber: 0,
            pageSize: 10,
            isFirstPage: true,
            isLastPage: true
        };

        // KPI metrics cache
        this.kpiMetrics = {
            total: 0,
            matched: 0,
            unmatched: 0,
            totalConditions: 0
        };

        this.searchTotalCount = null;

        this._debouncedSearch = AsyncUtils.debounce(() => {
            this.currentPage = 1;
            this.fetchConditionEvaluationData();
        }, 200);

        this.addDisposable(this._debouncedSearch);
    }

    /**
     * Resets internal filter state and DOM input elements.
     * @private
     */
    _resetFilterState() {
        this.currentPage = 1;
        this.pageSize = 10;
        this.searchQuery = '';
        this.searchTotalCount = null;
        this.outcomeFilter = '';
        this.groupBy = 'none';
        this.sortBy = 'source';
        this.sortDir = 'ASC';
        this.selectedCondition = null;

        $('#condition-search-input').val('');
        $('#condition-group-by').val('none');
        $('#condition-page-size').val('10');
        this.tabsWidget.reset();
    }

    /**
     * Lifecycle hook invoked when navigating to the condition report route.
     * @param {string|Object} params - Route query parameters
     */
    async enter(params) {
        try {
            this.closeDetail();
            this._resetFilterState();

            const queryParams = QueryParam.parse(params);
            const targetCondition = QueryParam.get(queryParams, 'search', 'condition');
            const targetContextId = QueryParam.get(queryParams, 'contextId', 'context');
            const outcome = QueryParam.get(queryParams, 'outcome');

            if (targetCondition) {
                this.searchQuery = targetCondition;
                $('#condition-search-input').val(targetCondition);
            }
            if (outcome) {
                this.outcomeFilter = outcome;
            }

            this.initEvents();

            await Promise.all([
                this.fetchSummaryMetrics(),
                this.fetchConditionEvaluationData()
            ]);

            if (targetCondition && this.conditions && this.conditions.length > 0) {
                const match = this.conditions.find(c => c.source === targetCondition) || this.conditions[0];
                if (match) {
                    await this.selectCondition(targetContextId || match.contextId, match.source);
                }
            }
        } catch (error) {
            console.error('Error in ConditionalReport enter:', error);
        }
    }

    /**
     * Fetches top KPI metrics and updates the KPI cards and tab counts.
     */
    async fetchSummaryMetrics() {
        try {
            const summary = await this.service.fetchSummaryMetrics();
            if (!summary) return;

            const {
                totalEvaluationReports = 0,
                totalPositiveMatches = 0,
                totalNegativeMatches = 0,
                totalEvaluatedConditions = 0
            } = summary;

            this.kpiMetrics = {
                total: totalEvaluationReports,
                matched: totalPositiveMatches,
                unmatched: totalNegativeMatches,
                totalConditions: totalEvaluatedConditions
            };

            this.kpiWidget.render(this.kpiMetrics);
            this.tabsWidget.renderTabCounts(this.kpiMetrics, this.searchQuery, this.searchTotalCount);
        } catch (error) {
            console.error('Error fetching condition summary metrics:', error);
        }
    }

    /**
     * Fetches paginated condition report rows from the server.
     */
    async fetchConditionEvaluationData() {
        this.tableWidget.renderLoading();

        try {
            const response = await this.service.fetchConditionEvaluations({
                pageNumber: this.currentPage - 1,
                pageSize: this.pageSize,
                search: this.searchQuery,
                outcome: this.outcomeFilter,
                sortBy: this.sortBy,
                sortDir: this.sortDir
            });

            this._processPaginatedResponse(response);
            this.tableWidget.render(this.conditions, {
                groupBy: this.groupBy,
                selectedCondition: this.selectedCondition,
                detailViewStyle: this.detailViewStyle
            });
            this.tableWidget.renderPagination(this.paginationState);
        } catch (error) {
            console.error('Error fetching condition evaluations:', error);
            this.tableWidget.renderError(error.message || 'Unknown network error');
        }
    }

    /**
     * Processes server response and updates internal pagination state.
     * @private
     */
    _processPaginatedResponse(response) {
        this.conditions = Array.isArray(response?.content) ? response.content : [];

        const totalElements = response?.totalElements ?? this.conditions.length;
        const totalPages = Math.max(1, response?.totalPages ?? 1);
        const pageNumber = response?.pageNumber ?? 0;
        const pageSize = response?.pageSize ?? this.pageSize;

        this.paginationState = {
            totalElements,
            totalPages,
            pageNumber,
            pageSize,
            isFirstPage: response?.first ?? (pageNumber === 0),
            isLastPage: response?.last ?? (pageNumber >= totalPages - 1)
        };

        if (this.searchQuery) {
            if (!this.outcomeFilter) {
                this.searchTotalCount = totalElements;
                this.tabsWidget.renderTabCounts(this.kpiMetrics, this.searchQuery, this.searchTotalCount);
            } else if (this.searchTotalCount === null) {
                this.service.fetchSearchTotalCount(this.searchQuery).then(count => {
                    if (count !== null) {
                        this.searchTotalCount = count;
                        this.tabsWidget.renderTabCounts(this.kpiMetrics, this.searchQuery, this.searchTotalCount);
                    }
                });
            }
        }
    }

    /**
     * Selects a condition and displays its details in the active inspector style.
     * @param {string} contextId
     * @param {string} source
     */
    async selectCondition(contextId, source) {
        if (!contextId || !source) return;

        this.selectedCondition = { contextId, source };
        this.tableWidget.highlightSelectedRow(contextId, source);

        const localMatch = this.conditions.find(c => c.contextId === contextId && c.source === source);
        if (localMatch) {
            this.renderDetailPanel(localMatch);
        }

        try {
            const detailedCondition = await this.service.findConditionEvaluation(contextId, source);
            if (detailedCondition && this.selectedCondition?.contextId === contextId && this.selectedCondition?.source === source) {
                this.selectedCondition = detailedCondition;
                this.renderDetailPanel(detailedCondition);
            }
        } catch (error) {
            console.warn(`Failed to fetch full details for condition ${source}:`, error);
        }
    }

    /**
     * Renders detailed breakdown using the active view style.
     * @param {Object} condition
     */
    renderDetailPanel(condition) {
        this.detailWidget.render(condition, this.detailViewStyle);
    }

    /**
     * Closes the active condition inspector.
     */
    closeDetail() {
        this.selectedCondition = null;
        this.detailWidget.close();
        this.tableWidget.clearSelection();
    }

    /**
     * Switches the detail view style ('side-sheet' or 'inline').
     * @param {'side-sheet'|'inline'} style
     */
    switchDetailViewStyle(style) {
        if (this.detailViewStyle === style) return;
        this.detailViewStyle = style;
        localStorage.setItem('condition_detail_view_style', style);
        this.tabsWidget.renderViewStyleButtons(style);

        if (this.selectedCondition) {
            const match = this.conditions.find(
                c => c.contextId === this.selectedCondition.contextId && c.source === this.selectedCondition.source
            ) || this.selectedCondition;
            this.renderDetailPanel(match);
        }
    }

    /**
     * Initializes DOM event listeners.
     */
    initEvents() {
        this._initClickActions();
        this._bindSearchInput();
        this._bindSelectFilters();
        this._bindClickActionDelegation();
        this._bindKeyboardEvents();
        this.tabsWidget.renderViewStyleButtons(this.detailViewStyle);
    }

    /**
     * @private
     */
    _initClickActions() {
        this._clickActions = {
            'refresh-data': ($target) => this._handleRefresh($target),
            'filter-outcome': ($target) => this._handleFilterOutcome($target),
            'select-condition': ($target) => this._handleSelectCondition($target),
            'close-detail': () => this.closeDetail(),
            'switch-view-style': ($target) => this.switchDetailViewStyle($target.data('style')),
            'clear-search': () => this._handleClearSearch(),
            'change-page': ($target) => this._handleChangePage($target),
            'prev-page': () => this._handlePrevPage(),
            'next-page': () => this._handleNextPage(),
            'sort': ($target) => this._handleSort($target)
        };
    }

    /**
     * Binds real-time search input with debounce.
     * @private
     */
    _bindSearchInput() {
        this.on('#condition-search-input', 'input', (e) => {
            const query = e.target.value.trim();
            this.searchQuery = query;
            this.searchTotalCount = null;

            this.tabsWidget.renderTabs(this.outcomeFilter, Boolean(query));
            this._debouncedSearch();
        });

        this.on('#condition-search-input', 'keydown', (e) => {
            if (e.key === 'Escape') {
                this._handleClearSearch();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                this._debouncedSearch.flush?.();
            }
        });
    }

    /**
     * Clears search input and refreshes table.
     * @private
     */
    _handleClearSearch() {
        this._debouncedSearch.cancel?.();
        this.searchQuery = '';
        this.searchTotalCount = null;
        $('#condition-search-input').val('');
        this.tabsWidget.renderTabs(this.outcomeFilter, false);
        this.currentPage = 1;
        this.fetchConditionEvaluationData();
    }

    /**
     * Binds dropdown change events (group by, page size).
     * @private
     */
    _bindSelectFilters() {
        this.on('#condition-group-by', 'change', (e) => {
            this.groupBy = e.target.value;
            this.tableWidget.render(this.conditions, {
                groupBy: this.groupBy,
                selectedCondition: this.selectedCondition,
                detailViewStyle: this.detailViewStyle
            });
        });

        this.on('#condition-page-size', 'change', (e) => {
            this.pageSize = parseInt(e.target.value, 10) || 10;
            this.currentPage = 1;
            this.fetchConditionEvaluationData();
        });
    }

    /**
     * Centralized click delegation for [data-action] elements.
     * @private
     */
    _bindClickActionDelegation() {
        this.on(document, 'click', '[data-action]', (e) => {
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
     * Global keyboard shortcuts (Escape to close side-sheet).
     * @private
     */
    _bindKeyboardEvents() {
        this.on(document, 'keydown', (e) => {
            if (e.key === 'Escape' && this.selectedCondition) {
                this.closeDetail();
            }
        });
    }

    // --- Action Handlers ---

    async _handleRefresh($target) {
        const $icon = $target.find('.material-symbols-outlined').addClass('animate-spin');
        try {
            await Promise.all([
                this.fetchSummaryMetrics(),
                this.fetchConditionEvaluationData()
            ]);
        } finally {
            setTimeout(() => $icon.removeClass('animate-spin'), 500);
        }
    }

    _handleFilterOutcome($target) {
        const outcome = $target.data('outcome') || '';
        if (this.outcomeFilter === outcome) return;

        this.outcomeFilter = outcome;
        this.currentPage = 1;
        this.tabsWidget.renderTabs(this.outcomeFilter, Boolean(this.searchQuery));
        this.fetchConditionEvaluationData();
    }

    async _handleSelectCondition($target) {
        const $row = $target.closest('[data-source]');
        const source = $row.data('source') || $row.attr('data-source');
        const contextId = $row.data('context-id') || $row.attr('data-context-id') || '';

        if (!source) return;

        if (this.selectedCondition?.source === source && this.selectedCondition?.contextId === contextId) {
            this.closeDetail();
            return;
        }

        await this.selectCondition(contextId, source);
    }

    _handleChangePage($target) {
        const targetPage = parseInt($target.data('page'), 10);
        if (!Number.isNaN(targetPage) && targetPage !== this.currentPage) {
            this.currentPage = targetPage;
            this.fetchConditionEvaluationData();
        }
    }

    _handlePrevPage() {
        if (!this.paginationState.isFirstPage && this.currentPage > 1) {
            this.currentPage--;
            this.fetchConditionEvaluationData();
        }
    }

    _handleNextPage() {
        if (!this.paginationState.isLastPage && this.currentPage < this.paginationState.totalPages) {
            this.currentPage++;
            this.fetchConditionEvaluationData();
        }
    }

    _handleSort($target) {
        const sortBy = $target.data('sort');
        if (!sortBy) return;

        if (this.sortBy === sortBy) {
            this.sortDir = this.sortDir === 'ASC' ? 'DESC' : 'ASC';
        } else {
            this.sortBy = sortBy;
            this.sortDir = 'ASC';
        }

        this.tableWidget.updateSortIcons(this.sortBy, this.sortDir);
        this.currentPage = 1;
        this.fetchConditionEvaluationData();
    }

    /**
     * Teardown hook invoked when navigating away from this route.
     */
    leave() {
        this.closeDetail();
        this._resetFilterState();
        super.leave();
    }
}

export default ConditionalReportController;
