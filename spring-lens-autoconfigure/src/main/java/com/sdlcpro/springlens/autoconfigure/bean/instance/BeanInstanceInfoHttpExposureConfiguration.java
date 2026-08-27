package com.sdlcpro.springlens.autoconfigure.bean.instance;

import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import com.sdlcpro.springlens.exposure.bean.BeanInstanceInfoRestController;
import com.sdlcpro.springlens.repository.bean.BeanInstanceInfoRepository;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Role;

@SpringLensInternalComponent
@Configuration(proxyBeanMethods = false)
@ConditionalOnClass({BeanInstanceInfoRestController.class})
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
class BeanInstanceInfoHttpExposureConfiguration {

    @Bean
    @Role(BeanDefinition.ROLE_INFRASTRUCTURE)
    @ConditionalOnBean(BeanInstanceInfoRepository.class)
    public BeanInstanceInfoRestController beanInstanceInfoRestController(
            BeanInstanceInfoRepository beanInstanceInfoRepository) {
        return new BeanInstanceInfoRestController(beanInstanceInfoRepository);
    }
}
