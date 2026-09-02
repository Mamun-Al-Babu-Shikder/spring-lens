package com.sdlcpro.springlens.repository.bean;

import com.sdlcpro.springlens.model.bean.condition.ConditionEvaluationInfo;
import com.sdlcpro.springlens.model.bean.condition.ConditionEvaluationKey;
import com.sdlcpro.springlens.model.bean.condition.ConditionEvaluationSummary;
import com.sdlcpro.springlens.repository.PageableRepository;

/**
 * Repository contract for managing {@link ConditionEvaluationInfo} domain models.
 * Provides pageable access and key-based lookup operations using {@link ConditionEvaluationKey}.
 */
public interface ConditionEvaluationInfoRepository extends PageableRepository<ConditionEvaluationInfo, ConditionEvaluationKey> {

    ConditionEvaluationSummary getConditionEvaluationSummary();
}
