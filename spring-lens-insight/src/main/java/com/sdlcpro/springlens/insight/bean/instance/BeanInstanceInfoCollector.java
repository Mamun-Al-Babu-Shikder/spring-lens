package com.sdlcpro.springlens.insight.bean.instance;

import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import com.sdlcpro.springlens.insight.bean.BeanInfoCollectionContext;
import com.sdlcpro.springlens.insight.bean.BeanInfoCollectorSettings;
import com.sdlcpro.springlens.listener.bean.BeanInstanceInfoCollectListener;
import com.sdlcpro.springlens.matcher.CompositeMatcher;
import com.sdlcpro.springlens.model.bean.BeanRole;
import com.sdlcpro.springlens.model.bean.instance.BeanInstanceInfo;
import com.sdlcpro.springlens.time.AnchoredClock;
import com.sdlcpro.springlens.util.Preconditions;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.BeansException;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.env.Environment;
import org.springframework.util.ObjectUtils;

import java.time.Instant;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import static com.sdlcpro.springlens.insight.bean.BeanInfoUtils.*;

@SpringLensInternalComponent
public final class BeanInstanceInfoCollector implements BeanPostProcessor {
    private static final Logger logger = LoggerFactory.getLogger(BeanInstanceInfoCollector.class);

    private static final String INCLUDE_ROLE_INFRA_PROPERTY = "spring.lens.bean.include.role-infra";
    private static final String INCLUDE_TOOL_INTERNAL_PROPERTY = "spring.lens.bean.include.tool-internal";
    private static final String INCLUDE_FRAMEWORK_INTERNAL_PROPERTY = "spring.lens.bean.include.framework-internal";
    private static final String EXCLUDE_PACKAGE_PATTERN_PROPERTY = "spring.lens.bean.exclude.package-patterns";
    private static final String EXCLUDE_CLASSES_PROPERTY = "spring.lens.bean.exclude.classes";
    private static final BeanInstanceInfoEventStream BEAN_INSTANCE_INFO_EVENT_STREAM;

    private final String contextId;
    private final String beanNamePrefix;
    private final ConfigurableApplicationContext context;
    private final ConcurrentHashMap<String, BeanInstanceInfoBuilder> beanInstanceInfoBuilderMap;
    private final CompositeMatcher<BeanInfoCollectionContext> beanDefinitionCollectionMatcher;

    static {
        BEAN_INSTANCE_INFO_EVENT_STREAM = new SingleListenerBeanInstanceInfoEventStream();
    }

    public BeanInstanceInfoCollector(ConfigurableApplicationContext context) {
        this.context = Preconditions.requireNonNull(context, "The ConfigurableApplicationContext must not be null");
        this.contextId = context.getId() == null ? ObjectUtils.identityToString(context) : context.getId();
        this.beanInstanceInfoBuilderMap = new ConcurrentHashMap<>();
        this.beanNamePrefix = this.contextId.concat(":");
        this.beanDefinitionCollectionMatcher = createCollectionMatcher(getCollectorSetting(context.getEnvironment()));
    }

    @SuppressWarnings("unchecked")
    private BeanInfoCollectorSettings getCollectorSetting(Environment env) {
        try {
            boolean includeInfraRole = env.getProperty(INCLUDE_ROLE_INFRA_PROPERTY, boolean.class, false);
            boolean includeToolInternal = env.getProperty(INCLUDE_TOOL_INTERNAL_PROPERTY, boolean.class, false);
            boolean includeFrameworkInternal = env.getProperty(INCLUDE_FRAMEWORK_INTERNAL_PROPERTY, boolean.class, false);
            Set<String> excludePackagePattern = env.getProperty(EXCLUDE_PACKAGE_PATTERN_PROPERTY, Set.class, Set.of());
            Set<String> excludeClasses = env.getProperty(EXCLUDE_CLASSES_PROPERTY, Set.class, Set.of());
            return new BeanInfoCollectorSettings(includeInfraRole, includeToolInternal, includeFrameworkInternal, excludePackagePattern, excludeClasses);
        } catch (Exception ex) {
            throw new IllegalArgumentException("Invalid property value found to instantiate BeanInfoCollectorSettings", ex);
        }
    }

