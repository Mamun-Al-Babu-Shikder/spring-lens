export default class ConditionTabsWidget {

    computeTabCounts(kpiMetrics = {}, searchQuery = '', searchTotalCount = null) {
        const metrics = kpiMetrics || {};
        const { totalConditionSources = 0, matchedConditionSources = 0, unmatchedConditionSources = 0 } = metrics;
        const allCount = (searchQuery && searchTotalCount !== null)
            ? searchTotalCount
            : totalConditionSources;

        return {
            allCount: (Number(allCount) || 0).toLocaleString(),
            matchedCount: (Number(matchedConditionSources) || 0).toLocaleString(),
            unmatchedCount: (Number(unmatchedConditionSources) || 0).toLocaleString()
        };
    }
}
