package com.sdlcpro.springlens.model.application;

import com.sdlcpro.springlens.util.Preconditions;

import java.time.Duration;
import java.time.Instant;

/**
 * Immutable timing metadata for Spring application context startup.
 *
 * @author Ixtiyorxon
 * @since 2026-08-28
 *
 * @param startedAt       instant at which the application context started
 * @param startupDuration total duration required to start the application context
 */
public record StartupInfo(
        Instant startedAt,
        Duration startupDuration
) {

    /**
     * Creates application context startup timing metadata.
     *
     * @param startedAt       instant at which the application context started
     * @param startupDuration total duration required to start the application context
     */
    public StartupInfo {
        Preconditions.notNull(startedAt, "StartupInfo startedAt must not be null");
        Preconditions.notNull(startupDuration, "StartupInfo startupDuration must not be null");
        Preconditions.isTrue(!startupDuration.isNegative(), "StartupInfo startupDuration must not be negative");
    }
}
