package com.sdlcpro.springlens.model.bean.condition;

import com.sdlcpro.springlens.util.Preconditions;

public record ConditionEvaluationSummary(
        int totalConditionSources,
        int matchedConditionSources,
        int notMatchedConditionSources,
        int totalEvaluatedConditions
) {
    private static final ConditionEvaluationSummary EMPTY = new ConditionEvaluationSummary(0, 0, 0, 0);

    public ConditionEvaluationSummary {
        Preconditions.isTrue(
                totalConditionSources >= 0,
                "The value of totalConditionSources must not be negative"
        );

        Preconditions.isTrue(
                matchedConditionSources >= 0,
                "The value of matchedConditionSources must not be negative"
        );

        Preconditions.isTrue(
                notMatchedConditionSources >= 0,
                "The value of notMatchedConditionSources must not be negative"
        );

        Preconditions.isTrue(
                totalEvaluatedConditions >= 0,
                "The value of totalEvaluatedConditions must not be negative"
        );
    }

    public static ConditionEvaluationSummary empty() {
        return EMPTY;
    }
}
