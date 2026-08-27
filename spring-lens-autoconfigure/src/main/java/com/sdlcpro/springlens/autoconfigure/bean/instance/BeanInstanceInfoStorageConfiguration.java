package com.sdlcpro.springlens.autoconfigure.bean.instance;

import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import com.sdlcpro.springlens.insight.bean.instance.DefaultBeanProxyInfoInspector;
import com.sdlcpro.springlens.repository.bean.BeanInstanceInfoRepository;
import com.sdlcpro.springlens.storage.bean.instance.BeanInstanceInfoPersistenceHandler;
import com.sdlcpro.springlens.storage.bean.instance.InMemoryBeanInstanceInfoRepository;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Role;

@SpringLensInternalComponent
@Configuration(proxyBeanMethods = false)
@Role(BeanDefinition.ROLE_INFRASTRUCTURE)
@ConditionalOnClass({InMemoryBeanInstanceInfoRepository.class})
class BeanInstanceInfoStorageConfiguration {

    @Bean
    @Role(BeanDefinition.ROLE_INFRASTRUCTURE)
    @ConditionalOnMissingBean(BeanInstanceInfoRepository.class)
    public BeanInstanceInfoRepository inMemoryBeanInstanceInfoRepository(ApplicationContext context) {
        var beanProxyInfoInspector = new DefaultBeanProxyInfoInspector(context);
        return new InMemoryBeanInstanceInfoRepository(beanProxyInfoInspector);
    }

    @Bean
    @Role(BeanDefinition.ROLE_INFRASTRUCTURE)
    @ConditionalOnBean(BeanInstanceInfoRepository.class)
    @ConditionalOnMissingBean(BeanInstanceInfoPersistenceHandler.class)
    public BeanInstanceInfoPersistenceHandler beanInstanceInfoPersistenceHandler(
            BeanInstanceInfoRepository beanInstanceInfoRepository) {
        return new BeanInstanceInfoPersistenceHandler(beanInstanceInfoRepository);
    }
}
