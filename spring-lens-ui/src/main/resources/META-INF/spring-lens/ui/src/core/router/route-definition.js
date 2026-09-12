/**
 * Represents a single Route Definition with a chainable fluent builder API.
 * Inspired by Laravel's RouteDefinition.
 */
export default class RouteDefinition {

    /**
     * @param {string} path - The route path / URI pattern (e.g. 'dashboard', 'definitions').
     * @param {Array|Object|Function|null} [action] - [Controller, 'actionName'], Controller instance, or callback.
     */
    constructor(path, action = null) {
        this.path = this._normalizePath(path);
        this.template = null;
        this.routeName = null;
        this.headerConfig = undefined; // undefined = auto-resolve, null = no header, Object = explicit override
        this.customTitle = null;
        this.redirectTarget = null;
        this.middlewares = [];
        this.targetController = null;
        this.targetAction = 'enter';
        this.customOnEnter = null;
        this.customOnLeave = null;

        if (action) {
            this._parseAction(action);
        }
    }

    /**
     * Normalizes route path by trimming leading/trailing slashes.
     * @private
     */
    _normalizePath(path) {
        if (!path || path === '/') return '';
        return String(path).replace(/^\/+|\/+$/g, '');
    }

    /**
     * Parses controller/action tuple, controller instance, or callback.
     * @private
     */
    _parseAction(action) {
        if (Array.isArray(action)) {
            const [controller, actionName = 'enter'] = action;
            this.targetController = controller;
            this.targetAction = actionName;
        } else if (typeof action === 'function') {
            const isClass = action.toString().startsWith('class ') || (action.prototype && typeof action.prototype.enter === 'function');
            if (isClass) {
                this.targetController = action;
                this.targetAction = 'enter';
            } else {
                this.customOnEnter = action;
            }
        } else if (typeof action === 'object' && action !== null) {
            this.targetController = action;
            this.targetAction = 'enter';
        }

        if (this.targetController) {
            this._extractControllerMetadata(this.targetController);
        }
    }

    /**
     * Auto-discovers routing metadata (view, name, title, header) declared on the controller.
     * @private
     */
    _extractControllerMetadata(controller) {
        if (!controller) return;

        const source = (typeof controller === 'function') ? controller : controller.constructor;
        const proto = (typeof controller === 'function') ? controller.prototype : controller;

        // View Template
        const view = source?.view ?? proto?.view;
        if (view && !this.template) {
            this.view(view);
        }

        // Route Name
        const routeName = source?.routeName ?? proto?.routeName ?? source?.name;
        if (routeName && !this.routeName) {
            this.name(routeName);
        }

        // Page / Document Title
        const title = source?.title ?? proto?.title;
        if (title && !this.customTitle) {
            this.title(title);
        }

        // Header Configuration (can explicitly be null to suppress)
        const header = source?.header !== undefined ? source.header : proto?.header;
        if (header !== undefined && this.headerConfig === undefined) {
            this.header(header);
        }
    }

    /**
     * Sets the view template path relative to the pages directory.
     * @param {string} templatePath (e.g. 'dashboard/dashboard', 'bean/definitions')
     * @returns {RouteDefinition}
     */
    view(templatePath) {
        this.template = templatePath;
        return this;
    }

    /**
     * Sets a controller and action name for this route.
     * @param {Object} controllerInstance
     * @param {string} [actionName='enter']
     * @returns {RouteDefinition}
     */
    controller(controllerInstance, actionName = 'enter') {
        this.targetController = controllerInstance;
        this.targetAction = actionName;
        this._extractControllerMetadata(controllerInstance);
        return this;
    }

    /**
     * Assigns a unique name to the route for reverse routing and automatic header resolution.
     * @param {string} name
     * @returns {RouteDefinition}
     */
    name(name) {
        this.routeName = name;
        return this;
    }

    /**
     * Sets an explicit header configuration for the PageHeader component,
     * or passes `null` to suppress the header.
     * @param {Object|null} headerConfig
     * @returns {RouteDefinition}
     */
    header(headerConfig) {
        this.headerConfig = headerConfig;
        return this;
    }

    /**
     * Sets a custom page/document title.
     * @param {string} title
     * @returns {RouteDefinition}
     */
    title(title) {
        this.customTitle = title;
        return this;
    }

    /**
     * Configures this route to redirect to another URI or route name.
     * @param {string} targetUri
     * @returns {RouteDefinition}
     */
    redirectTo(targetUri) {
        this.redirectTarget = this._normalizePath(targetUri);
        return this;
    }

    /**
     * Attaches route-level middleware handlers.
     * @param {...Function} middlewares
     * @returns {RouteDefinition}
     */
    middleware(...middlewares) {
        this.middlewares.push(...middlewares.flat().filter(Boolean));
        return this;
    }

    /**
     * Optional custom onEnter hook callback.
     * @param {Function} callback
     * @returns {RouteDefinition}
     */
    onEnter(callback) {
        this.customOnEnter = callback;
        return this;
    }

    /**
     * Optional custom onLeave hook callback.
     * @param {Function} callback
     * @returns {RouteDefinition}
     */
    onLeave(callback) {
        this.customOnLeave = callback;
        return this;
    }
}

export { RouteDefinition };
