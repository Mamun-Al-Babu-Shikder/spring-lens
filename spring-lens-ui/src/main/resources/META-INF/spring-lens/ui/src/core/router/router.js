import TemplateEngine from '../../helper/template-engine.js';
import PageHeader from '../../helper/page-header.js';
import { NAV_STYLES } from '../../helper/constants.js';
import PAGE_HEADERS from '../../config/page-headers.js';
import RouteDefinition from './route-definition.js';
import Pipeline from './pipeline.js';
import container from '../container.js';

/**
 * Core Router Engine.
 * Handles hash navigation, route resolution, controller dispatch,
 * middleware pipelines, and view rendering.
 */
export default class Router {

    constructor(config = {}) {
        this.routes = new Map();
        this.namedRoutes = new Map();
        this.globalMiddlewares = [];
        this.templateCache = new Map();

        this._groupStack = [];
        this.activeRouteKey = null;
        this.activeRoute = null;
        this.activeController = null;

        this.pagesDir = config.pagesDir ?? './src/views/';
        this.containerSelector = config.container ?? '#main-content';
        this.defaultRoute = config.defaultRoute ?? 'dashboard';
        this.appTitle = config.appTitle ?? 'Spring Lens';
        this.titleSeparator = config.titleSeparator ?? ' | ';

        // Support passing legacy routes object in constructor
        if (config.routes) {
            this._registerLegacyRoutes(config.routes);
        }
    }

    get container() {
        return $(this.containerSelector);
    }

    /**
     * Initializes the router, binds event listeners, and resolves the initial route.
     * @param {Object} [config={}]
     */
    init(config = {}) {
        // Auto-boot IoC container & background services
        container.boot();

        if (config.container) this.containerSelector = config.container;
        if (config.defaultRoute) this.defaultRoute = config.defaultRoute;
        if (config.pagesDir) this.pagesDir = config.pagesDir;

        $(window).off('hashchange.springLensRouter').on('hashchange.springLensRouter', () => {
            this.resolve().catch((error) => console.error('Hashchange route resolution failed:', error));
        });

        this._bindNavEvents();
        this.resolve().catch((error) => console.error('Initial route resolution failed:', error));
    }

    /**
     * Registers a GET route with a path and controller action or callback.
     * @param {string} path - Route URI pattern (e.g. 'dashboard', 'bean/definitions')
     * @param {Array|Object|Function|null} [action=null] - [Controller, 'actionName'], controller instance, or callback
     * @returns {RouteDefinition}
     */
    get(path, action = null) {
        const fullPath = this._applyGroupPrefix(path);
        const route = new RouteDefinition(fullPath, action);

        // Apply any active group middlewares
        const groupMiddlewares = this._getActiveGroupMiddlewares();
        if (groupMiddlewares.length > 0) {
            route.middleware(groupMiddlewares);
        }

        this.routes.set(route.path, route);

        // Auto-register discovered routeName into namedRoutes
        if (route.routeName) {
            this.namedRoutes.set(route.routeName, route);
        }

        // Enable proxying of route.name() calls to register into this.namedRoutes
        const originalName = route.name.bind(route);
        route.name = (name) => {
            originalName(name);
            this.namedRoutes.set(name, route);
            return route;
        };

        return route;
    }

    /**
     * Shorthand to register a direct view route.
     * @param {string} path
     * @param {string} templatePath
     * @returns {RouteDefinition}
     */
    view(path, templatePath) {
        return this.get(path).view(templatePath);
    }

    /**
     * Shorthand to register a route redirect.
     * @param {string} fromPath
     * @param {string} toPath
     * @returns {RouteDefinition}
     */
    redirect(fromPath, toPath) {
        return this.get(fromPath).redirectTo(toPath);
    }

    /**
     * Creates a route group sharing attributes (prefix, middleware).
     * @param {Object} options - { prefix?: string, middleware?: Function|Function[] }
     * @param {Function} callback - Group definition callback receiving router instance
     * @returns {Router}
     */
    group(options, callback) {
        this._groupStack.push(options);
        try {
            callback(this);
        } finally {
            this._groupStack.pop();
        }
        return this;
    }

    /**
     * Creates a route group with a shared prefix.
     * @param {string} prefix
     * @returns {{group: Function}}
     */
    prefix(prefix) {
        return {
            group: (callback) => this.group({ prefix }, callback)
        };
    }

