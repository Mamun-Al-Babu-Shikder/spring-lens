/**
 * Robust HTTP client wrapper around the Fetch API.
 * Features:
 * - Configurable request timeouts via AbortController
 * - Automatic query string serialization
 * - Structured Spring Boot error payload parsing
 * - Standard HTTP verb helpers (GET, POST, PUT, DELETE)
 */
export class HttpClient {

    /**
     * @param {Object} [config]
     * @param {number} [config.timeoutMs=15000] Default timeout in milliseconds
     * @param {Object} [config.headers={}] Default request headers
     */
    constructor({ timeoutMs = 15000, headers = {} } = {}) {
        this.defaultTimeoutMs = timeoutMs;
        this.defaultHeaders = {
            'Accept': 'application/json',
            ...headers
        };
    }

    /**
     * Core execution pipeline with timeout and rich error extraction.
     * @param {string} url
     * @param {Object} [options={}]
     * @returns {Promise<any>}
     */
    async request(url, options = {}) {
        const {
            timeout = this.defaultTimeoutMs,
            headers = {},
            signal: userSignal,
            ...fetchOptions
        } = options;

        const controller = new AbortController();
        const timeoutId = timeout > 0 ? setTimeout(() => controller.abort(), timeout) : null;

        // Propagate external abort signal if provided
        if (userSignal) {
            userSignal.addEventListener('abort', () => controller.abort(), { once: true });
        }

        try {
            const response = await fetch(url, {
                ...fetchOptions,
                headers: {
                    ...this.defaultHeaders,
                    ...headers
                },
                signal: controller.signal
            });

            if (!response.ok) {
                let errorDetails = null;
                let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

                try {
                    const contentType = response.headers.get('content-type') || '';
                    if (contentType.includes('application/json')) {
                        errorDetails = await response.json();
                        if (errorDetails?.message) {
                            errorMessage = errorDetails.message;
                        } else if (errorDetails?.error) {
                            errorMessage = errorDetails.error;
                        }
                    }
                } catch (_) {
                    // Ignore JSON parsing errors for error bodies
                }

                const error = new Error(errorMessage);
                error.status = response.status;
                error.statusText = response.statusText;
                error.details = errorDetails;
                error.url = url;
                throw error;
            }

            // Return null for 204 No Content
            if (response.status === 204) {
                return null;
            }

            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                return await response.json();
            }

            return await response.text();
        } catch (err) {
            if (err.name === 'AbortError') {
                const timeoutError = new Error(`Request timed out after ${timeout}ms: ${url}`);
                timeoutError.name = 'TimeoutError';
                timeoutError.status = 408;
                throw timeoutError;
            }
            throw err;
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
        }
    }

    /**
     * Performs a GET request with optional query parameters object or string.
     * @param {string} endpointUrl
     * @param {Object|string} [paramsOrOptions] Plain query params object, query string, or request options
     * @param {Object} [options] Request options if params are passed as second argument
     * @returns {Promise<any>}
     */
    async get(endpointUrl, paramsOrOptions, options = {}) {
        let finalUrl = endpointUrl;
        let requestOptions = options;

        if (paramsOrOptions) {
            // If second argument is a string (e.g. query string)
            if (typeof paramsOrOptions === 'string') {
                const separator = finalUrl.includes('?') ? '&' : '?';
                finalUrl = `${finalUrl}${separator}${paramsOrOptions}`;
            } else if (paramsOrOptions instanceof URLSearchParams) {
                const qs = paramsOrOptions.toString();
                if (qs) {
                    const separator = finalUrl.includes('?') ? '&' : '?';
                    finalUrl = `${finalUrl}${separator}${qs}`;
                }
            } else if (typeof paramsOrOptions === 'object') {
                // Check if it looks like options (contains method, headers, timeout, signal)
                const isOptions = 'timeout' in paramsOrOptions || 'headers' in paramsOrOptions || 'signal' in paramsOrOptions;
                if (isOptions && !Object.keys(options).length) {
                    requestOptions = paramsOrOptions;
                } else {
                    // Treat as query params object
                    const searchParams = new URLSearchParams();
                    Object.entries(paramsOrOptions).forEach(([key, val]) => {
                        if (val !== null && val !== undefined && val !== '') {
                            searchParams.append(key, String(val));
                        }
                    });
                    const qs = searchParams.toString();
                    if (qs) {
                        const separator = finalUrl.includes('?') ? '&' : '?';
                        finalUrl = `${finalUrl}${separator}${qs}`;
                    }
                }
            }
        }

        return this.request(finalUrl, { ...requestOptions, method: 'GET' });
    }

    /**
     * Preserves exact backward-compatible signature for legacy calls.
     * @param {string} baseUrl
     * @param {string|URLSearchParams|Object} queryParams
     * @param {Object} [options]
     * @returns {Promise<any>}
     */
    async getWithQuery(baseUrl, queryParams, options = {}) {
        let queryString = '';
        if (typeof queryParams === 'string') {
            queryString = queryParams;
        } else if (queryParams instanceof URLSearchParams) {
            queryString = queryParams.toString();
        } else if (queryParams && typeof queryParams === 'object') {
            const searchParams = new URLSearchParams();
            Object.entries(queryParams).forEach(([key, val]) => {
                if (val !== null && val !== undefined && val !== '') {
                    searchParams.append(key, String(val));
                }
            });
            queryString = searchParams.toString();
        }

        const requestUrl = queryString ? `${baseUrl}?${queryString}` : baseUrl;
        return this.request(requestUrl, { ...options, method: 'GET' });
    }

    /**
     * Performs a POST request.
     * @param {string} endpointUrl
     * @param {any} [body]
     * @param {Object} [options={}]
     * @returns {Promise<any>}
     */
    async post(endpointUrl, body = null, options = {}) {
        const headers = { ...options.headers };
        let serializedBody = body;

        if (body && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof Blob)) {
            headers['Content-Type'] = headers['Content-Type'] || 'application/json';
            serializedBody = JSON.stringify(body);
        }

        return this.request(endpointUrl, {
            ...options,
            method: 'POST',
            headers,
            body: serializedBody
        });
    }

    /**
     * Performs a PUT request.
     * @param {string} endpointUrl
     * @param {any} [body]
     * @param {Object} [options={}]
     * @returns {Promise<any>}
     */
    async put(endpointUrl, body = null, options = {}) {
        const headers = { ...options.headers };
        let serializedBody = body;

        if (body && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof Blob)) {
            headers['Content-Type'] = headers['Content-Type'] || 'application/json';
            serializedBody = JSON.stringify(body);
        }

        return this.request(endpointUrl, {
            ...options,
            method: 'PUT',
            headers,
            body: serializedBody
        });
    }

    /**
     * Performs a DELETE request.
     * @param {string} endpointUrl
     * @param {Object} [options={}]
     * @returns {Promise<any>}
     */
    async delete(endpointUrl, options = {}) {
        return this.request(endpointUrl, { ...options, method: 'DELETE' });
    }
}

const httpClient = new HttpClient();
export default httpClient;