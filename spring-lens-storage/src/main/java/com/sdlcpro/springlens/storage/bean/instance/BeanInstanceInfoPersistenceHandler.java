package com.sdlcpro.springlens.storage.bean.instance;

import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import com.sdlcpro.springlens.listener.bean.BeanInstanceInfoCollectListener;
import com.sdlcpro.springlens.model.bean.instance.BeanInstanceInfo;
import com.sdlcpro.springlens.repository.bean.BeanInstanceInfoRepository;

/**
 * Persistence handler that bridges bean bean=instance telemetry collection and storage.
 * <p>
 * Whenever a {@link BeanInstanceInfo} is collected, this component receives the
 * event and persists it using the {@link BeanInstanceInfoRepository}.
 */
@SpringLensInternalComponent
public class BeanInstanceInfoPersistenceHandler implements BeanInstanceInfoCollectListener {
    private final BeanInstanceInfoRepository beanInstanceInfoRepository;

    public BeanInstanceInfoPersistenceHandler(BeanInstanceInfoRepository beanInstanceInfoRepository) {
        this.beanInstanceInfoRepository = beanInstanceInfoRepository;
    }

    @Override
    public void onBeanInstanceInfoCollect(BeanInstanceInfo beanInstanceInfo) {
        if (beanInstanceInfo != null) {
            beanInstanceInfoRepository.save(beanInstanceInfo);
        }
    }
}
