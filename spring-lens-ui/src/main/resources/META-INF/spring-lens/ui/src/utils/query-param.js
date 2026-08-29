/**
 * Utility class for constructing URL search query parameters.
 */
export default class QueryParam {

    static build(rawParams) {
        if (!rawParams) return new URLSearchParams();

        const cleanEntries = Object.entries(rawParams).filter(
            ([_, value]) =>
                value !== ''
                && value !== null
                && value !== undefined);

        return new URLSearchParams(cleanEntries);
    }
}
