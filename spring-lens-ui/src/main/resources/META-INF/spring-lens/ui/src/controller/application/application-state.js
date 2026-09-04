import httpClient from '../../client/http-client.js';
import TemplateEngine from '../../utils/template-engine.js';

/**
 * Enterprise Application State & Runtime Context Store.
 * Centralizes health monitoring, application metadata caching, and reactive pub/sub events.
 */
export class ApplicationState {
    /**
     * @param {string|Object} options - Health API endpoint or options object
     * @param {string} [infoApi] - Application info endpoint
     * @param {string} [container='#sidebar-status-container'] - Container selector for status badge
     * @param {number} [intervalMs=10000] - Polling interval in milliseconds
     */
    constructor(options, infoApi, container = '#sidebar-status-container', intervalMs = 10000) {
        if (typeof options === 'object' && options !== null) {
            this.healthApi = options.healthApi || options.health || null;
            this.infoApi = options.infoApi || options.info || null;
            this.container = options.container || '#sidebar-status-container';
            this.intervalMs = options.intervalMs || 10000;
        } else {
            this.healthApi = options || null;
            this.infoApi = infoApi || null;
            this.container = container;
            this.intervalMs = intervalMs;
        }

        this.isLive = null;
        this.appInfo = null;
        this.appName = null;
        this.timer = null;
        this.stateListeners = [];
        this.appInfoListeners = [];
        this._appInfoPromise = null;
        this._visibilityHandler = null;
    }

    /**
     * Subscribe to health state changes.
     * @param {function(boolean):void} callback
     * @returns {function():void} Unsubscribe function
     */
    onStateChange(callback) {
        if (typeof callback === 'function') {
            this.stateListeners.push(callback);
            if (this.isLive !== null) {
                try { callback(this.isLive); } catch (e) { console.error('Error in state listener:', e); }
            }
            return () => {
                this.stateListeners = this.stateListeners.filter(fn => fn !== callback);
            };
        }
        return () => {};
    }

    /**
     * Subscribe to application info updates.
     * @param {function(Object):void} callback
     * @returns {function():void} Unsubscribe function
     */
    onAppInfoChange(callback) {
        if (typeof callback === 'function') {
            this.appInfoListeners.push(callback);
            if (this.appInfo !== null) {
                try { callback(this.appInfo); } catch (e) { console.error('Error in app info listener:', e); }
            }
            return () => {
                this.appInfoListeners = this.appInfoListeners.filter(fn => fn !== callback);
            };
        }
        return () => {};
    }

    /**
     * Updates and caches application metadata, notifying subscribers.
     * @param {Object} info
     */
    setAppInfo(info) {
        if (!info || typeof info !== 'object') return;
        this.appInfo = info;
        if (info.name) {
            this.appName = info.name;
        }

        this.appInfoListeners.forEach(fn => {
            try { fn(info); } catch (e) { console.error('Error in appInfo listener:', e); }
        });
    }

    /**
     * Returns the cached application name or fallback default.
     * @returns {string}
     */
    getAppName() {
        return this.appName || 'SpringLens';
    }

    /**
     * Returns the cached application info.
     * @returns {Object|null}
     */
    getAppInfo() {
        return this.appInfo;
    }

    /**
     * Fetches application metadata asynchronously with request deduplication.
     * @param {boolean} [force=false]
     * @returns {Promise<Object|null>}
     */
    async fetchAppInfo(force = false) {
        if (!force && this.appInfo) {
            return this.appInfo;
        }
        if (!force && this._appInfoPromise) {
            return this._appInfoPromise;
        }
        if (!this.infoApi) {
            return null;
        }

        this._appInfoPromise = httpClient.get(this.infoApi)
            .then(data => {
                this.setAppInfo(data);
                return data;
            })
            .catch(err => {
                console.warn('[ApplicationState] Could not fetch application info:', err);
                return null;
            })
            .finally(() => {
                this._appInfoPromise = null;
            });

        return this._appInfoPromise;
    }

    /**
     * Starts background health polling and tab visibility synchronization.
     * @param {number} [intervalMs]
     */
    start(intervalMs) {
        if (intervalMs) this.intervalMs = intervalMs;
        
        // Initial checks
        this.checkHealth();
        if (this.infoApi) {
            this.fetchAppInfo();
        }
        
        this._startPolling();

        if (!this._visibilityHandler) {
            this._visibilityHandler = () => {
                if (document.hidden) {
                    this._stopPolling();
                } else {
                    this.checkHealth();
                    this._startPolling();
                }
            };
            document.addEventListener('visibilitychange', this._visibilityHandler);
        }
    }

    /**
     * Stops polling and unbinds visibility change handlers.
     */
    stop() {
        this._stopPolling();
        if (this._visibilityHandler) {
            document.removeEventListener('visibilitychange', this._visibilityHandler);
            this._visibilityHandler = null;
        }
    }

    /**
     * Checks application health status against the backend endpoint.
     * @returns {Promise<boolean>}
     */
    async checkHealth() {
        if (!this.healthApi) return false;
        try {
            const data = await httpClient.get(this.healthApi);
            const status = (data?.status || '').toLowerCase();
            const isLive = status === 'up';
            this.render(isLive);
            return isLive;
        } catch (error) {
            this.render(false);
            return false;
        }
    }

    /**
     * Renders health status badge and notifies state subscribers.
     * @param {boolean} isLive
     */
    render(isLive) {
        if (this.isLive === isLive) return;
        this.isLive = isLive;

        const templateId = isLive ? 'tpl-status-connected' : 'tpl-status-disconnected';
        const clone = TemplateEngine.clone(templateId);
        if (clone) {
            $(this.container).empty().append(clone);
        }

        this.stateListeners.forEach(fn => {
            try { fn(isLive); } catch (e) { console.error('Error in state listener:', e); }
        });
    }

    _startPolling() {
        this._stopPolling();
        this.timer = setInterval(() => this.checkHealth(), this.intervalMs);
    }

    _stopPolling() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
}

export default ApplicationState;