package com.sdlcpro.springlens.model.application;

import com.sdlcpro.springlens.util.Preconditions;

/**
 * Immutable metadata describing the Java runtime.
 *
 * @author Ixtiyorxon
 * @since 2026-08-28
 *
 * @param version Java runtime version
 * @param vendor  Java runtime vendor
 */
public record JavaInfo(
        String version,
        String vendor
) {

    /**
     * Creates Java runtime metadata.
     *
     * @param version Java runtime version
     * @param vendor  Java runtime vendor
     */
    public JavaInfo {
        Preconditions.hasText(version, "JavaInfo version must be provided");
        Preconditions.hasText(vendor, "JavaInfo vendor must be provided");
    }
}
