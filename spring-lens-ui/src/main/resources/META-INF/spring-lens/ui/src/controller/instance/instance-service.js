import httpClient from '../../helper/http-client.js';
import { QueryParam, DomUtils } from '../../helper/index.js';

export class InstanceService {
    constructor(endpoints = {}) {
        this.beanInstanceApi = endpoints.BEAN_INSTANCE;
        this.beanInstanceFindApi = endpoints.FIND_BEAN_INSTANCE;
        this.beanInstanceSummaryApi = endpoints.SUMMARY_BEAN_INSTANCE;
        this.beanInstanceProxyApi = endpoints.PROXY_BEAN_INSTANCE;
    }

    async fetchSummaryData() {
        if (!this.beanInstanceSummaryApi) return null;
        return httpClient.get(this.beanInstanceSummaryApi);
    }

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

    async findBeanInstance(contextId, beanName) {
        if (!this.beanInstanceFindApi || !beanName) return null;
        const queryParams = QueryParam.build({ contextId, beanName });
        return httpClient.getWithQuery(
            this.beanInstanceFindApi,
            queryParams.toString()
        );
    }

    async fetchProxyInfo(contextId, beanName) {
        if (!this.beanInstanceProxyApi || !beanName) return null;
        const queryParams = QueryParam.build({ contextId, beanName });
        return httpClient.getWithQuery(
            this.beanInstanceProxyApi,
            queryParams.toString()
        );
    }

    downloadReport(filename, reportData) {
        DomUtils.downloadJson(filename, reportData);
    }
}