    /**
     * Creates a route group with shared middlewares.
     * @param {...Function} middlewares
     * @returns {{group: Function}}
     */
    middleware(...middlewares) {
        return {
            group: (callback) => this.group({ middleware: middlewares.flat() }, callback)
        };
    }

    /**
     * Registers a global middleware executed on every route transition.
     * @param {...Function} middlewares
     * @returns {Router}
     */
    use(...middlewares) {
        this.globalMiddlewares.push(...middlewares.flat().filter(Boolean));
        return this;
    }

    /**
     * Programmatic navigation.
     * @param {string} path - Target path or route name
     * @param {Object} [queryParams=null]
     */
    navigate(path, queryParams = null) {
        const targetRoute = this.namedRoutes.get(path);
        const resolvedPath = targetRoute ? targetRoute.path : this._normalizePath(path);

        let query = '';
        if (queryParams) {
            const searchParams = new URLSearchParams(queryParams);
            const str = searchParams.toString();
            if (str) query = `?${str}`;
        }

        const targetHash = `#/${resolvedPath}${query}`;
        if (window.location.hash === targetHash) {
            this.resolve();
        } else {
            window.location.hash = targetHash;
        }
    }

    /**
     * Resolves and renders the route matching current window.location.hash.
     */
    async resolve() {
        const rawHash = window.location.hash.replace(/^#\/?/, '') || this.defaultRoute;
        const [rawPath, queryString] = rawHash.split('?');
        const path = this._normalizePath(rawPath) || this.defaultRoute;
        const params = new URLSearchParams(queryString || '');

        let route = this.routes.get(path);

        // Fallback matching: try suffix or defaultRoute
        if (!route) {
            for (const [routePath, def] of this.routes.entries()) {
                if (routePath.endsWith(path) || path.endsWith(routePath)) {
                    route = def;
                    break;
                }
            }
        }

        if (!route) {
            console.warn(`Route not found for path: "${path}". Redirecting to default: ${this.defaultRoute}`);
            window.location.hash = `#/${this.defaultRoute}`;
            return;
        }

        // Handle Redirects
        if (route.redirectTarget) {
            const query = queryString ? `?${queryString}` : '';
            window.location.hash = `#/${route.redirectTarget}${query}`;
            return;
        }

        // Create routing context
        const context = {
            path,
            params,
            queryString,
            route,
            router: this
        };

        // Execute Middleware Pipeline
        const pipeline = new Pipeline([...this.globalMiddlewares, ...route.middlewares]);
        await pipeline.run(context, async (ctx) => {
            await this._dispatchRoute(ctx);
        });
    }

    /**
     * Dispatches view rendering and controller execution for a resolved route.
     * @private
     */
    async _dispatchRoute(context) {
        const { route, path, params } = context;
        const isSameRoute = this.activeRouteKey === path;

        // 1. Teardown previous controller & Alpine component tree
        if (this.activeRouteKey && !isSameRoute) {
            if (typeof window !== 'undefined' && window.Alpine?.destroyTree && this.container?.[0]) {
                try {
                    window.Alpine.destroyTree(this.container[0]);
                } catch (e) {
                    console.warn('Alpine destroyTree warning:', e);
                }
            }

            if (this.activeController && typeof this.activeController.leave === 'function') {
                try {
                    this.activeController.leave();
                } catch (error) {
                    console.error(`Error executing leave() on controller:`, error);
                }
            }
            if (typeof window !== 'undefined' && window.__activeController === this.activeController) {
                window.__activeController = null;
            }
            if (this.activeRoute?.customOnLeave) {
                try {
                    this.activeRoute.customOnLeave();
                } catch (error) {
                    console.error(`Error executing custom onLeave hook:`, error);
                }
            }
        }

        const controller = this._resolveController(route.targetController);

        this.activeRouteKey = path;
        this.activeRoute = route;
        this.activeController = controller;
        if (typeof window !== 'undefined') {
            window.__activeController = controller;
        }

        // 2. Render View & Header if route changed or container is empty
        if (!isSameRoute || !this.container.children().length) {
            const loadingClone = TemplateEngine.clone('tpl-app-loading');
            if (loadingClone) {
                this.container.empty().append(loadingClone);
            }

            try {
                if (route.template) {
                    const html = await this._loadTemplate(route.template);
                    this.container.empty();

                    // Resolve & Render PageHeader
                    const headerConfig = this._resolveHeader(route, controller, params);
                    if (headerConfig) {
                        const headerNode = PageHeader.render(headerConfig);
                        if (headerNode) {
                            this.container.append(headerNode);
                        }
                    }

                    this.container.append(html);

                    const wireAlpine = () => {
                        if (typeof window === 'undefined' || !this.container?.[0] || !controller) return;
                        try {
                            if (window.Alpine?.initTree) {
                                window.Alpine.initTree(this.container[0]);
                            }
                            const alpineRoot = this.container[0].querySelector('[x-data]');
                            if (alpineRoot && window.Alpine?.$data) {
                                const alpineData = window.Alpine.$data(alpineRoot);
                                if (typeof controller.bindAlpine === 'function') {
                                    controller.bindAlpine(alpineData);
                                } else if (typeof controller.bindalpine === 'function') {
                                    controller.bindalpine(alpineData);
                                } else {
                                    controller.alpine = alpineData;
                                }
                            }
                        } catch (e) {
                            console.warn('Alpine auto-wire warning:', e);
                        }
                    };

                    if (typeof window !== 'undefined' && window.Alpine?.$data) {
                        wireAlpine();
                    } else if (typeof window !== 'undefined') {
                        document.addEventListener('alpine:init', wireAlpine, { once: true });
                        document.addEventListener('alpine:initialized', wireAlpine, { once: true });
                    }
                }
            } catch (error) {
                console.error(`Routing error loading template for "${path}":`, error);
                this._renderError(error.message);
                return;
            }
        }

        // 3. Dispatch Controller Action & Custom Hooks (support both index and enter)
        try {
            const targetAction = route.targetAction || 'enter';
            const actionMethod = (controller && typeof controller[targetAction] === 'function')
                ? targetAction
                : (targetAction === 'index' && typeof controller?.enter === 'function')
                    ? 'enter'
                    : (targetAction === 'enter' && typeof controller?.index === 'function')
                        ? 'index'
                        : targetAction;

            if (controller && typeof controller[actionMethod] === 'function') {
                await controller[actionMethod](params, context);
            }
            if (route.customOnEnter) {
                await route.customOnEnter(params, context);
            }
        } catch (error) {
            console.error(`Error executing controller action for route "${path}":`, error);
        }

        // 4. Update Navigation Visuals & Document Title
        this.updateSidebarVisuals(path);
        const resolvedHeader = this._resolveHeader(route, controller, params);
        this._updateDocumentTitle(route, resolvedHeader);
    }

    /**
     * Resolves a controller instance using the IoC container.
     * @private
     */
    _resolveController(targetController) {
        if (!targetController) return null;
        return container.make(targetController);
    }

    /**
     * Resolves the header configuration via multi-tier fallback:
     * 1. Explicit RouteDefinition override (.header(...))
     * 2. Controller-provided dynamic header (controller.getHeader?.(params) || controller.header)
     * 3. PAGE_HEADERS registry by route name or route path
     * @private
     */
    _resolveHeader(route, controller, params) {
        // Explicit override on route (allows passing null to suppress)
        if (route.headerConfig !== undefined) {
            return route.headerConfig;
        }

        // Controller dynamic getter
        if (typeof controller?.getHeader === 'function') {
            return controller.getHeader(params);
        }
        if (controller?.header) {
            return controller.header;
        }

        // Centralized configuration registry lookup
        const lookupKey = route.routeName || route.path;
        if (PAGE_HEADERS && PAGE_HEADERS[lookupKey]) {
            return PAGE_HEADERS[lookupKey];
        }

        // Strip group prefix for fallback lookup (e.g. 'bean/definitions' -> 'definitions')
        const baseKey = lookupKey.split('/').pop();
        if (PAGE_HEADERS && PAGE_HEADERS[baseKey]) {
            return PAGE_HEADERS[baseKey];
        }

        return null;
    }

    /**
     * Dynamically updates the document title based on route config and resolved header.
     * @private
     */
    _updateDocumentTitle(route, headerConfig) {
        const pageTitle = route.customTitle || headerConfig?.title;
        if (pageTitle) {
            document.title = `${this.appTitle}${this.titleSeparator}${pageTitle}`;
        } else {
            document.title = this.appTitle;
        }
    }

    /**
     * Loads template from cache or fetches over network.
     * @private
     */
    async _loadTemplate(templateName) {
        if (this.templateCache.has(templateName)) {
            return this.templateCache.get(templateName);
        }

        const url = `${this.pagesDir}${templateName}.html`;
        const html = await $.get(url);
        this.templateCache.set(templateName, html);
        return html;
    }

    /**
     * Renders routing error panel with retry trigger.
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
        const normalizedActive = this._normalizePath(activePage);

        $('aside nav a, aside nav button, aside nav .parent-link').each((_, element) => {
            const $link = $(element);
            const pageAttr = this._normalizePath($link.data('page'));
            const isSubLink = $link.parent().hasClass('submenu');

            // Matches exact page, or suffix (e.g. 'bean/definitions' matches 'definitions')
            const isActive = pageAttr && (pageAttr === normalizedActive || normalizedActive.endsWith(pageAttr));

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
            const hasActiveChild = $submenu.length > 0 && $submenu.find('a').filter((_, a) => {
                const subPage = this._normalizePath($(a).data('page'));
                return subPage && (subPage === normalizedActive || normalizedActive.endsWith(subPage));
            }).length > 0;

            if (!isParent && pageAttr) {
                $link.toggleClass(parent.active, isActive)
                    .toggleClass(parent.inactive, !isActive);
            }

            if (hasActiveChild && isParent) {
                this._toggleSubmenu($submenu, $link, true);
            }
        });

        // Auto-collapse inactive submenus
        $('.submenu').each((_, element) => {
            const $submenu = $(element);
            const hasActiveChild = $submenu.find('a').filter((_, a) => {
                const subPage = this._normalizePath($(a).data('page'));
                return subPage && (subPage === normalizedActive || normalizedActive.endsWith(subPage));
            }).length > 0;

            if (!hasActiveChild) {
                this._toggleSubmenu($submenu, $submenu.prev('.parent-link'), false);
            }
        });
    }

    /**
     * Slides submenus and rotates chevron icons.
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

    /**
     * Binds delegated navigation and accordion menu handlers.
     * @private
     */
    _bindNavEvents() {
        $(document).off('click.springLensNav', '.parent-link, .nav-link')
            .on('click.springLensNav', '.parent-link, .nav-link', (event) => {
                event.preventDefault();
                const $target = $(event.currentTarget);
                const page = $target.data('page');
                const isParent = $target.hasClass('parent-link');

                if (!isParent) {
                    if (page) this.navigate(page);
                    return;
                }

                const $submenu = $target.next('.submenu');
                if (!$submenu.length) {
                    if (page) this.navigate(page);
                    return;
                }

                const isVisible = $submenu.is(':visible');
                this._toggleSubmenu($submenu, $target, !isVisible);

                if (page) {
                    this.navigate(page);
                }
            });
    }



    _normalizePath(path) {
        if (!path || path === '/') return '';
        return String(path).replace(/^\/+|\/+$/g, '');
    }

    _applyGroupPrefix(path) {
        const normalized = this._normalizePath(path);
        const prefixes = this._groupStack
            .map(g => g.prefix)
            .filter(Boolean)
            .map(p => this._normalizePath(p));

        if (!prefixes.length) return normalized;
        return [...prefixes, normalized].filter(Boolean).join('/');
    }

    _getActiveGroupMiddlewares() {
        return this._groupStack
            .map(g => g.middleware)
            .filter(Boolean)
            .flat();
    }

    /**
     * Registers legacy routes object for full backward compatibility.
     * @private
     */
    _registerLegacyRoutes(routesObj = {}) {
        Object.entries(routesObj).forEach(([path, config]) => {
            if (config.redirectTo) {
                this.redirect(path, config.redirectTo);
                return;
            }

            const route = this.get(path);
            if (config.template) route.view(config.template);
            if (config.header !== undefined) route.header(config.header);
            if (config.title) route.title(config.title);
            if (config.onEnter) route.onEnter(config.onEnter);
            if (config.onLeave) route.onLeave(config.onLeave);
        });
    }
}

export { Router };
