package com.sdlcpro.springlens.storage.bean.condition;


import com.sdlcpro.springlens.model.bean.condition.ConditionEvaluationInfo;
import com.sdlcpro.springlens.model.bean.condition.ConditionOutcome;
import com.sdlcpro.springlens.repository.bean.ConditionEvaluationInfoRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class ConditionEvaluationInfoPersistenceHandlerTest {

    @Mock
    private ConditionEvaluationInfoRepository conditionEvaluationInfoRepository;

    @InjectMocks
    private ConditionEvaluationInfoPersistenceHandler persistenceHandler;

    @Test
    void shouldSaveConditionEvaluationInfoWhenCollected() {
        ConditionEvaluationInfo conditionEvaluationInfo = new ConditionEvaluationInfo(
                "applicationContext",
                "com.example.MyAutoConfiguration",
                ConditionOutcome.MATCHED,
                List.of()
        );

        persistenceHandler.onConditionEvaluationInfoCollected(conditionEvaluationInfo);

        verify(conditionEvaluationInfoRepository).save(conditionEvaluationInfo);
    }

    @Test
    void shouldNotSaveWhenConditionEvaluationInfoIsNull() {
        persistenceHandler.onConditionEvaluationInfoCollected(null);

        verifyNoInteractions(conditionEvaluationInfoRepository);
    }
}
