package com.sdlcpro.springlens.storage.bean.condition;

import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import com.sdlcpro.springlens.model.bean.condition.ConditionEvaluationInfo;
import com.sdlcpro.springlens.model.bean.condition.ConditionEvaluationKey;
import com.sdlcpro.springlens.model.bean.condition.ConditionEvaluationSummary;
import com.sdlcpro.springlens.query.Filter;
import com.sdlcpro.springlens.query.PageRequest;
import com.sdlcpro.springlens.query.PageResponse;
import com.sdlcpro.springlens.query.QueryExecutor;
import com.sdlcpro.springlens.repository.bean.ConditionEvaluationInfoRepository;
import com.sdlcpro.springlens.util.Preconditions;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicReference;

import static com.sdlcpro.springlens.model.bean.condition.ConditionOutcome.MATCHED;
import static com.sdlcpro.springlens.model.bean.condition.ConditionOutcome.NOT_MATCHED;

@SpringLensInternalComponent
public class InMemoryConditionEvaluationInfoRepository implements ConditionEvaluationInfoRepository {
    private final QueryExecutor<ConditionEvaluationInfo> queryExecutor;
    private final ConcurrentMap<ConditionEvaluationKey, ConditionEvaluationInfo> conditionEvaluationInfoMap;
    private final AtomicReference<ConditionEvaluationSummary> conditionEvaluationSummaryAtomicRef;

    public InMemoryConditionEvaluationInfoRepository() {
        this.queryExecutor = new QueryExecutor<>(ConditionEvaluationInfo.class);
        this.conditionEvaluationInfoMap = new ConcurrentHashMap<>();
        this.conditionEvaluationSummaryAtomicRef = new AtomicReference<>(ConditionEvaluationSummary.empty());
    }

    @Override
    public PageResponse<ConditionEvaluationInfo> findAll(PageRequest pageRequest) {
        return this.findAll(Filter.UNFILTERED, pageRequest);
    }

    @Override
    public PageResponse<ConditionEvaluationInfo> findAll(Filter filter, PageRequest pageRequest) {
        return this.queryExecutor.execute(
                this.conditionEvaluationInfoMap.values(),
                filter,
                pageRequest
        );
    }

    @Override
    public void save(ConditionEvaluationInfo conditionEvaluationInfo) {
        Preconditions.notNull(conditionEvaluationInfo, "ConditionEvaluationInfo must not be null");
        String contextId = conditionEvaluationInfo.contextId();
        String source = conditionEvaluationInfo.source();
        this.conditionEvaluationInfoMap.put(new ConditionEvaluationKey(contextId, source), conditionEvaluationInfo);
        this.updateConditionEvaluationSummary(conditionEvaluationInfo);
    }

    @Override
    public List<ConditionEvaluationInfo> findAll() {
        return List.copyOf(this.conditionEvaluationInfoMap.values());
    }

    @Override
    public Optional<ConditionEvaluationInfo> findById(ConditionEvaluationKey conditionEvaluationKey) {
        return Optional.ofNullable(this.conditionEvaluationInfoMap.get(conditionEvaluationKey));
    }

    @Override
    public void deleteById(ConditionEvaluationKey conditionEvaluationKey) {
        throw new UnsupportedOperationException();
    }

    @Override
    public long count() {
        return this.conditionEvaluationInfoMap.size();
    }

    @Override
    public ConditionEvaluationSummary getConditionEvaluationSummary() {
        return this.conditionEvaluationSummaryAtomicRef.get();
    }

    private void updateConditionEvaluationSummary(ConditionEvaluationInfo evaluationInfo) {
        this.conditionEvaluationSummaryAtomicRef.updateAndGet(summary -> new ConditionEvaluationSummary(
                summary.totalConditionSources() + 1,
                summary.matchedConditionSources() + (evaluationInfo.outcome() == MATCHED ? 1 : 0),
                summary.unmatchedConditionSources() + (evaluationInfo.outcome() == NOT_MATCHED ? 1 : 0),
                summary.totalEvaluatedConditions() + evaluationInfo.matches().size()
        ));
    }
}
