package com.sdlcpro.springlens.autoconfigure.bean.definition;

import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import com.sdlcpro.springlens.autoconfigure.bean.SpringLensBeanProperties;
import com.sdlcpro.springlens.insight.bean.BeanInfoCollectorSettings;
import com.sdlcpro.springlens.insight.bean.definition.BeanDefinitionInfoCollector;
import com.sdlcpro.springlens.listener.bean.BeanDefinitionInfoCollectListener;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Role;

@SpringLensInternalComponent
@Configuration(proxyBeanMethods = false)
@Role(BeanDefinition.ROLE_INFRASTRUCTURE)
class BeanDefinitionInfoCollectorConfiguration {

    @Bean
    @Role(BeanDefinition.ROLE_INFRASTRUCTURE)
    public BeanDefinitionInfoCollector beanDefinitionInfoCollector(
            ApplicationContext context, SpringLensBeanProperties properties,
            ObjectProvider<BeanDefinitionInfoCollectListener> beanDefinitionInfoCollectListenerProvider) {

        SpringLensBeanProperties.Include include = properties.getInclude();
        SpringLensBeanProperties.Exclude exclude = properties.getExclude();

        var settings = new BeanInfoCollectorSettings(
                include.isRoleInfra(),
                include.isToolInternal(),
                include.isFrameworkInternal(),
                exclude.getPackagePatterns(),
                exclude.getClasses()
        );

        return new BeanDefinitionInfoCollector(context, settings, beanDefinitionInfoCollectListenerProvider);
    }
}
