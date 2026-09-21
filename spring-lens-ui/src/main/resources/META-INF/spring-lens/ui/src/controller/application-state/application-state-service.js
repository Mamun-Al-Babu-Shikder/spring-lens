import httpClient from '../../helper/http-client.js';

/**
 * Service responsible for HTTP requests related to application health and info.
 */
export default class ApplicationStateService {

    /**
     * @param {Object} options
     * @param {string} [options.healthApi]
     * @param {string} [options.infoApi]
     */
    constructor({ healthApi, infoApi } = {}) {
        this.healthApi = healthApi;
        this.infoApi = infoApi;
        this._appInfoPromise = null;
    }

    /**
     * Checks health endpoint status.
     * @returns {Promise<boolean>} Resolves to true if health status is 'up'.
     */
    async checkHealth() {
        if (!this.healthApi) return false;

        try {
            const data = await httpClient.get(this.healthApi);
            const status = (data?.status || '').toLowerCase();
            return status === 'up';
        } catch (error) {
            return false;
        }
    }

    /**
     * Fetches application info payload, deduplicating concurrent in-flight requests.
     * @returns {Promise<Object|null>}
     */
    async fetchAppInfo() {
        if (!this.infoApi) return null;

        if (this._appInfoPromise) {
            return this._appInfoPromise;
        }

        this._appInfoPromise = httpClient.get(this.infoApi)
            .catch(err => {
                console.warn('[ApplicationStateService] Could not fetch application info:', err);
                return null;
            })
            .finally(() => {
                this._appInfoPromise = null;
            });

        return this._appInfoPromise;
    }
}
