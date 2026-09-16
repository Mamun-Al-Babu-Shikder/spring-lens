export default class ConditionTabsWidget {

    computeTabCounts(kpiMetrics = {}, searchQuery = '', searchTotalCount = null) {
        const { totalConditionSources = 0, matchedConditionSources = 0, unmatchedConditionSources = 0 } = kpiMetrics
        const allCount = (searchQuery && searchTotalCount !== null)
            ? searchTotalCount
            : totalConditionSources;

        return {
            allCount: (allCount).toLocaleString(),
            matchedCount: (matchedConditionSources).toLocaleString(),
            unmatchedCount: (unmatchedConditionSources).toLocaleString()
        };
    }
}
