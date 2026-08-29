package com.sdlcpro.springlens.model.application;

import com.sdlcpro.springlens.util.DefensiveCopies;
import com.sdlcpro.springlens.util.Preconditions;

import java.util.Set;

/**
 * Immutable snapshot of the runtime metadata for a Spring application.
 *
 * @author Ixtiyorxon
 * @since 2026-08-28
 *
 * @param name            application name
 * @param activeProfiles  profiles active in the current environment
 * @param defaultProfiles profiles used when no active profile is configured
 * @param spring          Spring runtime version information
 * @param java            Java runtime information
 * @param startup         application context startup information
 */
public record ApplicationInfo(
        String name,
        Set<String> activeProfiles,
        Set<String> defaultProfiles,
        SpringInfo spring,
        JavaInfo java,
        StartupInfo startup
) {

    /**
     * Creates an immutable application metadata snapshot.
     *
     * @param name            application name
     * @param activeProfiles  profiles active in the current environment
     * @param defaultProfiles profiles used when no active profile is configured
     * @param spring          Spring runtime version information
     * @param java            Java runtime information
     * @param startup         application context startup information
     */
    public ApplicationInfo {
        Preconditions.hasText(name, "ApplicationInfo name must be provided");
        Preconditions.notNull(spring, "ApplicationInfo spring must not be null");
        Preconditions.notNull(java, "ApplicationInfo java must not be null");
        Preconditions.notNull(startup, "ApplicationInfo startup must not be null");

        activeProfiles = DefensiveCopies.immutableSetOrEmpty(activeProfiles);
        defaultProfiles = DefensiveCopies.immutableSetOrEmpty(defaultProfiles);
    }
}
