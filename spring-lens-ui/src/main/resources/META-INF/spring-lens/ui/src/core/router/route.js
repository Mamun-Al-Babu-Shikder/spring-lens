import Router from './router.js';
import container from '../container.js';

/**
 * Singleton router instance backing the Route facade.
 */
const defaultRouter = new Router();

/**
 * Static Route Facade.
 * Provides an expressive, fluent API mirroring Laravel's `Route` facade.
 *
 * Examples:
 *   Route.get('/dashboard', [DashboardController, 'index']).view('dashboard/dashboard').name('dashboard');
 *   Route.prefix('bean').group(() => {
 *       Route.get('/definitions', [DefinitionController, 'index']).view('bean/definitions');
 *   });
 *   Route.redirect('/instance', 'instances');
 */
export class Route {

    /**
     * Backward-compatible constructor that returns a Router instance.
     * Allows `new Route({ routes: { ... } })`.
     * @param {Object} [config={}]
     */
    constructor(config = {}) {
        return new Router(config);
    }

    /**
     * Underlying singleton Router instance.
     * @type {Router}
     */
    static get instance() {
        return defaultRouter;
    }

    /**
     * Underlying IoC service container.
     */
    static get container() {
        return container;
    }

    /**
     * Registers a GET route.
     * @param {string} path
     * @param {Array|Object|Function|null} [action=null]
     * @returns {import('./route-definition.js').default}
     */
    static get(path, action = null) {
        return defaultRouter.get(path, action);
    }

    /**
     * Registers a direct view route.
     * @param {string} path
     * @param {string} templatePath
     * @returns {import('./route-definition.js').default}
     */
    static view(path, templatePath) {
        return defaultRouter.view(path, templatePath);
    }

    /**
     * Registers a redirect route.
     * @param {string} fromPath
     * @param {string} toPath
     * @returns {import('./route-definition.js').default}
     */
    static redirect(fromPath, toPath) {
        return defaultRouter.redirect(fromPath, toPath);
    }

    /**
     * Registers a route group.
     * @param {Object} options - { prefix?: string, middleware?: Function|Function[] }
     * @param {Function} callback
     * @returns {Router}
     */
    static group(options, callback) {
        return defaultRouter.group(options, callback);
    }

    /**
     * Creates a route group with a path prefix.
     * @param {string} prefix
     * @returns {{group: Function}}
     */
    static prefix(prefix) {
        return defaultRouter.prefix(prefix);
    }

    /**
     * Creates a route group with shared middlewares.
     * @param {...Function} middlewares
     * @returns {{group: Function}}
     */
    static middleware(...middlewares) {
        return defaultRouter.middleware(...middlewares);
    }

    /**
     * Registers global middleware.
     * @param {...Function} middlewares
     * @returns {Router}
     */
    static use(...middlewares) {
        return defaultRouter.use(...middlewares);
    }

    /**
     * Programmatic navigation.
     * @param {string} path
     * @param {Object} [queryParams=null]
     */
    static to(path, queryParams = null) {
        defaultRouter.navigate(path, queryParams);
    }

    static navigate(path, queryParams = null) {
        defaultRouter.navigate(path, queryParams);
    }

    /**
     * Initializes the router, boots the IoC container and starts listening to hashchange.
     * @param {Object} [config={}]
     */
    static init(config = {}) {
        defaultRouter.init(config);
    }

    /**
     * Alias for Route.init(). Boots the IoC container and starts routing.
     * @param {Object} [config={}]
     */
    static boot(config = {}) {
        this.init(config);
    }

    /**
     * Manually triggers route resolution.
     */
    static resolve() {
        return defaultRouter.resolve();
    }
}

export { Router };
export default Route;
