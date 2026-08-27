package com.sdlcpro.springlens.autoconfigure.bean.condition;

import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import com.sdlcpro.springlens.exposure.bean.ConditionEvaluationInfoRestController;
import com.sdlcpro.springlens.repository.bean.ConditionEvaluationInfoRepository;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Role;

@SpringLensInternalComponent
@Configuration(proxyBeanMethods = false)
@Role(BeanDefinition.ROLE_INFRASTRUCTURE)
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
@ConditionalOnClass({ConditionEvaluationInfoRestController.class})
class ConditionEvaluationInfoHttpExposureConfiguration {

    @Bean
    @Role(BeanDefinition.ROLE_INFRASTRUCTURE)
    @ConditionalOnBean(ConditionEvaluationInfoRepository.class)
    public ConditionEvaluationInfoRestController conditionEvaluationInfoRestController(
            ConditionEvaluationInfoRepository conditionEvaluationInfoRepository) {
        return new ConditionEvaluationInfoRestController(conditionEvaluationInfoRepository);
    }
}
