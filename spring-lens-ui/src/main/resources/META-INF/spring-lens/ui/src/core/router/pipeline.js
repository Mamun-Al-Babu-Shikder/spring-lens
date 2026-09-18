/**
 * Asynchronous Middleware Pipeline.
 * Executes a sequence of middleware handlers `(context, next) => ...`
 * prior to dispatching the matched route and controller action.
 */
export default class Pipeline {

    constructor(middlewares = []) {
        this.middlewares = [...middlewares];
    }

    /**
     * Appends middleware handlers to the pipeline.
     * @param {...Function} middlewares
     * @returns {Pipeline}
     */
    pipe(...middlewares) {
        this.middlewares.push(...middlewares.flat().filter(Boolean));
        return this;
    }

    /**
     * Executes the pipeline with a given context object.
     * @param {Object} context - Routing context passed to each middleware.
     * @param {Function} [destination] - Final handler executed after all middlewares call next().
     * @returns {Promise<*>}
     */
    async run(context, destination) {
        let index = -1;

        const runner = async (i) => {
            if (i <= index) {
                throw new Error('next() called multiple times in middleware pipeline');
            }
            index = i;

            const middleware = this.middlewares[i];
            if (!middleware) {
                return destination ? destination(context) : undefined;
            }

            return middleware(context, () => runner(i + 1));
        };

        return runner(0);
    }
}

export { Pipeline };
