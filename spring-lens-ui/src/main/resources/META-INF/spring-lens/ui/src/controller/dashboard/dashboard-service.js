import httpClient from '../../helper/http-client.js';
import { QueryParam } from '../../helper/index.js';

/**
 * Service responsible for fetching dashboard telemetry, metrics, and search data.
 */
export default class DashboardService {

    /**
     * @param {Object} endpoints - Mapping of API endpoints.
     */
    constructor(endpoints = {}) {
        this.endpoints = {
            application: endpoints.APPLICATION_INFO,
            definitions: endpoints.BEAN_DEFINITION,
            instances: endpoints.BEAN_INSTANCE,
            conditions: endpoints.CONDITIONAL_REPORTS,
            dependencies: endpoints.GRAPH_DEPENDENCIES,
            definitionsSummary: endpoints.SUMMARY_BEAN_DEFINITION
        };
    }

    /**
     * Fetches application runtime information.
     * @returns {Promise<Object>}
     */
    async fetchApplicationInfo() {
        if (!this.endpoints.application) return null;
        return httpClient.get(this.endpoints.application);
    }

    /**
     * Fetches bean definitions summary metrics.
     * @returns {Promise<Object>}
     */
    async fetchDefinitionsSummary() {
        if (!this.endpoints.definitionsSummary) return null;
        return httpClient.get(this.endpoints.definitionsSummary);
    }

    /**
     * Fetches runtime bean instances sorted by startup initialization latency.
     * @param {Object} [options]
     * @returns {Promise<Object>}
     */
    async fetchInstances(options = {}) {
        if (!this.endpoints.instances) return null;
        const { pageSize = 100, sortBy = 'initDurationNanos', sortDir = 'DESC' } = options;
        const query = QueryParam.build({ pageSize, sortBy, sortDir }).toString();
        return httpClient.getWithQuery(this.endpoints.instances, query);
    }

    /**
     * Fetches auto-configuration condition reports.
     * @param {Object} [options]
     * @returns {Promise<Object>}
     */
    async fetchConditions(options = {}) {
        if (!this.endpoints.conditions) return null;
        const { pageSize = 100 } = options;
        const query = QueryParam.build({ pageSize }).toString();
        return httpClient.getWithQuery(this.endpoints.conditions, query);
    }

    /**
     * Fetches bean dependency graph data.
     * @param {Object} [options]
     * @returns {Promise<Object>}
     */
    async fetchDependencies(options = {}) {
        if (!this.endpoints.dependencies) return null;
        const { pageSize = 100 } = options;
        const query = QueryParam.build({ pageSize }).toString();
        return httpClient.getWithQuery(this.endpoints.dependencies, query);
    }

    /**
     * Searches bean definitions for quick search bar.
     * @param {string} query
     * @param {Object} [options]
     * @returns {Promise<Object>}
     */
    async searchDefinitions(query, options = {}) {
        if (!this.endpoints.definitions || !query) return { content: [] };
        const { pageSize = 9 } = options;
        const queryParams = QueryParam.build({
            search: query,
            pageSize
        }).toString();
        return httpClient.getWithQuery(this.endpoints.definitions, queryParams);
    }

    /**
     * Executes parallel loading of all dashboard datasets using Promise.allSettled.
     * @param {Object} callbacks
     * @returns {Promise<void>}
     */
    async fetchAll(callbacks = {}) {
        const {
            onApplicationInfo,
            onApplicationFallback,
            onDefinitionsSummary,
            onInstances,
            onConditions,
            onDependencies
        } = callbacks;

        await Promise.allSettled([
            this.fetchApplicationInfo()
                .then(data => onApplicationInfo?.(data))
                .catch(err => {
                    console.warn('Could not fetch Application Info:', err);
                    onApplicationFallback?.();
                }),

            this.fetchDefinitionsSummary()
                .then(data => onDefinitionsSummary?.(data)),

            this.fetchInstances()
                .then(data => onInstances?.(data)),

            this.fetchConditions()
                .then(data => onConditions?.(data)),

            this.fetchDependencies()
                .then(data => onDependencies?.(data))
        ]);
    }
}
