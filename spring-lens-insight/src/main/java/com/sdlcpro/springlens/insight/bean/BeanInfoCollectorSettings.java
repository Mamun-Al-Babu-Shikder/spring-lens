package com.sdlcpro.springlens.insight.bean;

import java.util.Set;

import static com.sdlcpro.springlens.util.DefensiveCopies.immutableSetOrEmpty;

public record BeanInfoCollectorSettings(
        boolean includeInfraRole,
        boolean includeToolInternal,
        boolean includeFrameworkInternal,
        Set<String> excludePackagePatterns,
        Set<String> excludeClasses
) {

    public BeanInfoCollectorSettings {
        excludePackagePatterns = immutableSetOrEmpty(excludePackagePatterns);
        excludeClasses = immutableSetOrEmpty(excludeClasses);
    }
}
