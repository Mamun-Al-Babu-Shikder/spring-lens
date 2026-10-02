package com.sdlcpro.springlens.storage.bean.definition;

import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import com.sdlcpro.springlens.listener.bean.BeanDefinitionInfoCollectListener;
import com.sdlcpro.springlens.model.bean.definition.BeanDefinitionInfo;
import com.sdlcpro.springlens.repository.bean.BeanDefinitionInfoRepository;

/**
 * Persistence handler that bridges metadata collection and storage for
 * {@link BeanDefinitionInfo} instances.
 *
 * <p>This component listens for collected {@link BeanDefinitionInfo} events
 * via the {@link BeanDefinitionInfoCollectListener} callback and immediately
 * persists them using the {@link BeanDefinitionInfoRepository}.</p>
 *
 * @since 1.0.0
 */
@SpringLensInternalComponent
public class BeanDefinitionInfoPersistenceHandler implements BeanDefinitionInfoCollectListener {

    private final BeanDefinitionInfoRepository beanDefinitionInfoRepository;

    public BeanDefinitionInfoPersistenceHandler(BeanDefinitionInfoRepository beanDefinitionInfoRepository) {
        this.beanDefinitionInfoRepository = beanDefinitionInfoRepository;
    }

    @Override
    public void onBeanDefinitionInfoCollected(BeanDefinitionInfo beanDefinitionInfo) {
        if (beanDefinitionInfo != null) {
            this.beanDefinitionInfoRepository.save(beanDefinitionInfo);
        }
    }
}
