import BaseController from '../base-controller.js';
import {
    ApplicationStateService,
    StateEmitter,
    StatusIndicatorWidget,
    HealthPoller
} from './index.js';

/**
 * Central Application State Manager & Controller.
 * Coordinates connection health monitoring, application runtime metadata,
 * reactive observer subscriptions, and the sidebar status indicator widget.
 */
export class ApplicationStateController extends BaseController {

    /**
     * @param {Object} options
     * @param {string} [options.healthApi] - Health check endpoint URL.
     * @param {string} [options.infoApi] - Application info endpoint URL.
     * @param {string} [options.container] - Status indicator container selector.
     * @param {number} [options.intervalMs] - Polling interval in ms (default: 10000).
     */
    constructor({ infoApi, container = '#sidebar-status-container', healthApi, intervalMs = 10000 } = {}) {
        super('applicationState');
        this.infoApi = infoApi;
        this.container = container;
        this.healthApi = healthApi;
        this.intervalMs = intervalMs;

        this.isLive = null;
        this.appInfo = null;
        this.appName = null;

        // Sub-modules
        this.service = new ApplicationStateService({ healthApi, infoApi });
        this.emitter = new StateEmitter();
        this.statusWidget = new StatusIndicatorWidget({ container: this.container });
        this.poller = new HealthPoller({
            onCheck: () => this.checkHealth(),
            intervalMs: this.intervalMs
        });

        this.addDisposable(this.poller);
    }

    /**
     * Subscribes to connection health state changes.
     * @param {Function} callback - Invoked with (isLive: boolean).
     * @returns {Function} Unsubscribe function.
     */
    onStateChange(callback) {
        return this.emitter.onStateChange(callback, this.isLive);
    }

    /**
     * Subscribes to application metadata changes.
     * @param {Function} callback - Invoked with (appInfo: Object).
     * @returns {Function} Unsubscribe function.
     */
    onAppInfoChange(callback) {
        return this.emitter.onAppInfoChange(callback, this.appInfo);
    }

    /**
     * Updates application metadata and notifies subscribers.
     * @param {Object} info
     */
    setAppInfo(info) {
        if (!info || typeof info !== 'object') return;
        this.appInfo = info;
        if (info.name) {
            this.appName = info.name;
        }
        this.emitter.emitAppInfo(info);
    }

    /**
     * Returns the cached application name or fallback.
     * @returns {string}
     */
    getAppName() {
        return this.appName || 'SpringLens';
    }

    /**
     * Returns the cached application info payload.
     * @returns {Object|null}
     */
    getAppInfo() {
        return this.appInfo;
    }

    /**
     * Fetches application info from the backend with optional force bypass of cache.
     * @param {boolean} [force=false]
     * @returns {Promise<Object|null>}
     */
    async fetchAppInfo(force = false) {
        if (!force && this.appInfo) {
            return this.appInfo;
        }

        const data = await this.service.fetchAppInfo();
        if (data) {
            this.setAppInfo(data);
        }
        return data;
    }

    /**
     * Starts continuous health polling and tab visibility coordination.
     * @param {number} [intervalMs]
     */
    start(intervalMs) {
        if (intervalMs) this.intervalMs = intervalMs;

        this.checkHealth();
        if (this.infoApi) {
            this.fetchAppInfo();
        }

        this.poller.start(this.intervalMs);
    }

    /**
     * Stops continuous health polling.
     */
    stop() {
        this.poller.stop();
    }

    /**
     * Performs a single health check request and updates status.
     * @returns {Promise<boolean>}
     */
    async checkHealth() {
        if (!this.healthApi) return false;

        const isLive = await this.service.checkHealth();
        this.render(isLive);
        return isLive;
    }

    /**
     * Updates current connection state, renders UI badge, and notifies observers.
     * @param {boolean} isLive
     */
    render(isLive) {
        if (this.isLive === isLive) return;
        this.isLive = isLive;

        this.statusWidget.render(isLive);
        this.emitter.emitState(isLive);
    }
}

export default ApplicationStateController;
