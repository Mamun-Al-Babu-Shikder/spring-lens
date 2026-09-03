package com.sdlcpro.springlens.model.bean.instance;

import com.sdlcpro.springlens.util.Preconditions;

import java.time.Instant;

/**
 * Carries metadata and telemetry information regarding a concrete Spring bean instance.
 */
public record BeanInstanceInfo(
        String contextId,
        String beanName,
        String type,
        String scope,
        boolean hasDefinition,
        Instant createdAt,
        long initDurationNanos
) {

    public BeanInstanceInfo {
        Preconditions.notNull(contextId, "Context id must not be null");
        Preconditions.notNull(beanName, "Bean name must not be null");
        Preconditions.notNull(type, "Bean type must not be null");
        Preconditions.notNull(scope, "Bean scope must not be null");
        Preconditions.notNull(createdAt, "Bean instantiation time createdAt value must not be null");
        Preconditions.isTrue(
                initDurationNanos >= 0,
                "The value of initDurationNanos must not be negative"
        );
    }
}