import {
    BeanMetadataRules,
    CSS_CLASSES,
    TemplateEngine,
    Pagination
} from '../../helper/index.js';

/**
 * Widget responsible for bean definitions table rows, micro-badges,
 * sorting column indicator icons, and pagination controls.
 */
export default class DefinitionTableWidget {

    /**
     * @param {Object} [options]
     * @param {string} [options.container] - Table body container selector.
     */
    constructor(options = {}) {
        this.container = options.container || '#beanDefinitionTableBody';
    }

    /**
     * Renders bean definition table rows for current page.
     * @param {Array<Object>} beans
     * @param {Object} [selectionState]
     * @param {string|null} [selectionState.selectedBeanId]
     * @param {string|null} [selectionState.selectedBeanName]
     * @param {string|null} [selectionState.selectedContextId]
     */
    render(beans = [], selectionState = {}) {
        const $tbody = $(this.container);
        if (!$tbody.length) return;

        $tbody.empty();

        if (!beans || !beans.length) {
            const emptyClone = TemplateEngine.clone('tpl-bean-table-empty');
            if (emptyClone) $tbody.append(emptyClone);
            return;
        }

        const fragment = document.createDocumentFragment();
        beans.forEach(bean => {
            const rowNode = this._createBeanRowNode(bean, selectionState);
            if (rowNode) fragment.appendChild(rowNode);
        });

        $tbody.append(fragment);
    }

    /**
     * Renders pagination metadata and page navigation buttons.
     * @param {Object} paginationState
     */
    renderPagination(paginationState = {}) {
        const { totalElements = 0, pageNumber = 0, pageSize = 20 } = paginationState;

        const infoText = Pagination.formatInfoText(totalElements, pageNumber, pageSize, 'beans');
        $('#bean-definition-pagination-info').text(infoText);

        Pagination.renderPaginationButtons($('#bean-definition-pagination-buttons'), paginationState);
    }

    /**
     * Updates sort indicator icons on table headers.
     * @param {string} sortColumn
     * @param {string} sortDirection
     */
    updateSortHeaderIcons(sortColumn, sortDirection) {
        $('.sort-icon').text('unfold_more').removeClass('text-primary font-bold');
        if (sortColumn) {
            const $sortIcon = $(`.sort-icon[data-col="${sortColumn}"]`);
            if ($sortIcon.length > 0) {
                const iconName = sortDirection === 'desc' ? 'arrow_downward' : 'arrow_upward';
                $sortIcon.text(iconName).addClass('text-primary font-bold');
            }
        }
    }

    /**
     * Shows loading placeholder in table.
     */
    renderLoading() {
        const $tbody = $(this.container);
        if (!$tbody.length) return;

        const clone = TemplateEngine.clone('tpl-bean-table-loading');
        if (clone) {
            $tbody.empty().append(clone);
        }
    }

    /**
     * Shows error state in table.
     * @param {string} errorMessage
     */
    renderError(errorMessage) {
        const $tbody = $(this.container);
        if (!$tbody.length) return;

        const clone = TemplateEngine.clone('tpl-bean-table-error');
        if (clone) {
            $(clone).find('[data-field="errorMessage"]').text(errorMessage);
            $tbody.empty().append(clone);
        }
    }

    /**
     * Updates active row selection highlight styles across existing table rows.
     * @param {string|null} activeBeanId
     * @param {string|null} selectedBeanName
     * @param {string|null} selectedContextId
     */
    updateRowSelectionStyles(activeBeanId, selectedBeanName, selectedContextId) {
        $('.bean-row').each((_, element) => {
            const $row = $(element);
            const rowBeanId = $row.attr('data-bean-id');
            const rowBeanName = $row.attr('data-bean-name');
            const rowContextId = $row.attr('data-context-id') || '';
            const generatedId = `${rowContextId}:${rowBeanName}`;
            const isSelected = (rowBeanId && rowBeanId === activeBeanId) ||
                (generatedId === activeBeanId) ||
                (Boolean(selectedBeanName) && rowBeanName === selectedBeanName &&
                    (!rowContextId || !selectedContextId || rowContextId === selectedContextId));
            $row.toggleClass(CSS_CLASSES.defRowActive, Boolean(isSelected));
        });
    }

    /**
     * Highlights selected row in table.
     * @param {string|null} activeBeanId
     * @param {string|null} selectedBeanName
     * @param {string|null} [selectedContextId]
     */
    highlightSelectedRow(activeBeanId, selectedBeanName, selectedContextId) {
        this.updateRowSelectionStyles(activeBeanId, selectedBeanName, selectedContextId);
    }

    /**
     * Clears row selection highlight styling across all table rows.
     */
    clearSelection() {
        this.updateRowSelectionStyles(null, null, null);
    }

