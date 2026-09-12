import { Sidebar, TemplateEngine } from '../../helper/index.js';

/**
 * Widget responsible for the bean details slide-over sidebar panel,
 * property metadata, dependency/dependent lists, and tab navigation.
 */
export default class DefinitionSidebarWidget {

    /**
     * @param {Object} [options]
     * @param {string} [options.container] - Sidebar container selector.
     */
    constructor(options = {}) {
        this.container = options.container || '#def-details-sidebar';
        this.activeTab = 'properties';
    }

    /**
     * Ensures sidebar template markup is injected into the container.
     */
    initTemplate() {
        const $sidebar = $(this.container);
        if ($sidebar.length && !$sidebar.children().length) {
            $sidebar.empty();
            const clone = TemplateEngine.clone('tpl-bean-details-sidebar');
            if (clone) {
                const footerClone = TemplateEngine.clone('tpl-bean-details-sidebar-footer');
                if (footerClone) {
                    $(clone).find('#sidebar-footer-container').replaceWith(footerClone);
                }
                $sidebar.append(clone);
            }
        }
    }

    /**
     * Opens details sidebar with slide-over animation.
     */
    open() {
        const $sidebar = $(this.container);
        if (!$sidebar.length) return;
        this.initTemplate();
        $sidebar.removeClass('w-0 max-w-0 opacity-0 pointer-events-none -mr-6 border-0')
            .addClass('w-[380px] max-w-[380px] opacity-100 mr-0 border');
    }

    /**
     * Closes details sidebar with slide-out animation.
     */
    close() {
        const $sidebar = $(this.container);
        if (!$sidebar.length) return;
        $sidebar.removeClass('w-[380px] max-w-[380px] opacity-100 mr-0 border')
            .addClass('w-0 max-w-0 opacity-0 pointer-events-none -mr-6 border-0');
    }

    /**
     * Populates bean property metadata into the sidebar.
     * @param {Object} beanInformation
     */
    populateDetails(beanInformation) {
        Sidebar.populateDetails(beanInformation);
        Sidebar.updateSidebarIcon(beanInformation);
    }

    /**
     * Populates dependency and dependent bean lists in the sidebar tabs.
     * @param {Object} bean
     */
    populateLists(bean) {
        const { dependencies = [], dependents = [], contextId = '' } = bean;

        $('#detail-deps-count').text(dependencies.length);
        $('#detail-dependents-count').text(dependents.length);

        Sidebar.renderDependencyList($('#detail-deps-list'), dependencies, {
            contextId,
            action: 'select-dependency'
        });
        Sidebar.renderDependencyList($('#detail-dependents-list'), dependents, {
            contextId,
            action: 'select-dependency'
        });
    }

    /**
     * Switches active tab (properties | dependencies | dependents).
     * @param {string} tabName
     */
    switchTab(tabName) {
        this.activeTab = tabName;
        Sidebar.switchTab(tabName);
    }
}
