package com.sdlcpro.springlens.autoconfigure.bean.condition;

import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import com.sdlcpro.springlens.repository.bean.ConditionEvaluationInfoRepository;
import com.sdlcpro.springlens.storage.bean.condition.ConditionEvaluationInfoPersistenceHandler;
import com.sdlcpro.springlens.storage.bean.condition.InMemoryConditionEvaluationInfoRepository;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Role;

@SpringLensInternalComponent
@Configuration(proxyBeanMethods = false)
@Role(BeanDefinition.ROLE_INFRASTRUCTURE)
@ConditionalOnClass({InMemoryConditionEvaluationInfoRepository.class})
class ConditionEvaluationInfoStorageConfiguration {

    @Bean
    @Role(BeanDefinition.ROLE_INFRASTRUCTURE)
    @ConditionalOnMissingBean(ConditionEvaluationInfoRepository.class)
    public ConditionEvaluationInfoRepository inMemoryConditionEvaluationInfoRepository() {
        return new InMemoryConditionEvaluationInfoRepository();
    }

    @Bean
    @Role(BeanDefinition.ROLE_INFRASTRUCTURE)
    @ConditionalOnBean(ConditionEvaluationInfoRepository.class)
    @ConditionalOnMissingBean(ConditionEvaluationInfoPersistenceHandler.class)
    public ConditionEvaluationInfoPersistenceHandler conditionEvaluationInfoPersistenceHandler(
            ConditionEvaluationInfoRepository conditionEvaluationInfoRepository) {
        return new ConditionEvaluationInfoPersistenceHandler(conditionEvaluationInfoRepository);
    }
}
