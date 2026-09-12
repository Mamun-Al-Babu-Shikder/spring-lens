/**
 * Asynchronous Utilities and Timing Helpers.
 */
export class AsyncUtils {

    /**
     * Debounces function invocation with cancel and flush capabilities.
     * @param {Function} fn - Target function to execute
     * @param {number} [delay=180] - Milliseconds to delay
     * @returns {Function & { cancel: Function, flush: Function }}
     */
    static debounce(fn, delay = 180) {
        let timeoutId = null;
        let lastArgs = null;
        let lastThis = null;

        const debounced = function (...args) {
            lastArgs = args;
            lastThis = this;

            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            timeoutId = setTimeout(() => {
                fn.apply(lastThis, lastArgs);
                timeoutId = null;
                lastArgs = null;
                lastThis = null;
            }, delay);
        };

        debounced.cancel = () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
                lastArgs = null;
                lastThis = null;
            }
        };

        debounced.flush = () => {
            if (timeoutId && lastArgs) {
                clearTimeout(timeoutId);
                fn.apply(lastThis, lastArgs);
                timeoutId = null;
                lastArgs = null;
                lastThis = null;
            }
        };

        return debounced;
    }

    /**
     * Throttles function invocation to at most once every `limit` milliseconds.
     * Guarantees trailing edge execution.
     * @param {Function} fn
     * @param {number} [limit=100]
     * @returns {Function & { cancel: Function }}
     */
    static throttle(fn, limit = 100) {
        let lastFunc;
        let lastRan;

        const throttled = function (...args) {
            const context = this;
            if (!lastRan) {
                fn.apply(context, args);
                lastRan = Date.now();
            } else {
                clearTimeout(lastFunc);
                lastFunc = setTimeout(() => {
                    if (Date.now() - lastRan >= limit) {
                        fn.apply(context, args);
                        lastRan = Date.now();
                    }
                }, Math.max(0, limit - (Date.now() - lastRan)));
            }
        };

        throttled.cancel = () => {
            clearTimeout(lastFunc);
            lastRan = null;
        };

        return throttled;
    }

    /**
     * Promisified delay / sleep.
     * @param {number} ms
     * @returns {Promise<void>}
     */
    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
export default AsyncUtils;
