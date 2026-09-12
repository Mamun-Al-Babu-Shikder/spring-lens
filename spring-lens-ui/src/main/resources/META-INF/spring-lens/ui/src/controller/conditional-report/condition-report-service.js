import httpClient from '../../helper/http-client.js';
import { QueryParam } from '../../helper/index.js';

/**
 * Service responsible for HTTP communication with backend Condition Report endpoints.
 */
export default class ConditionReportService {

    /**
     * @param {Object} endpoints
     * @param {string} endpoints.CONDITIONAL_REPORTS
     * @param {string} [endpoints.FIND_CONDITIONAL_REPORTS]
     * @param {string} [endpoints.SUMMARY_CONDITIONAL_REPORTS]
     */
    constructor(endpoints = {}) {
        this.conditionEvaluationApiUrl = endpoints.CONDITIONAL_REPORTS;
        this.searchConditionalEvaluationApiUrl = endpoints.FIND_CONDITIONAL_REPORTS;
        this.summaryConditionApiUrl = endpoints.SUMMARY_CONDITIONAL_REPORTS;
    }

    /**
     * Fetches dataset-wide metrics across all auto-configurations.
     * @returns {Promise<Object>}
     */
    async fetchSummary() {
        if (!this.summaryConditionApiUrl) return null;
        return httpClient.get(this.summaryConditionApiUrl);
    }

    /**
     * Alias for fetchSummary for backward compatibility.
     * @returns {Promise<Object>}
     */
    async fetchSummaryMetrics() {
        return this.fetchSummary();
    }

    /**
     * Fetches paginated condition evaluations based on criteria.
     * @param {Object} criteria
     * @param {number} [criteria.pageNumber]
     * @param {number} [criteria.pageSize]
     * @param {string} [criteria.sortBy]
     * @param {string} [criteria.sortDir]
     * @param {string} [criteria.search]
     * @param {string} [criteria.outcome]
     * @returns {Promise<Object>}
     */
    async fetchEvaluations(criteria = {}) {
        if (!this.conditionEvaluationApiUrl) return { content: [] };

        const pageNum = typeof criteria.pageNumber === 'number'
            ? Math.max(0, criteria.pageNumber)
            : Math.max(0, (criteria.page || 1) - 1);

        const params = {
            pageNumber: pageNum,
            pageSize: criteria.pageSize || 10,
            sortBy: criteria.sortBy || 'source',
            sortDir: criteria.sortDir || 'ASC'
        };

        if (criteria.search) {
            params.search = criteria.search;
        }

        if (criteria.outcome) {
            params.outcome = criteria.outcome;
        }

        const query = QueryParam.build(params).toString();
        return httpClient.getWithQuery(this.conditionEvaluationApiUrl, query);
    }

    /**
     * Alias for fetchEvaluations for backward compatibility.
     * @param {Object} criteria
     * @returns {Promise<Object>}
     */
    async fetchConditionEvaluations(criteria = {}) {
        return this.fetchEvaluations(criteria);
    }

    /**
     * Fetches the total count of matching conditions across all outcomes for a search query.
     * @param {string} searchQuery
     * @returns {Promise<number|null>}
     */
    async fetchSearchTotalCount(searchQuery) {
        if (!this.conditionEvaluationApiUrl || !searchQuery) return null;

        try {
            const query = QueryParam.build({
                search: searchQuery,
                pageNumber: 0,
                pageSize: 1
            }).toString();

            const responseData = await httpClient.getWithQuery(this.conditionEvaluationApiUrl, query);
            return responseData?.totalElements ?? null;
        } catch (error) {
            console.warn('Could not fetch all-outcomes count for search query:', error);
            return null;
        }
    }

    /**
     * Fetches a single condition evaluation snapshot by contextId and source.
     * @param {string} contextId
     * @param {string} source
     * @returns {Promise<Object|null>}
     */
    async fetchSingleCondition(contextId, source) {
        if (!this.searchConditionalEvaluationApiUrl || !contextId || !source) return null;

        try {
            const query = QueryParam.build({ contextId, source }).toString();
            return await httpClient.getWithQuery(this.searchConditionalEvaluationApiUrl, query);
        } catch (err) {
            console.warn('Could not fetch single condition snapshot:', err);
            return null;
        }
    }

    /**
     * Alias for fetchSingleCondition for backward compatibility.
     * @param {string} contextId
     * @param {string} source
     * @returns {Promise<Object|null>}
     */
    async findConditionEvaluation(contextId, source) {
        return this.fetchSingleCondition(contextId, source);
    }
}
