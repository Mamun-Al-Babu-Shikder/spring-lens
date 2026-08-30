package com.sdlcpro.springlens.autoconfigure.application;

import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import com.sdlcpro.springlens.insight.application.DefaultApplicationInfoInspector;
import com.sdlcpro.springlens.inspector.application.ApplicationInfoInspector;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Role;

@SpringLensInternalComponent
@Configuration(proxyBeanMethods = false)
@Role(BeanDefinition.ROLE_INFRASTRUCTURE)
class ApplicationInfoInspectorConfiguration {

    @Bean
    @Role(BeanDefinition.ROLE_INFRASTRUCTURE)
    @ConditionalOnMissingBean(ApplicationInfoInspector.class)
    public ApplicationInfoInspector applicationInfoInspector() {
        return new DefaultApplicationInfoInspector();
    }

}
