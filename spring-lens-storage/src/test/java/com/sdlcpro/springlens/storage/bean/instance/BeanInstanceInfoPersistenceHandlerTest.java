package com.sdlcpro.springlens.storage.bean.instance;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import org.junit.jupiter.api.Test;

import com.sdlcpro.springlens.model.bean.instance.BeanInstanceInfo;
import com.sdlcpro.springlens.repository.bean.BeanInstanceInfoRepository;

public class BeanInstanceInfoPersistenceHandlerTest {
    @Test
    void shouldSaveBeanInstanceInfoOnce(){
        BeanInstanceInfoRepository repository=mock(BeanInstanceInfoRepository.class);
        BeanInstanceInfoPersistenceHandler handler = new BeanInstanceInfoPersistenceHandler(repository);
        BeanInstanceInfo info = mock(BeanInstanceInfo.class);
        handler.onBeanInstanceInfoCollected(info);
        verify(repository,times(1)).save(info);
    }
}
