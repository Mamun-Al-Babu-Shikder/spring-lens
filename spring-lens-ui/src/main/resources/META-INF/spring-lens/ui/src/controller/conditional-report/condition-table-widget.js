import {
    CSS_CLASSES,
    CONDITION_STATUS_THEMES,
    TemplateEngine,
    Pagination
} from '../../helper/index.js';
import { extractClassAndPackage, getOutcomeSummary } from './condition-utils.js';

/**
 * Widget responsible for the condition evaluation data table, grouping modes,
 * loading/empty/error states, and pagination controls.
 */
export default class ConditionTableWidget {

    /**
     * @param {Object} [options]
     * @param {string} [options.container] - Table body container selector.
     */
    constructor(options = {}) {
        this.container = options.container || '#condition-table-body';
    }

    /**
     * Renders evaluation table rows, supporting grouping by package or status.
     * @param {Array<Object>} conditions
     * @param {Object} [options]
     * @param {string} [options.groupBy='none']
     * @param {Object|null} [options.selectedCondition=null]
     * @param {string} [options.detailViewStyle='side-sheet']
     */
    render(conditions = [], options = {}) {
        const { groupBy = 'none', selectedCondition = null, detailViewStyle = 'side-sheet' } = options;
        const $tbody = $(this.container);
        if (!$tbody.length) return;

        $tbody.empty();

        if (!conditions || conditions.length === 0) {
            const emptyClone = TemplateEngine.clone('tpl-condition-empty');
            if (emptyClone) $tbody.append(emptyClone);
            return;
        }

        const fragment = document.createDocumentFragment();

        if (groupBy === 'package') {
            this._renderGroupedByPackage(fragment, conditions, selectedCondition, detailViewStyle);
        } else if (groupBy === 'status') {
            this._renderGroupedByStatus(fragment, conditions, selectedCondition, detailViewStyle);
        } else {
            for (const item of conditions) {
                const rowNode = this._createConditionRowNode(item, selectedCondition, detailViewStyle);
                if (rowNode) fragment.appendChild(rowNode);
            }
        }

        $tbody.append(fragment);
    }

    /**
     * Renders pagination metadata and page navigation buttons.
     * @param {Object} paginationState
     */
    renderPagination(paginationState = {}) {
        const { totalElements = 0, pageNumber = 0, pageSize = 10 } = paginationState;

        const infoText = Pagination.formatInfoText(totalElements, pageNumber, pageSize, 'auto-configurations');
        $('#condition-pagination-info').text(infoText);

        Pagination.renderPaginationButtons($('#condition-pagination-buttons'), paginationState);
    }

    /**
     * Shows loading placeholder in table.
     */
    renderLoading() {
        const $tbody = $(this.container);
        if (!$tbody.length) return;
        const clone = TemplateEngine.clone('tpl-condition-loading');
        if (clone) $tbody.empty().append(clone);
    }

    /**
     * Shows error state in table with retry button.
     * @param {string} errorMessage
     */
    renderError(errorMessage) {
        const $tbody = $(this.container);
        if (!$tbody.length) return;
        const clone = TemplateEngine.clone('tpl-condition-error');
        if (clone) {
            $(clone).find('[data-field="errorMessage"]').text(`Failed to fetch condition evaluations: ${errorMessage}`);
            $tbody.empty().append(clone);
        }
    }

    /**
     * Highlights the selected condition row.
     * @param {string} contextId
     * @param {string} source
     */
    highlightSelectedRow(contextId, source) {
        $('.condition-row').removeClass(CSS_CLASSES.rowActive);
        if (contextId && source) {
            $(`.condition-row[data-context-id="${contextId}"][data-source="${source}"]`).addClass(CSS_CLASSES.rowActive);
        }
    }

    /**
     * Clears row selection highlight styling.
     */
    clearSelection() {
        $('.condition-row').removeClass(CSS_CLASSES.rowActive);
    }

    /**
     * Updates column sort indicator icons.
     * @param {string} sortBy
     * @param {string} sortDir
     */
    updateSortIcons(sortBy, sortDir) {
        $('.sort-icon').text('unfold_more').removeClass('text-primary font-bold');
        if (sortBy) {
            const $icon = $(`.sort-icon[data-sort="${sortBy}"]`);
            if ($icon.length) {
                $icon.text(sortDir === 'ASC' ? 'arrow_upward' : 'arrow_downward').addClass('text-primary font-bold');
            }
        }
    }

    /**
     * @private
     */
    _renderGroupedByPackage(fragment, conditions, selectedCondition, detailViewStyle) {
        const packageGroups = new Map();

        for (const item of conditions) {
            const { packageName } = extractClassAndPackage(item.source);
            const groupKey = packageName || 'default';
            if (!packageGroups.has(groupKey)) {
                packageGroups.set(groupKey, []);
            }
            packageGroups.get(groupKey).push(item);
        }

        const sortedPackages = Array.from(packageGroups.keys()).sort();

        for (const pkg of sortedPackages) {
            const items = packageGroups.get(pkg);
            const headerClone = this._createGroupHeaderNode(pkg, items.length, 'folder');
            if (headerClone) fragment.appendChild(headerClone);

            for (const item of items) {
                const rowNode = this._createConditionRowNode(item, selectedCondition, detailViewStyle);
                if (rowNode) fragment.appendChild(rowNode);
            }
        }
    }

