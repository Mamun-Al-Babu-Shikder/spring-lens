/**
 * Polling coordinator responsible for scheduling periodic health checks
 * and handling browser tab visibility lifecycle (pausing when hidden, resuming when visible).
 */
export default class HealthPoller {

    /**
     * @param {Object} options
     * @param {Function} options.onCheck - Callback invoked on each poll tick.
     * @param {number} [options.intervalMs] - Polling interval in milliseconds.
     */
    constructor({ onCheck, intervalMs = 10000 } = {}) {
        this.onCheck = onCheck;
        this.intervalMs = intervalMs;
        this.timer = null;
        this._visibilityHandler = null;
    }

    /**
     * Starts periodic health check polling and registers visibility change handler.
     * @param {number} [intervalMs]
     */
    start(intervalMs) {
        if (intervalMs) this.intervalMs = intervalMs;

        this._startPolling();
        this._bindVisibilityHandler();
    }

    /**
     * Stops polling and unbinds visibility listener.
     */
    stop() {
        this._stopPolling();
        this._unbindVisibilityHandler();
    }

    /**
     * Cleans up all timer and event resources.
     */
    destroy() {
        this.stop();
        this.onCheck = null;
    }

    /**
     * @private
     */
    _startPolling() {
        this._stopPolling();
        this.timer = setInterval(() => {
            this.onCheck?.();
        }, this.intervalMs);
    }

    /**
     * @private
     */
    _stopPolling() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    /**
     * @private
     */
    _bindVisibilityHandler() {
        if (this._visibilityHandler) return;

        this._visibilityHandler = () => {
            if (document.hidden) {
                this._stopPolling();
            } else {
                this.onCheck?.();
                this._startPolling();
            }
        };

        document.addEventListener('visibilitychange', this._visibilityHandler);
    }

    /**
     * @private
     */
    _unbindVisibilityHandler() {
        if (this._visibilityHandler) {
            document.removeEventListener('visibilitychange', this._visibilityHandler);
            this._visibilityHandler = null;
        }
    }
}