    /**
     * Generates consistent unique ID for a bean.
     * @param {string|Object} contextIdOrBean
     * @param {string} [beanName]
     * @returns {string}
     */
    generateBeanUniqueId(contextIdOrBean, beanName) {
        if (contextIdOrBean && typeof contextIdOrBean === 'object') {
            const ctx = contextIdOrBean.contextId || '';
            const name = contextIdOrBean.beanName || '';
            return `${ctx}:${name}`;
        }
        const ctx = contextIdOrBean || '';
        const name = beanName || '';
        return `${ctx}:${name}`;
    }

    /**
     * @private
     */
    _createBeanRowNode(beanInformation, selectionState = {}) {
        const { beanName, role, scope, type, primary, lazyInit, contextId } = beanInformation;
        const uniqueBeanId = this.generateBeanUniqueId(contextId, beanName);
        const { selectedBeanId, selectedBeanName, selectedContextId } = selectionState;

        const isSelected = selectedBeanId === uniqueBeanId ||
            (Boolean(selectedBeanName) && beanName === selectedBeanName && (!contextId || !selectedContextId || contextId === selectedContextId));

        const clone = TemplateEngine.clone('tpl-bean-definition-row');
        if (!clone) return null;

        const $row = $(clone.firstElementChild);
        if (isSelected) {
            $row.addClass(CSS_CLASSES.defRowActive);
        }

        const rowAttributes = {
            'data-bean-id': uniqueBeanId,
            'data-bean-name': beanName,
            'data-context-id': contextId || ''
        };
        $row.attr(rowAttributes);
        $row.find('[data-field="view-btn"]').attr(rowAttributes);

        // Metadata & Text Values
        const { icon, color } = BeanMetadataRules.resolveBeanMetadata(beanInformation);
        $row.find('[data-field="icon"]').css('color', color).text(icon);
        $row.find('[data-field="name"]').text(beanName).attr('title', beanName);

        // Dependencies & Dependents Counts
        const deps = Array.isArray(beanInformation.dependencies) ? beanInformation.dependencies : [];
        const dependents = Array.isArray(beanInformation.dependents) ? beanInformation.dependents : [];
        const depCountStr = `${deps.length} ${deps.length === 1 ? 'dep' : 'deps'}`;
        const usedByStr = `${dependents.length} used by`;
        $row.find('[data-field="depCount"]').text(depCountStr).parent().attr('title', `${deps.length} dependencies (Depends on)`);
        $row.find('[data-field="usedByCount"]').text(usedByStr).parent().attr('title', `${dependents.length} dependents (Used by)`);

        // Package Name Subtitle
        const pkg = type && type.includes('.') ? type.substring(0, type.lastIndexOf('.')) : '';
        $row.find('[data-field="packageName"]').text(pkg || 'default package').attr('title', pkg || '');

        // Type
        const shortType = type && type.includes('.') ? type.substring(type.lastIndexOf('.') + 1) : (type || '-');
        $row.find('[data-field="type"]').text(shortType).attr('title', type || '');

        // Role Badge Styling
        const rawRole = (role ? role.replace(/^ROLE_/, '') : 'APPLICATION').toUpperCase();
        const $roleEl = $row.find('[data-field="role"]').text(rawRole);
        if (rawRole === 'INFRASTRUCTURE') {
            $roleEl.addClass('bg-gradient-to-r from-rose-500/20 via-pink-500/15 to-red-500/15 text-rose-900 dark:text-rose-200 border-rose-300/80 dark:border-rose-500/40');
        } else if (rawRole === 'SUPPORT') {
            $roleEl.addClass('bg-gradient-to-r from-teal-500/20 via-emerald-500/15 to-cyan-500/15 text-teal-900 dark:text-teal-200 border-teal-300/80 dark:border-teal-500/40');
        } else {
            $roleEl.addClass('bg-gradient-to-r from-blue-500/20 via-indigo-500/15 to-sky-500/15 text-blue-900 dark:text-blue-200 border-blue-300/80 dark:border-blue-500/40');
        }

        // Context
        $row.find('[data-field="context"]').text(contextId || '-').attr('title', contextId || '');

        // Scope Styling
        const rawScope = (scope ? scope : 'SINGLETON').toUpperCase();
        $row.find('[data-field="scope"]')
            .text(rawScope)
            .addClass(BeanMetadataRules.resolveScopeBadgeClass(scope));

        // Inline Traits Micro-Badges
        const $inlineTraits = $row.find('[data-field="inlineTraits"]').empty();
        if (primary) {
            $inlineTraits.append(TemplateEngine.clone('tpl-trait-micro-primary'));
        }
        if (lazyInit) {
            $inlineTraits.append(TemplateEngine.clone('tpl-trait-micro-lazy'));
        }

        // Traits Column Badges
        const $traitsContainer = $row.find('[data-field="traitsContainer"]').empty();
        if (lazyInit) {
            $traitsContainer.append(TemplateEngine.clone('tpl-trait-badge-lazy'));
        } else {
            $traitsContainer.append(TemplateEngine.clone('tpl-trait-badge-eager'));
        }

        return clone;
    }
}
