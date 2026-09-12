import {
    AsyncUtils,
    BeanSearchEngine,
    BeanMetadataRules,
    QueryParam,
    TemplateEngine
} from '../../helper/index.js';

/**
 * Widget responsible for the Quick Bean Search bar, debounced search API calls,
 * highlighted results chips, and direct navigation actions.
 */
export default class QuickSearchWidget {

    /**
     * @param {Object} options
     * @param {import('./dashboard-service.js').default} options.service
     */
    constructor(options = {}) {
        this.service = options.service;
        this._debouncedSearch = AsyncUtils.debounce((query) => this.search(query), 200);
    }

    /**
     * Binds search input and keyboard event listeners.
     */
    bindEvents() {
        const $doc = $(document);

        $doc.on('input.dashboard-search', '#db-quick-search-input', (e) => {
            const query = (e.target?.value ?? '').trim();
            this._debouncedSearch(query);
        });

        $doc.on('keydown.dashboard-search', '#db-quick-search-input', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this._debouncedSearch.flush();
            } else if (e.key === 'Escape') {
                this._debouncedSearch.cancel();
                this.reset();
            }
        });

        $doc.on('click.dashboard-search', '#db-clear-search', () => {
            this.reset();
        });
    }

    /**
     * Executes backend bean search and populates results chips.
     * @param {string} query
     */
    async search(query) {
        const $resultsContainer = $('#db-quick-search-results');
        const $chipsContainer = $('#db-quick-search-chips').empty();

        if (!query || query.length < 2) {
            $resultsContainer.addClass('hidden');
            return;
        }

        try {
            const response = await this.service.searchDefinitions(query, { pageSize: 9 });
            const items = response?.content ?? [];

            if (items.length === 0) {
                const emptyClone = TemplateEngine.clone('tpl-dashboard-empty-state');
                if (emptyClone) {
                    const $emptyEl = $(emptyClone.firstElementChild);
                    $emptyEl.addClass('col-span-full')
                        .find('[data-field="message"]')
                        .text('No matching beans found for query.');
                    $chipsContainer.append($emptyEl);
                }
                $resultsContainer.removeClass('hidden');
                return;
            }

            const fragment = document.createDocumentFragment();

            items.forEach(b => {
                const clone = TemplateEngine.clone('tpl-dashboard-search-chip');
                if (!clone) return;

                const $chip = $(clone.firstElementChild);
                const beanName = b.beanName || b.name || '--';
                const beanType = b.beanType || b.type || b.className || '';
                const contextId = b.contextId || '';
                const meta = BeanMetadataRules.resolveBeanMetadata({ beanName, type: beanType });

                $chip.find('[data-field="icon"]')
                    .css('color', meta.color)
                    .text(meta.icon);
                $chip.find('[data-field="name"]')
                    .html(BeanSearchEngine.highlight(beanName, query))
                    .attr('title', beanName);

                // Def button & chip body -> Definitions page with URL params
                $chip.find('.btn-goto-def').on('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const q = QueryParam.build({ search: beanName, contextId }).toString();
                    window.location.hash = `#/definitions?${q}`;
                });

                // Graph button -> Dependency Graph page with URL params
                $chip.find('.btn-goto-graph').on('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const q = QueryParam.build({ focus: beanName, contextId }).toString();
                    window.location.hash = `#/graph?${q}`;
                });

                // Inst button -> Bean Instances page with URL params
                $chip.find('.btn-goto-inst').on('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const q = QueryParam.build({ search: beanName, contextId }).toString();
                    window.location.hash = `#/instances?${q}`;
                });

                fragment.appendChild(clone);
            });

            $chipsContainer.append(fragment);
            $resultsContainer.removeClass('hidden');
        } catch (err) {
            console.warn('Error during dashboard quick search:', err);
            $chipsContainer.append('<div class="col-span-full text-xs text-red-400 py-2">Error searching beans.</div>');
            $resultsContainer.removeClass('hidden');
        }
    }

    /**
     * Resets quick search input and clears results.
     */
    reset() {
        $('#db-quick-search-input').val('');
        $('#db-quick-search-chips').empty();
        $('#db-quick-search-results').addClass('hidden');
    }

    /**
     * Cancels any pending searches and unbinds event listeners.
     */
    destroy() {
        this._debouncedSearch?.cancel();
        $(document).off('.dashboard-search');
        this.reset();
    }
}
