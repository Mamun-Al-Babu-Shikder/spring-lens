import {
    GraphTreeBuilder,
    Formatter,
    Pagination,
    BeanMetadataRules,
    TemplateEngine
} from '../../helper/index.js';

/**
 * Widget managing the Tabular View (#instance-table-card).
 * Renders server-paginated rows with layer icons, scope badges,
 * execution duration benchmarks, and table sorting headers.
 */
export class InstanceTableWidget {

    /**
     * @param {Object} [options={}] - Options and callbacks
     */
    constructor(options = {}) {
        this.options = options;
    }

    /**
     * Renders rows into the bean instance table body.
     *
     * @param {Array<Object>} instances - List of bean instance records
     * @param {string|null} selectedBeanName - Selected bean name
     * @param {string|null} selectedContextId - Selected context ID
     * @param {number} maxDurationNanos - Maximum duration in nanos
     * @param {number} bottleneckThresholdNanos - Threshold for bottleneck flag
     */
    renderTableRows(instances, selectedBeanName, selectedContextId, maxDurationNanos, bottleneckThresholdNanos) {
        const $tbody = $('#beanInstanceTableBody').length ? $('#beanInstanceTableBody') : $('#time-table-body');
        if (!$tbody.length) return;

        $tbody.empty();

        if (!instances || instances.length === 0) {
            const emptyClone = TemplateEngine.clone('tpl-instance-empty');
            if (emptyClone) $tbody.append(emptyClone);
            return;
        }

        const fragment = document.createDocumentFragment();

        instances.forEach((inst) => {
            const rowNode = this._createTableRowNode(
                inst,
                selectedBeanName,
                selectedContextId,
                maxDurationNanos,
                bottleneckThresholdNanos
            );
            if (rowNode) fragment.appendChild(rowNode);
        });

        $tbody.append(fragment);
    }

    /**
     * Creates an individual table row DOM node.
     */
    _createTableRowNode(inst, selectedBeanName, selectedContextId, maxDurationNanos, bottleneckThresholdNanos) {
        const clone = TemplateEngine.clone('tpl-instance-row');
        if (!clone?.firstElementChild) return null;

        const $row = $(clone.firstElementChild);
        const { beanName, contextId, initDurationNanos, scope, type, layer, createdAt } = inst;

        const durationStyle = BeanMetadataRules.resolveDurationColor(initDurationNanos, maxDurationNanos, bottleneckThresholdNanos);
        const barColor = layer?.color || durationStyle.color || '#8b5cf6';
        $row.css({
            '--row-accent-color': barColor
        });

        const isSelected = (selectedBeanName === beanName) && (selectedContextId === contextId);
        if (isSelected) {
            $row.addClass('instance-row-selected font-semibold');
        }

        $row.attr({
            'data-context-id': contextId || '',
            'data-bean-name': beanName || '',
            'data-bean': beanName || ''
        });

        // Icon Container & Icon
        const $iconContainer = $row.find('[data-field="beanIconContainer"], [data-field="iconContainer"]');
        const $icon = $row.find('[data-field="beanIcon"], [data-field="icon"]');

        $icon.text(layer?.icon || 'deployed_code').css('color', layer?.color || '#8b5cf6');
        $iconContainer.css({
            backgroundColor: `${layer?.color || '#8b5cf6'}15`,
            borderColor: `${layer?.color || '#8b5cf6'}30`
        });

        // Bean Name
        $row.find('[data-field="beanName"], [data-field="displayName"]')
            .text(GraphTreeBuilder._displayName(beanName))
            .attr('title', beanName);

        // Created At
        const formattedCreated = Formatter.formatDateTime(createdAt);
        const createdTooltip = createdAt ? `Created at: ${createdAt}` : '';
        $row.find('[data-field="createdAt"], [data-field="created"]')
            .text(formattedCreated)
            .attr('title', createdTooltip);
        $row.find('[data-field="createdAtContainer"]').attr('title', createdTooltip);

        // Type & Package Name
        const simpleType = type && type.includes('.') ? type.substring(type.lastIndexOf('.') + 1) : (type || '-');
        const packagePart = type && type.includes('.') ? type.substring(0, type.lastIndexOf('.')) : '';
        $row.find('[data-field="typeName"], [data-field="type"]').text(simpleType).attr('title', type || '');
        $row.find('[data-field="packageName"]').text(packagePart || 'default package').attr('title', type || '');

        // Scope badge
        $row.find('[data-field="scopeBadge"], [data-field="scope"]')
            .text((scope || 'singleton').toUpperCase())
            .addClass(BeanMetadataRules.resolveScopeBadgeClass(scope));

        // Duration formatted & latency badge
        const formattedDuration = Formatter.formatDuration(initDurationNanos);
        const $durationBadge = $row.find('[data-field="durationBadge"]');
        const $durationFormatted = $row.find('[data-field="durationFormatted"]');
        const $durationIcon = $row.find('[data-field="durationIcon"]');
        const $bottleneckFlame = $row.find('[data-field="bottleneckFlame"]');

        $durationFormatted.text(formattedDuration).css('color', durationStyle.color);
        $durationIcon.css('color', durationStyle.color);

        if ($durationBadge.length) {
            $durationBadge
                .addClass(durationStyle.badgeClass || '')
                .css({
                    color: durationStyle.color,
                    backgroundColor: `${durationStyle.color}15`,
                    borderColor: `${durationStyle.color}35`
                })
                .attr('title', `${(initDurationNanos || 0).toLocaleString()} ns (${durationStyle.tier || 'duration'})`);

            if (durationStyle.isBottleneck) {
                $durationBadge.addClass('font-extrabold ring-1').css('--tw-ring-color', `${durationStyle.color}50`);
                $bottleneckFlame.removeClass('hidden').css('color', durationStyle.color);
            } else {
                $bottleneckFlame.addClass('hidden');
            }
        } else {
            $durationFormatted
                .addClass(durationStyle.textClass || 'text-gray-800 dark:text-gray-200')
                .attr('title', `${(initDurationNanos || 0).toLocaleString()} ns`);
            $durationIcon.addClass(durationStyle.textClass || 'text-gray-400');
        }

        // Context ID
        const resolvedContext = contextId || 'root';
        $row.find('[data-field="contextId"]').text(resolvedContext).attr('title', resolvedContext);

        return clone;
    }

