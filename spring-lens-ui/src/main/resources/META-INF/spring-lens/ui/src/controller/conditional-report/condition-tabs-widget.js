import { CSS_CLASSES } from '../../helper/index.js';

/**
 * Widget responsible for the filter tabs (All, Matched, Did Not Match),
 * outcome counters, view style switcher, and control dropdowns.
 */
export default class ConditionTabsWidget {

    /**
     * Updates active styling of the filter tabs and visibility during search.
     * @param {string} activeOutcome - Current active outcome filter ('', 'MATCHED', 'NOT_MATCHED').
     * @param {boolean} isSearching - Whether a search query is active.
     */
    renderTabs(activeOutcome = '', isSearching = false) {
        // Hide Matched and Did Not Match filter buttons while searching
        $('#condition-tab-matched, #condition-tab-unmatched').toggleClass('hidden', isSearching);

        // Update active tab button styles
        $('#condition-tabs-container button').each((_, el) => {
            const $btn = $(el);
            const outcome = $btn.data('outcome') || '';
            const isActive = outcome === activeOutcome;

            $btn.toggleClass(CSS_CLASSES.pillActive, isActive)
                .toggleClass(CSS_CLASSES.pillInactive, !isActive);
        });
    }

    /**
     * Updates tab count labels.
     * @param {Object} metrics - Dataset-wide counts { total, matched, unmatched }.
     * @param {string} [searchQuery] - Current search query.
     * @param {number|null} [searchTotalCount] - Matching count across all outcomes.
     */
    renderTabCounts(metrics = {}, searchQuery = '', searchTotalCount = null) {
        const { total = 0, matched = 0, unmatched = 0 } = metrics;
        const allCount = (searchQuery && searchTotalCount !== null)
            ? searchTotalCount
            : total;

        $('#condition-count-all').text(allCount.toLocaleString());
        $('#condition-count-matched').text(matched.toLocaleString());
        $('#condition-count-unmatched').text(unmatched.toLocaleString());
    }

    /**
     * Synchronizes the visual state of the detail view style segmented buttons.
     * @param {'side-sheet'|'inline'} detailViewStyle
     */
    renderViewStyleButtons(detailViewStyle = 'side-sheet') {
        const isSideSheet = detailViewStyle === 'side-sheet';
        const activeClass = 'bg-white dark:bg-slate-900 text-primary dark:text-purple-300 font-bold shadow-xs';
        const inactiveClass = 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200';

        $('#btn-view-style-side-sheet')
            .removeClass(`${activeClass} ${inactiveClass}`)
            .addClass(isSideSheet ? activeClass : inactiveClass);

        $('#btn-view-style-inline')
            .removeClass(`${activeClass} ${inactiveClass}`)
            .addClass(!isSideSheet ? activeClass : inactiveClass);
    }

    /**
     * Resets tab counters and form controls.
     */
    reset() {
        $('#condition-count-all').text('0');
        $('#condition-count-matched').text('0');
        $('#condition-count-unmatched').text('0');
        $('#condition-group-by').val('none');
        $('#condition-page-size').val('10');
        this.renderTabs('', false);
    }
}