    private boolean isEligibleToCollectInfo(Object bean, String beanName) {
        BeanRole beanRole = context.containsBeanDefinition(beanName)
                ? resolveBeanRole(context.getBeanFactory(), beanName)
                : BeanRole.UNKNOWN;

        var beanInstanceContext = new BeanInfoCollectionContext(
                beanRole,
                () -> resolveRuntimeBeanType(bean),
                () -> resolveRuntimeClass(bean)
        );

        return this.beanDefinitionCollectionMatcher.matches(beanInstanceContext);
    }

    @Override
    public Object postProcessBeforeInitialization(Object bean, String beanName) throws BeansException {
        try {
            boolean hasDefinition = context.containsBeanDefinition(beanName);
            String scope = hasDefinition ? resolveBeanScope(this.context.getBeanFactory(), beanName) : "unknown";

            if (this.isEligibleToCollectInfo(bean, beanName)) {
                String key = beanNamePrefix.concat(beanName);
                var builder = BeanInstanceInfoBuilder.init(this.contextId, beanName)
                        .type(resolveRuntimeBeanType(bean))
                        .scope(scope)
                        .hasDefinition(hasDefinition);

                this.beanInstanceInfoBuilderMap.put(key, builder);
            }
        } catch (Exception ex) {
            logger.debug("Failed to initialized the tracking of bean instance info for beanName '{}' in context '{}'",
                    beanName,
                    this.contextId,
                    ex
            );
        }

        return bean;
    }

    @Override
    public Object postProcessAfterInitialization(Object bean, String beanName) throws BeansException {
        try {
            this.subscribeIfListenerBean(bean);
            this.buildAndPublishBeanInstanceInfo(beanName);
        } catch (Exception ex) {
            logger.debug("Failed to keep track the bean instance info for beanName '{}' in context '{}'",
                    beanName,
                    this.contextId,
                    ex
            );
        } finally {
            String key = beanNamePrefix.concat(beanName);
            this.beanInstanceInfoBuilderMap.remove(key);
        }

        return bean;
    }

    private void subscribeIfListenerBean(Object bean) {
        if (bean instanceof BeanInstanceInfoCollectListener listener) {
            BEAN_INSTANCE_INFO_EVENT_STREAM.subscribe(listener);
        }
    }

    private void buildAndPublishBeanInstanceInfo(String beanName) {
        String key = beanNamePrefix.concat(beanName);
        var beanInstanceInfoBuilder = this.beanInstanceInfoBuilderMap.get(key);
        if (beanInstanceInfoBuilder != null) {
            BeanInstanceInfo beanInstanceInfo = beanInstanceInfoBuilder.build();
            BEAN_INSTANCE_INFO_EVENT_STREAM.publish(beanInstanceInfo);
        }
    }

    private static class BeanInstanceInfoBuilder {
        private final String contextId;
        private final String beanName;
        private final AnchoredClock clock;
        private String type;
        private String scope;
        private boolean hasDefinition;

        private BeanInstanceInfoBuilder(String contextId, String beanName) {
            this.contextId = contextId;
            this.beanName = beanName;
            this.clock = AnchoredClock.create();
        }

        public static BeanInstanceInfoBuilder init(String contextId, String beanName) {
            return new BeanInstanceInfoBuilder(contextId, beanName);
        }

        public BeanInstanceInfoBuilder type(String type) {
            this.type = type;
            return this;
        }

        public BeanInstanceInfoBuilder scope(String scope) {
            this.scope = scope;
            return this;
        }

        public BeanInstanceInfoBuilder hasDefinition(boolean hasDefinition) {
            this.hasDefinition = hasDefinition;
            return this;
        }

        public BeanInstanceInfo build() {
            Instant createdAt = this.clock.getStartTime();
            long initDurationNanos = this.clock.getElapsedNanos();
            return new BeanInstanceInfo(
                    this.contextId,
                    this.beanName,
                    this.type,
                    this.scope,
                    this.hasDefinition,
                    createdAt,
                    initDurationNanos
            );
        }
    }
}