    /**
     * @private
     */
    _renderGroupedByStatus(fragment, conditions, selectedCondition, detailViewStyle) {
        const matchedItems = conditions.filter(i => i.outcome === 'MATCHED');
        const unmatchedItems = conditions.filter(i => i.outcome === 'NOT_MATCHED');

        if (matchedItems.length > 0) {
            const headerClone = this._createGroupHeaderNode('Matched Auto-configurations', matchedItems.length, 'check_circle');
            if (headerClone) fragment.appendChild(headerClone);
            for (const item of matchedItems) {
                const rowNode = this._createConditionRowNode(item, selectedCondition, detailViewStyle);
                if (rowNode) fragment.appendChild(rowNode);
            }
        }

        if (unmatchedItems.length > 0) {
            const headerClone = this._createGroupHeaderNode('Did Not Match (Skipped)', unmatchedItems.length, 'cancel');
            if (headerClone) fragment.appendChild(headerClone);
            for (const item of unmatchedItems) {
                const rowNode = this._createConditionRowNode(item, selectedCondition, detailViewStyle);
                if (rowNode) fragment.appendChild(rowNode);
            }
        }
    }

    /**
     * @private
     */
    _createGroupHeaderNode(title, count, icon = 'folder') {
        const clone = TemplateEngine.clone('tpl-condition-group-header');
        if (!clone?.firstElementChild) return null;

        const $header = $(clone.firstElementChild);
        $header.find('[data-field="groupIcon"]').text(icon);
        $header.find('[data-field="groupTitle"]').text(title);
        $header.find('[data-field="groupCount"]').text(`${count} items`);

        return clone;
    }

    /**
     * @private
     */
    _createConditionRowNode(item, selectedCondition, detailViewStyle) {
        const clone = TemplateEngine.clone('tpl-condition-row');
        if (!clone?.firstElementChild) return null;

        const $row = $(clone.firstElementChild);
        const { source, contextId, outcome, matches = [] } = item;

        const isMatched = outcome === 'MATCHED';
        const { className, packageName, memberName } = extractClassAndPackage(source);

        const isSelected = selectedCondition
            && selectedCondition.source === source
            && selectedCondition.contextId === contextId;

        if (isSelected) {
            $row.addClass(CSS_CLASSES.rowActive);
        }

        $row.attr({
            'data-context-id': contextId || '',
            'data-source': source || ''
        });

        // Set Class Name & Package
        const displayClassName = memberName ? `${className}#${memberName}` : className;
        $row.find('[data-field="className"]').text(displayClassName).attr('title', source);
        $row.find('[data-field="packageName"]').text(packageName).attr('title', packageName);

        // Set Status Badge
        const statusTheme = isMatched ? CONDITION_STATUS_THEMES.matched : CONDITION_STATUS_THEMES.notMatched;
        $row.find('[data-field="statusBadge"]').addClass(statusTheme.badge);
        $row.find('[data-field="statusIcon"]').text(statusTheme.icon);
        $row.find('[data-field="statusText"]').text(statusTheme.label);
        if (statusTheme.rowBg) {
            $row.addClass(statusTheme.rowBg);
        }

        // Set Conditions Ratio & Progress Bar
        const totalMatches = matches.length;
        const matchedCount = matches.filter(m => m.matched).length;
        const percentage = totalMatches > 0 ? Math.round((matchedCount / totalMatches) * 100) : (isMatched ? 100 : 0);

        $row.find('[data-field="conditionRatio"]').text(`${matchedCount} / ${totalMatches}`);

        const $progressBar = $row.find('[data-field="progressBar"]');
        $progressBar.css('width', `${percentage}%`);
        if (isMatched || percentage === 100) {
            $progressBar.addClass('bg-emerald-500');
        } else if (percentage === 0) {
            $progressBar.addClass('bg-red-500 w-0');
        } else {
            $progressBar.addClass('bg-amber-500');
        }

        // Set Outcome Summary / Reason
        const outcomeSummary = getOutcomeSummary(item);
        $row.find('[data-field="outcomeSummary"]')
            .text(outcomeSummary)
            .attr('title', outcomeSummary);

        const $outcomeDot = $row.find('[data-field="outcomeDot"]');
        if (isMatched) {
            $outcomeDot.addClass('bg-emerald-500');
            $row.find('[data-field="outcomeSummary"]').addClass('text-gray-700 dark:text-gray-300');
        } else {
            $outcomeDot.addClass('bg-red-500');
            $row.find('[data-field="outcomeSummary"]').addClass('text-red-600 dark:text-red-400 font-medium');
        }

        // Expand Icon
        if (isSelected && detailViewStyle === 'inline') {
            $row.find('[data-field="expandIcon"]').addClass('rotate-90 text-primary dark:text-purple-300');
        }

        return clone;
    }
}
