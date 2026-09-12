import httpClient from '../../helper/http-client.js';
import { QueryParam } from '../../helper/index.js';

/**
 * Service responsible for HTTP communication with backend Bean Definition endpoints.
 */
export default class DefinitionService {

    /**
     * @param {Object} endpoints
     * @param {string} endpoints.BEAN_DEFINITION
     * @param {string} [endpoints.SUMMARY_BEAN_DEFINITION]
     * @param {string} [endpoints.FIND_BEAN_DEFINITION]
     */
    constructor(endpoints = {}) {
        this.beanDefinitionEndpoint = endpoints.BEAN_DEFINITION;
        this.beanDefinitionSummaryEndpoint = endpoints.SUMMARY_BEAN_DEFINITION;
        this.beanDefinitionSearchEndpoint = endpoints.FIND_BEAN_DEFINITION;
    }

    /**
     * Fetches bean definition summary metrics and distributions.
     * @returns {Promise<Object>}
     */
    async fetchSummary() {
        if (!this.beanDefinitionSummaryEndpoint) return null;
        return httpClient.get(this.beanDefinitionSummaryEndpoint);
    }

    /**
     * Fetches paginated bean definitions based on filter and sorting criteria.
     * @param {Object} criteria
     * @returns {Promise<Object>}
     */
    async fetchTableData(criteria = {}) {
        if (!this.beanDefinitionEndpoint) return { content: [] };

        const queryParams = QueryParam.build({
            pageNumber: Math.max(0, (criteria.currentPage || 1) - 1),
            pageSize: criteria.itemsPerPage || 20,
            search: criteria.searchQuery || undefined,
            contextId: criteria.filterCriteria?.contextId || undefined,
            beanName: criteria.filterCriteria?.beanName || undefined,
            scope: criteria.filterCriteria?.scope || undefined,
            role: criteria.filterCriteria?.role || undefined,
            primary: criteria.filterCriteria?.primary || undefined,
            lazyInit: criteria.filterCriteria?.lazyInit || undefined,
            sortBy: criteria.sortColumn || undefined,
            sortDir: criteria.sortColumn ? (criteria.sortDirection || 'asc').toUpperCase() : undefined
        });

        return httpClient.getWithQuery(this.beanDefinitionEndpoint, queryParams.toString());
    }

    /**
     * Searches a single bean definition by name and contextId.
     * @param {string} beanName
     * @param {string} [contextId]
     * @returns {Promise<Object|null>}
     */
    async findBeanDefinition(beanName, contextId = '') {
        if (!this.beanDefinitionSearchEndpoint || !beanName) return null;

        try {
            const queryParams = QueryParam.build({ contextId, beanName }).toString();
            return await httpClient.getWithQuery(this.beanDefinitionSearchEndpoint, queryParams);
        } catch (err) {
            console.warn('Failed to fetch bean definition details:', beanName, err);
            return null;
        }
    }
}
