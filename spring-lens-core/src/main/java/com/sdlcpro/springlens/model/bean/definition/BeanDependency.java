package com.sdlcpro.springlens.model.bean.definition;

import com.sdlcpro.springlens.util.Preconditions;

import java.util.List;

import static com.sdlcpro.springlens.util.DefensiveCopies.immutableListOrEmpty;

public record BeanDependency(
        String contextId,
        String beanName,
        List<String> dependencies) {
    public BeanDependency {
        Preconditions.hasText(contextId, "Context id must not be blank");
        Preconditions.hasText(beanName, "Bean name must not be blank");
        dependencies = immutableListOrEmpty(dependencies);
    }
}
