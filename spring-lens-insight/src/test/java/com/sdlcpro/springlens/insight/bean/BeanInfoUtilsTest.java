package com.sdlcpro.springlens.insight.bean;

import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import com.sdlcpro.springlens.model.bean.BeanRole;
import com.sdlcpro.springlens.model.bean.ProxyType;
import org.junit.jupiter.api.Test;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.beans.factory.config.ConfigurableListableBeanFactory;

import java.io.Serializable;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class BeanInfoUtilsTest {

    @SpringLensInternalComponent
    static class InternalComponent {
    }

    static class RegularComponent {
    }

    @Test
    void resolveRuntimeClassReturnsBeanClass() {
        RegularComponent bean = new RegularComponent();

        assertThat(BeanInfoUtils.resolveRuntimeClass(bean)).isEqualTo(RegularComponent.class);
    }

    @Test
    void resolveRuntimeClassReturnsNullForNullBean() {
        assertThat(BeanInfoUtils.resolveRuntimeClass(null)).isNull();
    }

    @Test
    void resolveRuntimeBeanTypeReturnsTypeName() {
        RegularComponent bean = new RegularComponent();

        assertThat(BeanInfoUtils.resolveRuntimeBeanType(bean)).isEqualTo(RegularComponent.class.getTypeName());
    }

    @Test
    void resolveRuntimeBeanTypeReturnsNullForNullBean() {
        assertThat(BeanInfoUtils.resolveRuntimeBeanType(null)).isNull();
    }

    @Test
    void resolveBeanRoleReturnsRoleFromBeanFactory() {
        ConfigurableListableBeanFactory beanFactory = mock(ConfigurableListableBeanFactory.class);
        BeanDefinition beanDefinition = mock(BeanDefinition.class);

        when(beanFactory.getBeanDefinition("myBean")).thenReturn(beanDefinition);
        when(beanDefinition.getRole()).thenReturn(BeanRole.ROLE_INFRASTRUCTURE.value());

        assertThat(BeanInfoUtils.resolveBeanRole(beanFactory, "myBean")).isEqualTo(BeanRole.ROLE_INFRASTRUCTURE);
    }

    @Test
    void isSpringLensComponentReturnsTrueForAnnotatedBean() {
        InternalComponent bean = new InternalComponent();

        assertThat(BeanInfoUtils.isSpringLensComponent(bean)).isTrue();
    }

    @Test
    void isSpringLensComponentReturnsFalseForRegularBean() {
        RegularComponent bean = new RegularComponent();

        assertThat(BeanInfoUtils.isSpringLensComponent(bean)).isFalse();
    }

    @Test
    void isSpringLensComponentReturnsFalseForNullBean() {
        assertThat(BeanInfoUtils.isSpringLensComponent(null)).isFalse();
    }

    static class TargetClass implements Serializable {

    }

    @Test
    void shouldResolveJdkDynamicProxyType() {
        var targetClass = new TargetClass();
        var factory = new ProxyFactory(targetClass);
        factory.setInterfaces(Serializable.class);
        var proxiedBean = factory.getProxy();
        assertThat(BeanInfoUtils.resolveBeanProxyType(proxiedBean)).isEqualTo(ProxyType.JDK_DYNAMIC);
    }

    @Test
    void shouldResolveCglibProxyType() {
        var targetClass = new TargetClass();
        var factory = new ProxyFactory(targetClass);
        factory.setProxyTargetClass(true);
        var proxiedBean = factory.getProxy();
        assertThat(BeanInfoUtils.resolveBeanProxyType(proxiedBean)).isEqualTo(ProxyType.CGLIB);
    }

    @Test
    void createCollectionMatcherExcludesToolInternalComponentsWhenIncludeToolInternalIsFalse() {
        BeanInfoCollectorSettings settings = mock(BeanInfoCollectorSettings.class);
        when(settings.includeToolInternal()).thenReturn(false);

        var matcher = BeanInfoUtils.createCollectionMatcher(settings);
        BeanInfoCollectionContext context = new BeanInfoCollectionContext(
                BeanRole.ROLE_APPLICATION,
                InternalComponent.class::getName,
                () -> InternalComponent.class
        );

        assertThat(matcher.matches(context)).isFalse();
    }

    @Test
    void createCollectionMatcherIncludesToolInternalComponentsWhenIncludeToolInternalIsTrue() {
        BeanInfoCollectorSettings settings = mock(BeanInfoCollectorSettings.class);
        when(settings.includeToolInternal()).thenReturn(true);

        var matcher = BeanInfoUtils.createCollectionMatcher(settings);
        BeanInfoCollectionContext context = new BeanInfoCollectionContext(
                BeanRole.ROLE_APPLICATION,
                InternalComponent.class::getName,
                () -> InternalComponent.class
        );

        assertThat(matcher.matches(context)).isTrue();
    }
}