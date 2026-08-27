package com.sdlcpro.springlens.insight.bean.condition;

import com.sdlcpro.springlens.model.bean.condition.ConditionEvaluationInfo;
import org.springframework.context.ConfigurableApplicationContext;

import java.util.List;

public interface ConditionEvaluationInfoGatherer {

    List<ConditionEvaluationInfo> gather(ConfigurableApplicationContext context);
}
