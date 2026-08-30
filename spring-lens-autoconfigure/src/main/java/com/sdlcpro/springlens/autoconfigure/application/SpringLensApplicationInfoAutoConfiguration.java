package com.sdlcpro.springlens.autoconfigure.application;

import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Role;

@AutoConfiguration
@SpringLensInternalComponent
@Role(BeanDefinition.ROLE_INFRASTRUCTURE)
@Import({
        ApplicationInfoInspectorConfiguration.class,
        ApplicationInfoHttpExposureConfiguration.class
})
public class SpringLensApplicationInfoAutoConfiguration {

}
