package com.sdlcpro.springlens.storage.bean.instance;

import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import com.sdlcpro.springlens.exception.DataScopeMismatchException;
import com.sdlcpro.springlens.inspector.bean.BeanProxyInfoInspector;
import com.sdlcpro.springlens.model.bean.BeanInfoCompositeKey;
import com.sdlcpro.springlens.model.bean.instance.BeanInstanceInfo;
import com.sdlcpro.springlens.model.bean.instance.BeanInstanceProxyInfo;
import com.sdlcpro.springlens.model.bean.instance.BeanInstanceSummary;
import com.sdlcpro.springlens.query.Filter;
import com.sdlcpro.springlens.query.PageRequest;
import com.sdlcpro.springlens.query.PageResponse;
import com.sdlcpro.springlens.query.QueryExecutor;
import com.sdlcpro.springlens.repository.bean.BeanInstanceInfoRepository;
import com.sdlcpro.springlens.util.Preconditions;

import java.util.*;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.locks.ReentrantLock;
import java.util.stream.Stream;

@SpringLensInternalComponent
public class InMemoryBeanInstanceInfoRepository implements BeanInstanceInfoRepository {
    private static final int NON_SINGLETON_INSTANCE_CAPACITY = 10_000;
    private static final String SCOPE_SINGLETON = "singleton";

    private final ReentrantLock lock;
    private final BeanProxyInfoInspector beanProxyInfoInspector;
    private final QueryExecutor<BeanInstanceInfo> queryExecutor;
    private final List<BeanInstanceInfo> singletonInstances;
    private final Deque<BeanInstanceInfo> nonSingletonInstancesDeque;
    private final AtomicReference<BeanInstanceSummary> beanInstanceSummaryAtomicRef;

    public InMemoryBeanInstanceInfoRepository(BeanProxyInfoInspector beanProxyInfoInspector) {
        this.lock = new ReentrantLock();
        this.beanProxyInfoInspector = beanProxyInfoInspector;
        this.queryExecutor = new QueryExecutor<>(BeanInstanceInfo.class);
        this.singletonInstances = new CopyOnWriteArrayList<>();
        this.nonSingletonInstancesDeque = new ConcurrentLinkedDeque<>();
        this.beanInstanceSummaryAtomicRef = new AtomicReference<>(BeanInstanceSummary.empty());
    }

    @Override
    public PageResponse<BeanInstanceInfo> findAll(PageRequest pageRequest) {
        return this.findAll(Filter.UNFILTERED, pageRequest);
    }

    @Override
    public PageResponse<BeanInstanceInfo> findAll(Filter filter, PageRequest pageRequest) {
        return queryExecutor.execute(
                this.streamAllBeanInstanceInfo(),
                filter,
                pageRequest
        );
    }

    public Stream<BeanInstanceInfo> streamAllBeanInstanceInfo() {
        return Stream.concat(
                this.singletonInstances.stream(),
                this.nonSingletonInstancesDeque.stream()
        );
    }

    @Override
    public void save(BeanInstanceInfo beanInstanceInfo) {
        Preconditions.notNull(beanInstanceInfo, "BeanInstanceInfo must not be null");

        String scope = beanInstanceInfo.scope();
        if (SCOPE_SINGLETON.equals(scope)) {
            this.singletonInstances.add(beanInstanceInfo);
        } else {
            this.lock.lock();
            try {
                if (this.nonSingletonInstancesDeque.size() >= NON_SINGLETON_INSTANCE_CAPACITY) {
                    this.nonSingletonInstancesDeque.removeFirst();
                }
                this.nonSingletonInstancesDeque.addLast(beanInstanceInfo);
            } finally {
                this.lock.unlock();
            }
        }

        this.updateBeanInstanceSummary(beanInstanceInfo);
    }

    @Override
    public List<BeanInstanceInfo> findAll() {
        throw new UnsupportedOperationException();
    }

    @Override
    public Optional<BeanInstanceInfo> findById(BeanInfoCompositeKey key) {
        Preconditions.notNull(key, "BeanInfoCompositeKey must not be null");
        return this.streamAllBeanInstanceInfo()
                .filter(i -> i.contextId().equals(key.contextId()) && i.beanName().equals(key.beanName()))
                .findFirst();
    }

    @Override
    public void deleteById(BeanInfoCompositeKey beanInfoCompositeKey) {
        throw new UnsupportedOperationException();
    }

    @Override
    public long count() {
        return this.singletonInstances.size() + this.nonSingletonInstancesDeque.size();
    }

    @Override
    public Optional<BeanInstanceProxyInfo> findProxyInfoById(BeanInfoCompositeKey key) {
        Preconditions.notNull(key, "BeanInfoCompositeKey must not be null");

        return this.findById(key).map(instanceInfo -> {
            if (!Objects.equals(SCOPE_SINGLETON, instanceInfo.scope())) {
                throw new DataScopeMismatchException("Expected '%s' scope for proxy information of a bean found '%s'"
                        .formatted(SCOPE_SINGLETON, instanceInfo.scope()));
            }

            return this.beanProxyInfoInspector.inspectBy(key);
        });
    }

    @Override
    public BeanInstanceSummary getBeanInstanceSummary() {
        return this.beanInstanceSummaryAtomicRef.get();
    }

    private void updateBeanInstanceSummary(BeanInstanceInfo beanInstanceInfo) {
        this.beanInstanceSummaryAtomicRef.updateAndGet(summary -> {
            var contextDistribution = new HashMap<>(summary.contextDistribution());
            contextDistribution.merge(beanInstanceInfo.contextId(), 1L, Long::sum);

            var scopeDistribution = new HashMap<>(summary.scopeDistribution());
            scopeDistribution.merge(beanInstanceInfo.scope(), 1L, Long::sum);

            return new BeanInstanceSummary(
                    summary.totalCreatedInstances() + 1L,
                    contextDistribution,
                    scopeDistribution,
                    summary.instancesWithDefinition() + (beanInstanceInfo.hasDefinition() ? 1L : 0),
                    summary.instancesWithoutDefinition() + (beanInstanceInfo.hasDefinition() ? 0 : 1L),
                    summary.totalInitializationDurationNanos() + beanInstanceInfo.initDurationNanos(),
                    Long.max(summary.maxInitializationDurationNanos(), beanInstanceInfo.initDurationNanos())
            );
        });
    }
}
