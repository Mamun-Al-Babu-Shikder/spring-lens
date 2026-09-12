import {
    beanDataStore,
    GraphTreeBuilder,
    BeanSearchEngine,
    AsyncUtils,
    BeanMetadataRules,
    QueryParam
} from '../../helper/index.js';

/**
 * Widget managing the interactive graph search input, debounced queries,
 * fuzzy matching suggestions dropdown, and bean navigation shortcuts.
 */
export class GraphSearchWidget {

    /**
     * @param {DependencyGraphService} service - Graph API service
     * @param {Object} [options] - Options & callbacks
     * @param {Function} [options.onSelectBean] - (fullName, contextId, isSuggestion) callback
     * @param {Function} [options.getRootNode] - Callback returning D3 root node
     * @param {Function} [options.getSelectedContextId] - Callback returning active context ID
     */
    constructor(service, options = {}) {
        this.service = service;
        this.options = options;

        this._debouncedGraphSearch = null;
    }

    /**
     * Binds input listeners, keyboard shortcuts, and document click listeners.
     */
    bindEvents() {
        this._debouncedGraphSearch = AsyncUtils.debounce((query) => {
            this.handleSearchInput(query);
        }, 180);

        $(document)
            .off('input.graphSearch', '#search-input')
            .on('input.graphSearch', '#search-input', (event) => {
                this._debouncedGraphSearch(event.target.value);
            });

        $(document)
            .off('keydown.graphSearch', '#search-input')
            .on('keydown.graphSearch', '#search-input', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    this._debouncedGraphSearch?.flush();
                    const $firstSuggestion = $('#search-suggestions .suggestion-item').first();
                    if ($firstSuggestion.length) {
                        $firstSuggestion.trigger('click');
                    } else {
                        const query = $('#search-input').val()?.trim();
                        if (query) {
                            const contextId = this.options.getSelectedContextId?.() || '';
                            this.options.onSelectBean?.(query, contextId, false);
                            $('#search-input').val('');
                            $('#search-suggestions').hide();
                        }
                    }
                } else if (event.key === 'Escape') {
                    this._debouncedGraphSearch?.cancel();
                    $('#search-input').val('');
                    $('#search-suggestions').hide().empty();
                }
            });

        $(document)
            .off('keydown.graphSearchShortcut')
            .on('keydown.graphSearchShortcut', (event) => {
                if (event.key === '/' && !$(event.target).is('input, textarea, select')) {
                    event.preventDefault();
                    $('#search-input').focus();
                }
            });

        this._bindOutsideSearchDismissal();
    }

    /**
     * Executes bean search query via API with local fallback.
     *
     * @param {string} rawQueryValue - Search input string
     */
    async handleSearchInput(rawQueryValue) {
        const $suggestionsBox = $('#search-suggestions');
        const query = (rawQueryValue || '').trim();

        if (!query) {
            $suggestionsBox.hide().empty();
            return;
        }

        // Show loading spinner
        $suggestionsBox.html('<div class="p-2.5 text-gray-400 dark:text-gray-500 text-xs flex items-center gap-2"><span class="material-symbols-outlined text-[16px] animate-spin text-primary">progress_activity</span><span>Searching beans...</span></div>').show();

        try {
            const items = await this.service.searchBeansApi(query, 12);
            this._renderSearchSuggestions($suggestionsBox, items, query);
        } catch (error) {
            console.warn('Error fetching search suggestions from API:', error);
            // Fallback to in-memory matching if API is unavailable or offline
            const matchingBeans = this._searchMatchingNodes(query, 12);
            this._renderSearchSuggestions($suggestionsBox, matchingBeans, query);
        }
    }

    /**
     * In-memory search over beanDataStore or hierarchy tree.
     *
     * @param {string} searchQuery - Query string
     * @param {number} maxResultsCount - Maximum items to return
     * @returns {Array<Object>} Matched bean summaries
     */
    _searchMatchingNodes(searchQuery, maxResultsCount) {
        const candidateBeans = [];
        const visitedKeys = new Set();

        // 1. Search all beans loaded in beanDataStore
        if (beanDataStore?.beansMap?.size > 0) {
            for (const bean of beanDataStore.beansMap.values()) {
                if (!bean || !bean.beanName) continue;
                const fullName = bean.beanName;
                const contextId = bean.contextId || '';
                const uniqueKey = `${contextId}:${fullName}`;
                if (visitedKeys.has(uniqueKey)) continue;
                visitedKeys.add(uniqueKey);

                const displayName = GraphTreeBuilder._displayName(fullName);
                candidateBeans.push({
                    beanName: displayName,
                    fullName,
                    contextId,
                    type: bean.type || '',
                    scope: bean.scope || ''
                });
            }
        }

        // 2. Fallback to tree traversal if beanDataStore is empty
        const root = this.options.getRootNode?.();
        if (candidateBeans.length === 0 && root) {
            const traversalStack = [root];
            while (traversalStack.length > 0) {
                const currentNode = traversalStack.pop();
                const nodeData = currentNode.data ?? {};
                const { fullName, meta = {}, contextId = '' } = nodeData;
                const uniqueKey = `${contextId}:${fullName}`;

                if (fullName && !visitedKeys.has(uniqueKey)) {
                    visitedKeys.add(uniqueKey);
                    const displayName = GraphTreeBuilder._displayName(fullName);
                    candidateBeans.push({
                        beanName: displayName,
                        fullName,
                        contextId,
                        type: meta.type || '',
                        scope: meta.scope || ''
                    });
                }

                const childNodes = currentNode.children ?? currentNode._children;
                if (childNodes) {
                    for (let i = childNodes.length - 1; i >= 0; i--) {
                        traversalStack.push(childNodes[i]);
                    }
                }
            }
        }

        const results = BeanSearchEngine.search(candidateBeans, searchQuery, {
            limit: maxResultsCount,
            scoreResults: true
        });

        return results.map(b => ({
            beanName: b.beanName,
            fullName: b.fullName,
            contextId: b.contextId || '',
            type: b.type,
            scope: b.scope
        }));
    }

    /**
     * Renders matching bean suggestions into dropdown container.
     *
     * @param {jQuery} $suggestionsBox - Suggestions dropdown container
     * @param {Array<Object>} matchingBeans - List of bean objects
     * @param {string} [query=''] - Current search term for highlighting
     */
    _renderSearchSuggestions($suggestionsBox, matchingBeans, query = '') {
        if (!matchingBeans || matchingBeans.length === 0) {
            $suggestionsBox
                .html('<div class="p-2.5 text-gray-400 dark:text-gray-500 text-xs italic">No matching beans found</div>')
                .show();
            return;
        }

        $suggestionsBox.empty();
        const fragment = document.createDocumentFragment();

        matchingBeans.forEach(matchingBean => {
            const { contextId = '', beanName, type, scope } = matchingBean;
            const resolvedFullName = matchingBean.fullName || beanName;
            const meta = BeanMetadataRules.resolveBeanMetadata({ beanName: resolvedFullName, type });

            const itemElem = document.createElement('div');
            itemElem.className = 'suggestion-item px-3 py-2 text-xs hover:bg-purple-50/60 dark:hover:bg-purple-950/40 cursor-pointer flex items-center justify-between gap-2 border-b border-gray-100 dark:border-slate-800/60 last:border-b-0 transition-colors';
            itemElem.setAttribute('data-fullname', resolvedFullName);
            itemElem.setAttribute('data-context-id', contextId || '');

            const highlightedName = BeanSearchEngine.highlight(beanName || resolvedFullName, query);
            const shortType = type ? type.split('.').pop() : '';

            itemElem.innerHTML = `
                <div class="flex items-center gap-2 min-w-0">
                    <span class="material-symbols-outlined text-[16px] flex-shrink-0" style="color: ${meta.color}">${meta.icon}</span>
                    <div class="min-w-0">
                        <div class="font-semibold text-gray-800 dark:text-gray-200 truncate">${highlightedName}</div>
                        ${shortType ? `<div class="text-[10px] text-gray-400 dark:text-gray-500 font-mono truncate">${shortType}</div>` : ''}
                    </div>
                </div>
                <div class="flex items-center gap-1.5 flex-shrink-0">
                    ${contextId ? `<span class="px-1.5 py-0.5 text-[9px] font-medium rounded bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/50 truncate max-w-[120px]" title="${contextId}">${contextId}</span>` : ''}
                    ${scope ? `<span class="px-1.5 py-0.5 text-[9px] font-bold rounded bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 uppercase">${scope}</span>` : ''}
                </div>
            `;

            fragment.appendChild(itemElem);
        });

        $suggestionsBox.append(fragment).show();
    }

    /**
     * Closes suggestions dropdown when clicking outside search box or dropdown.
     */
    _bindOutsideSearchDismissal() {
        $(document)
            .off('click.outsideSearchDismissal')
            .on('click.outsideSearchDismissal', (event) => {
                const isClickInsideSearch = Boolean(
                    event.target.closest('#search-input') ||
                    event.target.closest('#search-suggestions')
                );

                if (!isClickInsideSearch) {
                    $('#search-suggestions').hide();
                }
            });
    }

    /**
     * Cleans up listeners, cancels debounce timers, and resets DOM elements.
     */
    destroy() {
        this._debouncedGraphSearch?.cancel();
        $(document).off('input.graphSearch', '#search-input');
        $(document).off('keydown.graphSearch', '#search-input');
        $(document).off('keydown.graphSearchShortcut');
        $(document).off('click.outsideSearchDismissal');

        $('#search-input').val('');
        $('#search-suggestions').hide().empty();
    }
}
