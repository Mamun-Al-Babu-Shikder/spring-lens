/**
 * Event emitter responsible for managing observer subscriptions and notifying listeners
 * of application state and info changes with error boundaries.
 */
export default class StateEmitter {

    constructor() {
        this.stateListeners = [];
        this.appInfoListeners = [];
    }

    /**
     * Subscribes to live health state transitions.
     * @param {Function} callback
     * @param {boolean|null} currentState
     * @returns {Function} Unsubscribe function.
     */
    onStateChange(callback, currentState = null) {
        if (typeof callback !== 'function') return () => {};

        this.stateListeners.push(callback);
        if (currentState !== null) {
            this._safeCall(callback, currentState, 'initial state listener');
        }

        return () => {
            this.stateListeners = this.stateListeners.filter(fn => fn !== callback);
        };
    }

    /**
     * Subscribes to application info updates.
     * @param {Function} callback
     * @param {Object|null} currentAppInfo
     * @returns {Function} Unsubscribe function.
     */
    onAppInfoChange(callback, currentAppInfo = null) {
        if (typeof callback !== 'function') return () => {};

        this.appInfoListeners.push(callback);
        if (currentAppInfo !== null) {
            this._safeCall(callback, currentAppInfo, 'initial appInfo listener');
        }

        return () => {
            this.appInfoListeners = this.appInfoListeners.filter(fn => fn !== callback);
        };
    }

    /**
     * Dispatches current health state to all registered subscribers.
     * @param {boolean} isLive
     */
    emitState(isLive) {
        this.stateListeners.forEach(fn => {
            this._safeCall(fn, isLive, 'state listener');
        });
    }

    /**
     * Dispatches current app info to all registered subscribers.
     * @param {Object} info
     */
    emitAppInfo(info) {
        this.appInfoListeners.forEach(fn => {
            this._safeCall(fn, info, 'appInfo listener');
        });
    }

    /**
     * Clears all registered listeners.
     */
    clear() {
        this.stateListeners = [];
        this.appInfoListeners = [];
    }

    /**
     * @private
     */
    _safeCall(fn, payload, context) {
        try {
            fn(payload);
        } catch (error) {
            console.error(`Error in ${context}:`, error);
        }
    }
}