    /**
     * Renders pagination metadata info and page navigation buttons.
     *
     * @param {Object} paginationState - State with totalElements, pageNumber, pageSize, etc.
     */
    renderPagination(paginationState) {
        const $instPaginationInfo = $('#inst-pagination-info');
        const $instPaginationButtons = $('#inst-pagination-buttons');

        const { totalElements = 0, pageNumber = 0, pageSize = 20 } = paginationState || {};

        const infoText = Pagination.formatInfoText(totalElements, pageNumber, pageSize, 'instances');
        const $info = $instPaginationInfo.length ? $instPaginationInfo : $('#time-pagination-info');
        $info.text(infoText);

        const $buttons = $instPaginationButtons.length ? $instPaginationButtons : $('#time-pagination-buttons');
        Pagination.renderPaginationButtons($buttons, paginationState);
    }

    /**
     * Updates column sort header indicators.
     *
     * @param {string} sortBy - Active sort column name
     * @param {string} sortDir - Active sort direction ('ASC' or 'DESC')
     */
    updateSortHeaderIcons(sortBy, sortDir) {
        $('.th-sortable .sort-icon')
            .text('unfold_more')
            .removeClass('text-primary dark:text-purple-300 font-bold')
            .addClass('text-gray-400');

        if (sortBy) {
            const iconName = sortDir === 'ASC' ? 'expand_less' : 'expand_more';
            $(`.th-sortable[data-sort="${sortBy}"] .sort-icon`)
                .text(iconName)
                .removeClass('text-gray-400')
                .addClass('text-primary dark:text-purple-300 font-bold');
        }
    }

    /**
     * Displays table loading indicator rows.
     */
    renderLoadingState() {
        const $tbody = $('#beanInstanceTableBody').length ? $('#beanInstanceTableBody') : $('#time-table-body');
        if (!$tbody.length) return;
        const clone = TemplateEngine.clone('tpl-instance-loading');
        if (clone) $tbody.empty().append(clone);
    }

    /**
     * Displays an error alert inside the table body.
     *
     * @param {string} errorMessage - Error details
     */
    renderErrorState(errorMessage) {
        const $tbody = $('#beanInstanceTableBody').length ? $('#beanInstanceTableBody') : $('#time-table-body');
        if (!$tbody.length) return;
        const clone = TemplateEngine.clone('tpl-instance-error');
        if (clone) {
            $(clone).find('[data-field="errorMessage"]').text(`Failed to fetch bean instances: ${errorMessage}`);
            $tbody.empty().append(clone);
        }
    }
}
