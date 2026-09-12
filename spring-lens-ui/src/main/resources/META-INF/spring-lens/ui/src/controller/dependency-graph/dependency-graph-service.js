import { httpClient, beanDataStore, QueryParam } from '../../helper/index.js';

/**
 * Service handling remote API communication and caching for the Dependency Graph.
 */
export class DependencyGraphService {

    /**
     * @param {Object} [endpoints] - API endpoints mapping
     */
    constructor(endpoints = {}) {
        this.dependencyGraphApi = endpoints.GRAPH_DEPENDENCIES;
        this.beanDefinitions = endpoints.BEAN_DEFINITION;
        this.findBeanDefinitionsApi = endpoints.FIND_BEAN_DEFINITION;

        this.totalElements = 0;
        this.beanDependencies = null;
        this.accumulatedBeans = [];
        this.beanDetailsCache = new Map();
        this.isLoadingRemaining = false;
    }

    /**
     * Fetches all bean graph dependencies across all pages from the server.
     * Updates beanDataStore incrementally and reports progress via callback.
     *
     * @param {Function} [onProgress] - Optional callback ({ loaded, total, isComplete, hasError, errorMsg })
     * @returns {Promise<Array<Object>>} Accumulated bean definitions
     */
    async fetchBeanGraphDependencies(onProgress) {
        onProgress?.({ loaded: 0, total: 0, isComplete: false });

        try {
            const searchParams = QueryParam.build({ pageNumber: 0, pageSize: 1000 }).toString();
            const serverResponse = await httpClient.getWithQuery(this.dependencyGraphApi, searchParams);
            this.beanDependencies = serverResponse;

            const initialBeanDefinitions = Array.isArray(serverResponse)
                ? serverResponse
                : (serverResponse?.content ?? []);

            this.accumulatedBeans = [...initialBeanDefinitions];
            this.totalElements = serverResponse?.totalElements ?? initialBeanDefinitions.length;

            beanDataStore.addBeans(initialBeanDefinitions);

            const totalPages = serverResponse?.totalPages ?? 1;
            if (!Array.isArray(serverResponse) && !serverResponse?.last && totalPages > 1) {
                this.isLoadingRemaining = true;
                for (let targetPageIndex = 1; targetPageIndex < totalPages; targetPageIndex++) {
                    const pageParams = QueryParam.build({ pageNumber: targetPageIndex, pageSize: 1000 }).toString();
                    const fetchedPagePayload = await httpClient.getWithQuery(this.dependencyGraphApi, pageParams);
                    const fetchedBeans = fetchedPagePayload?.content ?? [];
                    if (fetchedBeans.length === 0) break;

                    this.accumulatedBeans.push(...fetchedBeans);
                    beanDataStore.addBeans(fetchedBeans);

                    onProgress?.({
                        loaded: this.accumulatedBeans.length,
                        total: this.totalElements,
                        isComplete: false
                    });
                }
                this.isLoadingRemaining = false;
            }

            onProgress?.({
                loaded: this.accumulatedBeans.length,
                total: this.totalElements,
                isComplete: true
            });

            return this.accumulatedBeans;
        } catch (error) {
            onProgress?.({
                loaded: this.accumulatedBeans.length,
                total: this.totalElements,
                hasError: true,
                errorMsg: error.message
            });
            throw error;
        }
    }

    /**
     * Fetches comprehensive details for a specific bean, with caching.
     *
     * @param {string} contextId - Context ID
     * @param {string} beanName - Full bean name
     * @returns {Promise<Object|null>} Bean details object
     */
    async fetchBeanDetails(contextId, beanName) {
        if (!beanName || !contextId) return null;

        const cacheKey = `${contextId}:${beanName}`;
        if (this.beanDetailsCache.has(cacheKey)) {
            return this.beanDetailsCache.get(cacheKey);
        }

        try {
            const queryParams = QueryParam.build({ contextId, beanName }).toString();
            const beanDetails = await httpClient.getWithQuery(this.findBeanDefinitionsApi, queryParams);
            if (!beanDetails) return null;

            this.beanDetailsCache.set(cacheKey, beanDetails);
            beanDataStore.addBeans([beanDetails]);
            return beanDetails;
        } catch (error) {
            console.warn(`Error fetching bean details for ${beanName}:`, error);
            this.beanDetailsCache.set(cacheKey, null);
            return null;
        }
    }

    /**
     * Queries the bean definitions endpoint for matching bean names.
     *
     * @param {string} query - Search query
     * @param {number} [pageSize=12] - Result page size
     * @returns {Promise<Array<Object>>} Matching bean items
     */
    async searchBeansApi(query, pageSize = 12) {
        const queryParams = QueryParam.build({
            search: query,
            pageSize
        }).toString();

        const response = await httpClient.getWithQuery(this.beanDefinitions, queryParams);
        return response?.content ?? (Array.isArray(response) ? response : []);
    }

    /**
     * Clears cached details and accumulated beans.
     */
    clearCache() {
        this.beanDetailsCache.clear();
        this.accumulatedBeans = [];
        this.totalElements = 0;
        this.beanDependencies = null;
    }
}
