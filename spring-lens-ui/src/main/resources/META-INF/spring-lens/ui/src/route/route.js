import TemplateEngine from '../utils/template-engine.js';
import { NAV_STYLES } from '../utils/index.js';

export default class Route {

    constructor(config = {}) {
        this.activeRouteKey = null;
        this.templateCache  = new Map();
        this.routes         = config.routes ?? {};
        this.pagesDir       = config.pagesDir ?? './src/pages/';
        this.container      = $(config.container ?? '#main-content');
        this.defaultRoute   = config.defaultRoute ?? 'definitions';
    }

    init() {
        $(window).on('hashchange', () => {
            this.resolve().catch((error) => console.error("Hashchange route resolution failed:", error));
        });
        this._bindNavEvents();

        this.resolve().catch((error) => console.error("Initial route resolution failed:", error));
    }

    /**
     * Binds delegated navigation and accordion menu handlers.
     * @private
     */
    _bindNavEvents() {
        $(document).on('click', '.parent-link, .nav-link', (event) => {
            event.preventDefault();
            const $target = $(event.currentTarget);
            const page = $target.data('page');
            const isParent = $target.hasClass('parent-link');

            if (!isParent) {
                if (page) this.navigate(page);
                return;
            }

            // Handle parent accordion toggle
            const $submenu = $target.next('.submenu');
            if (!$submenu.length) {
                if (page) this.navigate(page);
                return;
            }

            const isVisible = $submenu.is(':visible');
            const isAlreadyActive = this.activeRouteKey === page;

            if (isVisible && isAlreadyActive) {
                this._toggleSubmenu($submenu, $target, false);
            } else {
                if (!isVisible) {
                    this._toggleSubmenu($submenu, $target, true);
                }
                if (page) this.navigate(page);
            }
        });
    }

    /**
     * Programmatic hash navigation.
     * @param {string} routeKey
     */
    navigate(routeKey) {
        const targetHash = `#/${routeKey}`;
        if (window.location.hash === targetHash) {
            this.resolve();
        } else {
            window.location.hash = targetHash;
        }
    }

    /**
     * Parse location hash and render matching route.
     */
    async resolve() {
        const hash = window.location.hash.slice(2) || 'dashboard';
        const [routeKey, queryString] = hash.split('?');
        const params = new URLSearchParams(queryString || '');

        const route = this.routes[routeKey];
        if (!route) {
            console.warn(`Route not found for key: ${routeKey}. Redirecting to dashboard.`);
            window.location.hash = '#/dashboard';
            return;
        }

        // 1. Execute onLeave hook of previous active route
        if (this.activeRouteKey && this.activeRouteKey !== routeKey) {
            try {
                this.routes[this.activeRouteKey]?.onLeave?.();
            } catch (error) {
                console.error(`Error executing onLeave hook for route ${this.activeRouteKey}:`, error);
            }
        }

        const isSameRoute = this.activeRouteKey === routeKey;
        this.activeRouteKey = routeKey;

        // 2. Render route template if changed or container is empty
        if (!isSameRoute || !this.container.children().length) {
            const loadingClone = TemplateEngine.clone('tpl-app-loading');
            if (loadingClone) {
                this.container.empty().append(loadingClone);
            }

            try {
                const html = await this._loadTemplate(routeKey, route.template);
                this.container.html(html);
                route.onEnter?.(params);
            } catch (error) {
                console.error(`Routing error loading template for ${routeKey}:`, error);
                this._renderError(error.message);
                return;
            }
        } else {
            // If same route but hash params changed, execute onEnter with updated params
            route.onEnter?.(params);
        }

        this.updateSidebarVisuals(routeKey);
    }

    /**
     * Retrieves template from cache or fetches over network.
     * @private
     */
    async _loadTemplate(routeKey, templateName) {
        if (this.templateCache.has(routeKey)) {
            return this.templateCache.get(routeKey);
        }

        const url = `${this.pagesDir}${templateName}.html`;
        const html = await $.get(url);
        this.templateCache.set(routeKey, html);
        return html;
    }

    /**
     * Render routing error panel and bind retry action.
     * @private
     */
    _renderError(message) {
        const errorClone = TemplateEngine.clone('tpl-app-error');
        if (errorClone) {
            $(errorClone).find('[data-field="message"]').text(message);
            this.container.empty().append(errorClone);
            this.container.find('#retry-load-btn').off('click').on('click', () => this.resolve());
        }
    }

    /**
     * Updates visual states for navigation links and manages submenu expansion.
     * @param {string} activePage
     */
    updateSidebarVisuals(activePage) {
        const { sublink, parent } = NAV_STYLES;

        $('aside nav a').each((_, element) => {
            const $link = $(element);
            const pageAttr = $link.data('page');
            const isSubLink = $link.parent().hasClass('submenu');
            const isActive = pageAttr === activePage;

            if (isSubLink) {
                $link.toggleClass(sublink.active, isActive)
                    .toggleClass(sublink.inactive, !isActive);

                if (isActive) {
                    const $submenu = $link.parent('.submenu');
                    this._toggleSubmenu($submenu, $submenu.prev('.parent-link'), true);
                }
                return;
            }

            const isParent = $link.hasClass('parent-link');
            const $submenu = isParent ? $link.next('.submenu') : $();
            const hasActiveChild = $submenu.length > 0 && $submenu.find(`[data-page="${activePage}"]`).length > 0;
            const isParentActive = isActive || hasActiveChild;

            $link.toggleClass(parent.active, isParentActive)
                .toggleClass(parent.inactive, !isParentActive);

            if (isParentActive && isParent) {
                this._toggleSubmenu($submenu, $link, true);
            }
        });

        // Auto-collapse inactive submenus
        $('.submenu').each((_, element) => {
            const $submenu = $(element);
            const hasActiveChild = $submenu.find(`[data-page="${activePage}"]`).length > 0;
            const isParentActive = $submenu.prev(`.parent-link[data-page="${activePage}"]`).length > 0;

            if (!hasActiveChild && !isParentActive) {
                this._toggleSubmenu($submenu, $submenu.prev('.parent-link'), false);
            }
        });
    }

    /**
     * Helper to slide toggle submenus and rotate chevron icons cleanly.
     * @private
     */
    _toggleSubmenu($submenu, $parentLink, shouldExpand) {
        if (!$submenu?.length) return;

        if (shouldExpand && $submenu.is(':hidden')) {
            $submenu.stop(true, true).slideDown(200);
            $parentLink.find('.chevron-icon').addClass('rotate-180');
        } else if (!shouldExpand && $submenu.is(':visible')) {
            $submenu.stop(true, true).slideUp(200);
            $parentLink.find('.chevron-icon').removeClass('rotate-180');
        }
    }
}