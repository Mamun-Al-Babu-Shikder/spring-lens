import ENDPOINTS from '../helper/api-endpoints.js';
import { ApplicationStateController } from '../controller/index.js';
import ThemeManager from './theme-manager.js';
import PageHeader from '../helper/page-header.js';
import { InstanceService } from '../controller/instance/index.js';
import { DashboardService } from '../controller/dashboard/index.js';
import { DefinitionService } from '../controller/definition/index.js';
import { DependencyGraphService } from '../controller/dependency-graph/index.js';
import { ConditionReportService } from '../controller/conditional-report/index.js';

/**
 * Enterprise IoC Service Container.
 * Manages service singletons, dependency resolution, and auto-wiring for controllers.
 * Inspired by Laravel's Illuminate\Container\Container.
 */
export class Container {
    constructor() {
        this._bindings = new Map();
        this._instances = new Map();
        this._booted = false;

        // Register default core infrastructure
        this.instance('endpoints', ENDPOINTS);
        this.singleton('applicationState', () => {
            const endpoints = this.make('endpoints') || ENDPOINTS;
            return new ApplicationStateController({
                healthApi: endpoints.APPLICATION_HEALTH,
                infoApi: endpoints.APPLICATION_INFO
            });
        });
        this.singleton('instanceService', () => {
            const endpoints = this.make('endpoints') || ENDPOINTS;
            return new InstanceService(endpoints);
        });
        this.singleton('dashboardService', () => {
            const endpoints = this.make('endpoints') || ENDPOINTS;
            return new DashboardService(endpoints);
        });
        this.singleton('definitionService', () => {
            const endpoints = this.make('endpoints') || ENDPOINTS;
            return new DefinitionService(endpoints);
        });
        this.singleton('dependencyGraphService', () => {
            const endpoints = this.make('endpoints') || ENDPOINTS;
            return new DependencyGraphService(endpoints);
        });
        this.singleton('conditionService', () => {
            const endpoints = this.make('endpoints') || ENDPOINTS;
            return new ConditionReportService(endpoints);
        });
    }

    /**
     * Registers an existing instance into the container.
     * @param {string|Function} abstract
     * @param {*} instance
     * @returns {*}
     */
    instance(abstract, instance) {
        this._instances.set(abstract, instance);
        return instance;
    }

    /**
     * Registers a service binding / factory.
     * @param {string|Function} abstract
     * @param {Function} factory
     * @param {boolean} [singleton=true]
     */
    bind(abstract, factory, singleton = true) {
        this._bindings.set(abstract, { factory, singleton });
    }

    /**
     * Registers a singleton service binding.
     * @param {string|Function} abstract
     * @param {Function} factory
     */
    singleton(abstract, factory) {
        this.bind(abstract, factory, true);
    }

    /**
     * Resolves an instance from the container with auto-wiring.
     * If abstract is a Class constructor, it automatically instantiates it with
     * (endpoints, applicationState, container) and caches it as a singleton.
     * @param {string|Function|Object} abstract
     * @returns {*}
     */
    make(abstract) {
        if (!abstract) return null;

        // 1. If it's already an instantiated object (not a function/class), return as-is
        if (typeof abstract === 'object') {
            return abstract;
        }

        // 2. Return existing singleton instance if available
        if (this._instances.has(abstract)) {
            return this._instances.get(abstract);
        }

        // 3. Resolve from custom factory binding
        if (this._bindings.has(abstract)) {
            const { factory, singleton } = this._bindings.get(abstract);
            const resolved = factory(this);
            if (singleton) {
                this._instances.set(abstract, resolved);
            }
            return resolved;
        }

        // 4. If abstract is a Class / constructor function, auto-wire dependencies
        if (typeof abstract === 'function') {
            const endpoints = this.make('endpoints');
            const applicationState = this.make('applicationState');

            // Auto-instantiate passing (endpoints, applicationState, container)
            const instance = new abstract(endpoints, applicationState, this);
            this._instances.set(abstract, instance);
            return instance;
        }

        return null;
    }

    /**
     * Boots default background services (ApplicationState, PageHeader, ThemeManager).
     * Guaranteed to execute only once.
     */
    boot() {
        if (this._booted) return;
        this._booted = true;

        // 1. Resolve & Start ApplicationState
        const appState = this.make('applicationState');

        // 2. Initialize PageHeader with ApplicationState
        PageHeader.init(appState);

        // 3. Start Health Monitoring
        appState.start(10000);

        // 4. Initialize Global Theme Management
        ThemeManager.init('#theme-toggle');
    }
}

const container = new Container();
export { container };
export default container;
