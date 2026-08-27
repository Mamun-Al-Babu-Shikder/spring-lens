package com.sdlcpro.springlens.autoconfigure.bean.instance;

import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Role;

@AutoConfiguration
@SpringLensInternalComponent
@Role(BeanDefinition.ROLE_INFRASTRUCTURE)
@ConditionalOnProperty(
        prefix = "spring.lens.bean.instance",
        name = "enabled",
        havingValue = "true",
        matchIfMissing = true
)
@Import({
        BeanInstanceInfoStorageConfiguration.class,
        BeanInstanceInfoHttpExposureConfiguration.class
})
public class SpringLensBeanInstanceInfoAutoConfiguration {

}
