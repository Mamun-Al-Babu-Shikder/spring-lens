package com.sdlcpro.springlens.insight.bean.definition;

import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import com.sdlcpro.springlens.insight.bean.BeanInfoCollectionContext;
import com.sdlcpro.springlens.insight.bean.BeanInfoCollectorSettings;
import com.sdlcpro.springlens.insight.util.SafeListenerInvoker;
import com.sdlcpro.springlens.listener.bean.BeanDefinitionInfoCollectListener;
import com.sdlcpro.springlens.matcher.CompositeMatcher;
import com.sdlcpro.springlens.model.bean.definition.BeanDefinitionInfo;
import com.sdlcpro.springlens.util.Preconditions;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.SmartInitializingSingleton;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.beans.factory.config.ConfigurableListableBeanFactory;
import org.springframework.context.ApplicationContext;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.util.ObjectUtils;

import java.util.LinkedList;
import java.util.List;
import java.util.Optional;

import static com.sdlcpro.springlens.insight.bean.BeanInfoUtils.*;

/**
 * Collects {@link BeanDefinitionInfo} from the ApplicationContext hierarchy after singletons start.
 * ConditionEvaluationReport enrichment is deferred until BeanConditionInfo exists.
 */
@SpringLensInternalComponent
public final class BeanDefinitionInfoCollector implements SmartInitializingSingleton {
    private static final Logger logger = LoggerFactory.getLogger(BeanDefinitionInfoCollector.class);

    private final ApplicationContext context;
    private final ObjectProvider<BeanDefinitionInfoCollectListener> beanDefinitionInfoCollectListenerProvider;
    private final CompositeMatcher<BeanInfoCollectionContext> beanDefinitionCollectionMatcher;

    public BeanDefinitionInfoCollector(ApplicationContext context, BeanInfoCollectorSettings settings, ObjectProvider<BeanDefinitionInfoCollectListener> beanDefinitionInfoCollectListenerProvider) {
        Preconditions.notNull(context, "ApplicationContext must not be null");
        Preconditions.notNull(settings, "Collector settings must not be null");
        this.context = context;
        this.beanDefinitionCollectionMatcher = createCollectionMatcher(settings);
        this.beanDefinitionInfoCollectListenerProvider = beanDefinitionInfoCollectListenerProvider;
    }

    @Override
    public void afterSingletonsInstantiated() {
        List<BeanDefinitionInfo> definitionInfos = this.collectBeanDefinitionInfo();
        this.publishBeanDefinitionInfo(definitionInfos);
    }

    private List<BeanDefinitionInfo> collectBeanDefinitionInfo() {
        var definitionInfos = new LinkedList<BeanDefinitionInfo>();
        this.collectBeanDefinitionInfoRecursively(this.context, definitionInfos);
        return definitionInfos;
    }

    private void collectBeanDefinitionInfoRecursively(ApplicationContext context, List<BeanDefinitionInfo> definitionInfos) {
        if (context.getParent() != null) {
            this.collectBeanDefinitionInfoRecursively(context.getParent(), definitionInfos);
        }

        String contextId = context.getId() == null ? ObjectUtils.identityToString(context) : context.getId();
        ConfigurableListableBeanFactory beanFactory = ((ConfigurableApplicationContext) context).getBeanFactory();
        String[] beanNames = beanFactory.getBeanDefinitionNames();
        for (var beanName : beanNames) {
            this.getEligibleInfoOrEmpty(beanFactory, contextId, beanName).ifPresent(definitionInfos::add);
        }
    }

    private Optional<BeanDefinitionInfo> getEligibleInfoOrEmpty(ConfigurableListableBeanFactory beanFactory, String contextId, String beanName) {
        try {
            if (this.isEligibleToCollectInfo(beanFactory, beanName)) {
                var beanDefinitionInfo = createBeanDefinitionInfo(contextId, beanName, beanFactory);
                return Optional.of(beanDefinitionInfo);
            }
        } catch (Exception ex) {
            logger.debug("Failed to collect bean definition information for beanName '{}' in context '{}'",
                    beanName,
                    contextId,
                    ex
            );
        }

        return Optional.empty();
    }

    private boolean isEligibleToCollectInfo(ConfigurableListableBeanFactory beanFactory, String beanName) {
        var beanDefContext = new BeanInfoCollectionContext(
                resolveBeanRole(beanFactory, beanName),
                () -> resolveBeanType(beanFactory, beanName),
                () -> beanFactory.getType(beanName)
        );

        return this.beanDefinitionCollectionMatcher.matches(beanDefContext);
    }

    private BeanDefinitionInfo createBeanDefinitionInfo(String contextId, String beanName, ConfigurableListableBeanFactory beanFactory) {
        BeanDefinition definition = beanFactory.getBeanDefinition(beanName);
        return new BeanDefinitionInfo(
                contextId,
                beanName,
                List.of(beanFactory.getAliases(beanName)),
                resolveBeanType(beanFactory, beanName),
                definition.getResourceDescription(),
                definition.getDescription(),
                resolveBeanScope(beanFactory, beanName),
                definition.isLazyInit(),
                definition.isPrimary(),
                definition.isAutowireCandidate(),
                resolveBeanRole(beanFactory, beanName),
                definition.getInitMethodName(),
                definition.getDestroyMethodName(),
                definition.getFactoryBeanName(),
                definition.getFactoryMethodName(),
                List.of(beanFactory.getDependenciesForBean(beanName)),
                List.of(beanFactory.getDependentBeans(beanName))
        );
    }

    private void publishBeanDefinitionInfo(List<BeanDefinitionInfo> beanDefinitionInfos) {
        for (BeanDefinitionInfo definitionInfo : beanDefinitionInfos) {
            SafeListenerInvoker.invoke(
                    this.beanDefinitionInfoCollectListenerProvider,
                    definitionInfo,
                    BeanDefinitionInfoCollectListener::onBeanDefinitionInfoCollect
            );
        }
    }
}
