package com.sdlcpro.springlens.autoconfigure.bean.instance;

import com.sdlcpro.springlens.insight.bean.instance.BeanInstanceInfoCollector;
import org.springframework.beans.factory.config.ConfigurableListableBeanFactory;
import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;

public class BeanInstanceInfoContextInitializer implements ApplicationContextInitializer<ConfigurableApplicationContext> {

    private static final String INSTANCE_ENABLED_PROPERTY = "spring.lens.bean.instance.enabled";

    @Override
    public void initialize(ConfigurableApplicationContext context) {
        if (context.getEnvironment().getProperty(INSTANCE_ENABLED_PROPERTY, Boolean.class, true) == Boolean.TRUE) {
            ConfigurableListableBeanFactory beanFactory = context.getBeanFactory();
            beanFactory.addBeanPostProcessor(new BeanInstanceInfoCollector(context));
        }
    }
}
