package com.sdlcpro.springlens.autoconfigure.application;

import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import com.sdlcpro.springlens.exposure.application.ApplicationInfoRestController;
import com.sdlcpro.springlens.inspector.application.ApplicationInfoInspector;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Role;

import static org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication.Type;

@SpringLensInternalComponent
@Configuration(proxyBeanMethods = false)
@Role(BeanDefinition.ROLE_INFRASTRUCTURE)
@ConditionalOnWebApplication(type = Type.SERVLET)
@ConditionalOnClass({ApplicationInfoRestController.class})
public class ApplicationInfoHttpExposureConfiguration {

    @Bean
    @Role(BeanDefinition.ROLE_INFRASTRUCTURE)
    @ConditionalOnBean(ApplicationInfoInspector.class)
    public ApplicationInfoRestController applicationInfoRestController(ApplicationInfoInspector applicationInfoInspector) {
        return new ApplicationInfoRestController(applicationInfoInspector);
    }
}
