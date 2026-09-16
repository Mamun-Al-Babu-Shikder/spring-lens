/**
 * Widget responsible for computing the top 4 KPI metric cards
 * (Total Configurations, Matched, Did Not Match, Total Conditions Evaluated).
 */
export default class ConditionKpiWidget {
    computeMetrics(summary = {}) {
        const {
            totalConditionSources = 0,
            matchedConditionSources = 0,
            unmatchedConditionSources = 0,
            totalEvaluatedConditions = 0
        } = summary;

        const matchedPct = totalConditionSources > 0 ? ((matchedConditionSources / totalConditionSources) * 100).toFixed(1) : '0';
        const unmatchedPct = totalConditionSources > 0 ? ((unmatchedConditionSources / totalConditionSources) * 100).toFixed(1) : '0';

        return {
            total: totalConditionSources.toLocaleString(),
            matchedCount: matchedConditionSources.toLocaleString(),
            matchedPct,
            unmatchedCount: unmatchedConditionSources.toLocaleString(),
            unmatchedPct,
            conditionsTotal: totalEvaluatedConditions > 0 ? totalEvaluatedConditions.toLocaleString() : '-'
        };
    }
}
