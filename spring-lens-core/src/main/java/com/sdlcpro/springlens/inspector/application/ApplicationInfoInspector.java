package com.sdlcpro.springlens.inspector.application;

import com.sdlcpro.springlens.model.application.ApplicationInfo;

/**
 * Defines the contract for inspecting runtime metadata of the current Spring application.
 *
 * @author Ixtiyorxon
 * @since 2026-08-28
 */
public interface ApplicationInfoInspector {

    /**
     * Inspects the current runtime environment and returns its application metadata snapshot.
     *
     * @return immutable application metadata, including profiles, runtime versions, and startup timing
     */
    ApplicationInfo inspect();
}
