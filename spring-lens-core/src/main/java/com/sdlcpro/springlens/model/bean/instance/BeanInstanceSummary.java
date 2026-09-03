package com.sdlcpro.springlens.model.bean.instance;

import com.sdlcpro.springlens.util.DefensiveCopies;
import com.sdlcpro.springlens.util.Preconditions;

import java.util.Map;

public record BeanInstanceSummary(
        long totalCreatedInstances,
        Map<String, Long> contextDistribution,
        Map<String, Long> scopeDistribution,
        long instancesWithDefinition,
        long instancesWithoutDefinition,
        long totalInitializationDurationNanos,
        long maxInitializationDurationNanos
) {
    private static final BeanInstanceSummary EMPTY = new BeanInstanceSummary(
            0L,
            Map.of(),
            Map.of(),
            0L,
            0L,
            0L,
            0L
    );

    public BeanInstanceSummary {
        Preconditions.isTrue(
                totalCreatedInstances >= 0,
                "The value of totalCreatedInstances must not be negative"
        );

        contextDistribution = DefensiveCopies.immutableMapOrEmpty(contextDistribution);
        scopeDistribution = DefensiveCopies.immutableMapOrEmpty(scopeDistribution);

        Preconditions.isTrue(
                instancesWithDefinition >= 0,
                "The value of instancesWithDefinition must not be negative"
        );

        Preconditions.isTrue(
                instancesWithoutDefinition >= 0,
                "The value of instancesWithoutDefinition must not be negative"
        );

        Preconditions.isTrue(
                totalInitializationDurationNanos >= 0,
                "The value of totalInitializationDurationNanos must not be negative"
        );

        Preconditions.isTrue(
                maxInitializationDurationNanos >= 0,
                "The value of maxInitializationDurationNanos must not be negative"
        );
    }

    public long getAverageInitializationDurationNanos() {
        if (this.totalCreatedInstances == 0) {
            return 0;
        }

        return this.totalInitializationDurationNanos / this.totalCreatedInstances;
    }

    public static BeanInstanceSummary empty() {
        return EMPTY;
    }
}
