package com.sdlcpro.springlens.storage.bean.definition;

import com.sdlcpro.springlens.model.bean.BeanRole;
import com.sdlcpro.springlens.model.bean.definition.BeanDefinitionInfo;
import com.sdlcpro.springlens.repository.bean.BeanDefinitionInfoRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;

@ExtendWith(MockitoExtension.class)
@DisplayName("BeanDefinitionInfoPersistenceHandler Tests")
class BeanDefinitionInfoPersistenceHandlerTest {

    @Mock
    private BeanDefinitionInfoRepository beanDefinitionInfoRepository;

    @InjectMocks
    private BeanDefinitionInfoPersistenceHandler persistenceHandler;

    @Test
    @DisplayName("should save bean bean-definition info exactly once when onBeanDefinitionInfoCollect is called")
    void shouldSaveBeanDefinitionInfoWhenCollected() {
        // given
        BeanDefinitionInfo beanDefinitionInfo = new BeanDefinitionInfo(
                "applicationContext",
                "myService",
                List.of("serviceAlias"),
                "com.example.MyService",
                "classpath:/com/example/MyService.class",
                "My service bean",
                "singleton",
                false,
                true,
                true,
                BeanRole.ROLE_APPLICATION,
                "init",
                "destroy",
                null,
                null,
                List.of("dependencyA"),
                List.of("dependentB")
        );

        // when
        persistenceHandler.onBeanDefinitionInfoCollect(beanDefinitionInfo);

        // then
        verify(beanDefinitionInfoRepository, times(1)).save(beanDefinitionInfo);
        verifyNoMoreInteractions(beanDefinitionInfoRepository);
    }
}
