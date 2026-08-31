package com.sdlcpro.springlens.model.bean.definition;

import com.sdlcpro.springlens.model.bean.BeanRole;
import com.sdlcpro.springlens.util.Preconditions;

import java.util.List;

import static com.sdlcpro.springlens.util.DefensiveCopies.immutableListOrEmpty;

public record BeanDefinitionInfo(
        String contextId,
        String beanName,
        List<String> aliases,
        String type,
        String resource,
        String description,
        String scope,
        boolean lazyInit,
        boolean primary,
        boolean autowireCandidate,
        BeanRole role,
        String initMethodName,
        String destroyMethodName,
        String factoryBeanName,
        String factoryMethodName,
        List<String> dependencies,
        List<String> dependents
) {

    public BeanDefinitionInfo {
        Preconditions.notNull(contextId, "Context id must not be null");
        Preconditions.notNull(beanName, "Bean name must not be null");
        Preconditions.notNull(scope, "Bean scope must not be null");
        Preconditions.notNull(role, "BeanRole must not be null");
        aliases = immutableListOrEmpty(aliases);
        dependencies = immutableListOrEmpty(dependencies);
        dependents = immutableListOrEmpty(dependents);
    }
}
