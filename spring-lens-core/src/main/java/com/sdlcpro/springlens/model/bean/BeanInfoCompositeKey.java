package com.sdlcpro.springlens.model.bean;

import com.sdlcpro.springlens.util.Preconditions;

public record BeanInfoCompositeKey(String contextId, String beanName) {

    public BeanInfoCompositeKey {
        Preconditions.hasText(contextId, "contextId must not be blank");
        Preconditions.hasText(beanName, "beanName must not be blank");
    }

    @Override
    public String toString() {
        return "context-id: " + this.contextId + ", bean-name: " + this.beanName;
    }
}
