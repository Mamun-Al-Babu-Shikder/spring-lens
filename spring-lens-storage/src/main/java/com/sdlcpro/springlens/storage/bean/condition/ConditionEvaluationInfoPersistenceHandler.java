package com.sdlcpro.springlens.storage.bean.condition;

import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import com.sdlcpro.springlens.listener.bean.ConditionEvaluationInfoCollectListener;
import com.sdlcpro.springlens.model.bean.condition.ConditionEvaluationInfo;
import com.sdlcpro.springlens.repository.bean.ConditionEvaluationInfoRepository;

/**
 * Persistence handler that bridges collected {@link ConditionEvaluationInfo} events
 * with storage
 * <p>
 * Listens for {@link ConditionEvaluationInfo} events via
 * {@link ConditionEvaluationInfoCollectListener} and persists them using
 * {@link ConditionEvaluationInfoRepository}.
 */
@SpringLensInternalComponent
public class ConditionEvaluationInfoPersistenceHandler implements ConditionEvaluationInfoCollectListener {

    private final ConditionEvaluationInfoRepository conditionEvaluationInfoRepository;

    /**
     * Creates a new {@link ConditionEvaluationInfoPersistenceHandler}
     * with the given {@code conditionEvaluationInfoRepository}
     *
     * @param conditionEvaluationInfoRepository the repository used to save {@code conditionEvaluationInfo}
     */
    public ConditionEvaluationInfoPersistenceHandler(ConditionEvaluationInfoRepository conditionEvaluationInfoRepository) {
        this.conditionEvaluationInfoRepository = conditionEvaluationInfoRepository;
    }

    /**
     * Save the {@code conditionEvaluationInfo} to the
     * {@link ConditionEvaluationInfoRepository} when it is not null
     *
     * @param conditionEvaluationInfo the collected condition evaluation info, ignored when null
     */
    @Override
    public void onConditionEvaluationInfoCollected(ConditionEvaluationInfo conditionEvaluationInfo) {
        if(conditionEvaluationInfo != null) {
            this.conditionEvaluationInfoRepository.save(conditionEvaluationInfo);
        }
    }
}
