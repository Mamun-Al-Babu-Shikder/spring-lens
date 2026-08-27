package com.sdlcpro.springlens.storage.bean.instance;

import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import com.sdlcpro.springlens.exception.DataScopeMismatchException;
import com.sdlcpro.springlens.inspector.BeanProxyInfoInspector;
import com.sdlcpro.springlens.model.bean.BeanInfoCompositeKey;
import com.sdlcpro.springlens.model.bean.instance.BeanInstanceInfo;
import com.sdlcpro.springlens.model.bean.instance.BeanInstanceProxyInfo;
import com.sdlcpro.springlens.query.Filter;
import com.sdlcpro.springlens.query.PageRequest;
import com.sdlcpro.springlens.query.PageResponse;
import com.sdlcpro.springlens.query.QueryExecutor;
import com.sdlcpro.springlens.repository.bean.BeanInstanceInfoRepository;
import com.sdlcpro.springlens.util.Preconditions;

import java.util.Deque;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.locks.ReentrantLock;
import java.util.stream.Stream;

@SpringLensInternalComponent
public class InMemoryBeanInstanceInfoRepository implements BeanInstanceInfoRepository {
    private static final int TRANSIENT_INSTANCE_CAPACITY = 10_000;
    private static final String SCOPE_SINGLETON = "singleton";

    private final ReentrantLock lock;
    private final BeanProxyInfoInspector beanProxyInfoInspector;
    private final QueryExecutor<BeanInstanceInfo> queryExecutor;
    private final List<BeanInstanceInfo> singletonInstances;
    private final Deque<BeanInstanceInfo> transientInstancesDeque;

    public InMemoryBeanInstanceInfoRepository(BeanProxyInfoInspector beanProxyInfoInspector) {
        this.lock = new ReentrantLock();
        this.beanProxyInfoInspector = beanProxyInfoInspector;
        this.queryExecutor = new QueryExecutor<>(BeanInstanceInfo.class);
        this.singletonInstances = new CopyOnWriteArrayList<>();
        this.transientInstancesDeque = new ConcurrentLinkedDeque<>();
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
                this.transientInstancesDeque.stream()
        );
    }

    @Override
    public void save(BeanInstanceInfo beanInstanceInfo) {
        Preconditions.notNull(beanInstanceInfo, "BeanInstanceInfo must not be null");

        String scope = beanInstanceInfo.scope();
        if (SCOPE_SINGLETON.equals(scope)) {
            this.singletonInstances.add(beanInstanceInfo);
            return;
        }

        this.lock.lock();
        try {
            if (this.transientInstancesDeque.size() >= TRANSIENT_INSTANCE_CAPACITY) {
                this.transientInstancesDeque.removeFirst();
            }
            this.transientInstancesDeque.addLast(beanInstanceInfo);
        } finally {
            this.lock.unlock();
        }
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
        return this.singletonInstances.size() + this.transientInstancesDeque.size();
    }

    @Override
    public Optional<BeanInstanceProxyInfo> findProxyInfoById(BeanInfoCompositeKey key) {
        Preconditions.notNull(key, "BeanInfoCompositeKey must not be null");

        return this.findById(key).map(instanceInfo -> {
            if (!Objects.equals(SCOPE_SINGLETON, instanceInfo.scope())) {
                throw new DataScopeMismatchException("Expected '%s' scope for proxy information of a bean found '%s'"
                        .formatted(SCOPE_SINGLETON, instanceInfo.scope()));
            }

            return this.beanProxyInfoInspector.inspectBeanInstanceProxyInfo(
                    instanceInfo.contextId(),
                    instanceInfo.beanName()
            );
        });
    }
}
