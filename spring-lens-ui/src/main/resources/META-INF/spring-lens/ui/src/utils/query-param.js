/**
 * Utility class for constructing and parsing URL search query parameters.
 */
export default class QueryParam {

    /**
     * Builds URLSearchParams omitting empty/null/undefined values.
     * @param {Object} rawParams
     * @returns {URLSearchParams}
     */
    static build(rawParams) {
        if (!rawParams) return new URLSearchParams();

        const cleanEntries = Object.entries(rawParams).filter(
            ([_, value]) =>
                value !== ''
                && value !== null
                && value !== undefined);

        return new URLSearchParams(cleanEntries);
    }

    /**
     * Parses URLSearchParams from a URLSearchParams instance, string, or current window hash.
     * @param {URLSearchParams|string|null} [params]
     * @returns {URLSearchParams}
     */
    static parse(params) {
        if (params instanceof URLSearchParams) return params;
        if (typeof params === 'string') {
            const queryStr = params.includes('?') ? params.split('?')[1] : params;
            return new URLSearchParams(queryStr);
        }
        const hash = window.location.hash || '';
        const hashQuery = hash.includes('?') ? hash.split('?')[1] : '';
        return new URLSearchParams(hashQuery);
    }

    /**
     * Gets the first non-empty value matching any of the provided candidate keys.
     * @param {URLSearchParams|string|null} params
     * @param {...string} keys
     * @returns {string|null}
     */
    static get(params, ...keys) {
        const searchParams = this.parse(params);
        for (const key of keys) {
            const val = searchParams.get(key);
            if (val !== null && val !== undefined && val !== '') {
                return val;
            }
        }
        return null;
    }
}
