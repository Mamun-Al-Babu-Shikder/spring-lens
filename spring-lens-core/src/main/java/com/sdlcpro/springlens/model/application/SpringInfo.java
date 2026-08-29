package com.sdlcpro.springlens.model.application;

import com.sdlcpro.springlens.util.Preconditions;

/**
 * Immutable version information for the Spring runtime.
 *
 * @author Ixtiyorxon
 * @since 2026-08-28
 *
 * @param bootVersion      Spring Boot version
 * @param frameworkVersion Spring Framework version
 */
public record SpringInfo(
        String bootVersion,
        String frameworkVersion
) {

    /**
     * Creates Spring runtime version information.
     *
     * @param bootVersion      Spring Boot version
     * @param frameworkVersion Spring Framework version
     */
    public SpringInfo {
        Preconditions.hasText(bootVersion, "SpringInfo bootVersion must be provided");
        Preconditions.hasText(frameworkVersion, "SpringInfo frameworkVersion must be provided");
    }
}
