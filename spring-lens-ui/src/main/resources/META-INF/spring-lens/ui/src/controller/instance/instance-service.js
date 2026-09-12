import httpClient from '../../helper/http-client.js';
import { QueryParam, DomUtils } from '../../helper/index.js';

/**
 * Service encapsulating backend HTTP requests for Bean Instance telemetry,
 * summary metrics, single-instance detail inspection, and AOP proxy metadata.
 */
export class InstanceService {

    /**
     * @param {Object} [endpoints={}] - API endpoints mapping
     */
    constructor(endpoints = {}) {
        this.beanInstanceApi = endpoints.BEAN_INSTANCE;
        this.beanInstanceFindApi = endpoints.FIND_BEAN_INSTANCE;
        this.beanInstanceSummaryApi = endpoints.SUMMARY_BEAN_INSTANCE;
        this.beanInstanceProxyApi = endpoints.PROXY_BEAN_INSTANCE;
    }

    /**
     * Fetches application-wide executive telemetry metrics from the backend.
     *
     * @returns {Promise<Object|null>} Summary metrics object
     */
    async fetchSummaryData() {
        if (!this.beanInstanceSummaryApi) return null;
        return httpClient.get(this.beanInstanceSummaryApi);
    }

    /**
     * Fetches a paginated page of bean instances.
     *
     * @param {Object} queryOptions - Pagination and sort parameters
     * @returns {Promise<Object>} Paginated server response
     */
    async fetchInstanceData(queryOptions = {}) {
        const queryParams = QueryParam.build({
            pageNumber: queryOptions.pageNumber ?? 0,
            pageSize: queryOptions.pageSize ?? 20,
            search: queryOptions.search ?? '',
            sortBy: queryOptions.sortBy ?? 'createdAt',
            sortDir: queryOptions.sortDir ?? 'ASC'
        });

        return httpClient.getWithQuery(
            this.beanInstanceApi,
            queryParams.toString()
        );
    }

    /**
     * Fetches comprehensive details for an individual bean instance.
     *
     * @param {string} contextId - Context ID
     * @param {string} beanName - Full bean name
     * @returns {Promise<Object|null>} Single bean instance details
     */
    async findBeanInstance(contextId, beanName) {
        if (!this.beanInstanceFindApi || !beanName) return null;
        const queryParams = QueryParam.build({ contextId, beanName });
        return httpClient.getWithQuery(
            this.beanInstanceFindApi,
            queryParams.toString()
        );
    }

    /**
     * Fetches AOP and CGLIB proxy metadata for a bean instance.
     *
     * @param {string} contextId - Context ID
     * @param {string} beanName - Full bean name
     * @returns {Promise<Object|null>} AOP Proxy metadata
     */
    async fetchProxyInfo(contextId, beanName) {
        if (!this.beanInstanceProxyApi || !beanName) return null;
        const queryParams = QueryParam.build({ contextId, beanName });
        return httpClient.getWithQuery(
            this.beanInstanceProxyApi,
            queryParams.toString()
        );
    }

    /**
     * Exports bean instance telemetry data as downloadable JSON.
     *
     * @param {string} filename - Target filename
     * @param {Object} reportData - Telemetry report payload
     */
    downloadReport(filename, reportData) {
        DomUtils.downloadJson(filename, reportData);
    }
}
