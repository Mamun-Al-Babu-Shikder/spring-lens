import { Sidebar, TemplateEngine } from '../../helper/index.js';

/**
 * Widget managing the slide-over details drawer for bean inspection,
 * metadata property population, and dependency/dependent accordions.
 */
export class GraphSidebarWidget {

    /**
     * @param {Object} [options] - Configuration
     * @param {Function} [options.onTransition] - Callback triggered when sidebar opens/closes to animate canvas layout
     */
    constructor(options = {}) {
        this.options = options;
    }

    /**
     * Injects the sidebar drawer template if container exists and is empty.
     */
    initSidebar() {
        const $sidebar = $('#details-sidebar');
        if ($sidebar.length && !$sidebar.children().length) {
            $sidebar.empty();
            const clone = TemplateEngine.clone('tpl-bean-details-sidebar');
            if (clone) {
                $sidebar.append(clone);
            }
        }
    }

    /**
     * Opens the slide-over details drawer with smooth width transition.
     */
    openSidebar() {
        this.initSidebar();
        const $sidebar = $('#details-sidebar');
        if (!$sidebar.length) return;

        $sidebar
            .removeClass('w-0 max-w-0 opacity-0 pointer-events-none -mr-4 border-0')
            .addClass('w-[360px] max-w-[360px] opacity-100 mr-0 border');

        this.options.onTransition?.();
    }

    /**
     * Closes the slide-over details drawer.
     */
    closeSidebar() {
        const $sidebar = $('#details-sidebar');
        if (!$sidebar.length) return;

        $sidebar
            .removeClass('w-[360px] max-w-[360px] opacity-100 mr-0 border')
            .addClass('w-0 max-w-0 opacity-0 pointer-events-none -mr-4 border-0');

        this.options.onTransition?.();
    }

    /**
     * Populates bean metadata and icons into sidebar panels and selects properties tab.
     *
     * @param {Object} [beanDetails={}] - Bean details object
     */
    populateDetails(beanDetails = {}) {
        this.openSidebar();
        Sidebar.populateDetails(beanDetails);
        Sidebar.updateSidebarIcon(beanDetails);
        this.switchTab('properties');
    }

    /**
     * Renders dependency and dependent lists in the sidebar accordions.
     *
     * @param {Array<string>} [dependencyNames=[]] - List of dependencies
     * @param {Array<string>} [dependentNames=[]] - List of dependents
     * @param {string} [contextId=''] - Context ID for navigation links
     */
    renderDependencyAccordions(dependencyNames = [], dependentNames = [], contextId = '') {
        $('#detail-deps-count').text(dependencyNames.length);
        $('#detail-dependents-count').text(dependentNames.length);

        Sidebar.renderDependencyList($('#detail-deps-list'), dependencyNames, {
            emptyText: 'No dependencies',
            emptyTemplateId: 'tpl-graph-dep-empty',
            templateId: 'tpl-graph-dep-item',
            contextId
        });

        Sidebar.renderDependencyList($('#detail-dependents-list'), dependentNames, {
            emptyText: 'No dependents',
            emptyTemplateId: 'tpl-graph-dep-empty',
            templateId: 'tpl-graph-dep-item',
            contextId
        });
    }

    /**
     * Switches the active sidebar tab ('properties' vs 'dependencies').
     *
     * @param {string} tabName - Tab key identifier
     */
    switchTab(tabName) {
        Sidebar.switchTab(tabName);
    }
}
