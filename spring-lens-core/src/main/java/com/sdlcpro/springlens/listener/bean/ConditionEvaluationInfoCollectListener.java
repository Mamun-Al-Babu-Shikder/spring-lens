package com.sdlcpro.springlens.listener.bean;

import com.sdlcpro.springlens.model.bean.condition.ConditionEvaluationInfo;

/**
 * Listener interface that defines a callback contract for receiving collected
 * {@link ConditionEvaluationInfo} domain models during Spring auto-configuration
 * condition checks and report generation phases.
 * <p>
 * By marking it with {@link FunctionalInterface}, this interface enables subscriber
 * components, storage services, and event publishers to process condition evaluation
 * metadata as reports are collected.
 */
@FunctionalInterface
public interface ConditionEvaluationInfoCollectListener {

    /**
     * Callback method invoked when a {@link ConditionEvaluationInfo} bean=instance is collected.
     *
     * @param conditionEvaluationInfo the collected condition evaluation information
     */
    void onConditionEvaluationInfoCollect(ConditionEvaluationInfo conditionEvaluationInfo);
}
