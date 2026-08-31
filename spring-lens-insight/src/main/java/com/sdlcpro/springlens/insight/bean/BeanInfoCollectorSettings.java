package com.sdlcpro.springlens.insight.bean;

import com.sdlcpro.springlens.constant.SpringFrameworkModule;

import java.util.Set;

import static com.sdlcpro.springlens.util.DefensiveCopies.immutableEnumSetOrEmpty;
import static com.sdlcpro.springlens.util.DefensiveCopies.immutableSetOrEmpty;

public record BeanInfoCollectorSettings(
        boolean includeInfraRole,
        boolean includeToolInternal,
        Set<SpringFrameworkModule> includeFrameworkModules,
        Set<String> excludePackagePatterns,
        Set<String> excludeClasses
) {

    public BeanInfoCollectorSettings {
        includeFrameworkModules = immutableEnumSetOrEmpty(includeFrameworkModules);
        excludePackagePatterns = immutableSetOrEmpty(excludePackagePatterns);
        excludeClasses = immutableSetOrEmpty(excludeClasses);
    }
}
