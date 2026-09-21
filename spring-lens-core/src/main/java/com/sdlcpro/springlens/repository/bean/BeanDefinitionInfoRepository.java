package com.sdlcpro.springlens.repository.bean;

import com.sdlcpro.springlens.model.bean.BeanInfoCompositeKey;
import com.sdlcpro.springlens.model.bean.definition.BeanDefinitionInfo;
import com.sdlcpro.springlens.model.bean.definition.BeanDefinitionSummary;
import com.sdlcpro.springlens.model.bean.definition.BeanDependency;
import com.sdlcpro.springlens.query.PageRequest;
import com.sdlcpro.springlens.query.PageResponse;
import com.sdlcpro.springlens.repository.PageableRepository;


/**
 * Repository for accessing {@link BeanDefinitionInfo} instances.
 *
 * <p>Provides CRUD and pagination capabilities for bean bean-definition information,
 * as well as aggregated summary metrics.</p>
 */
public interface BeanDefinitionInfoRepository extends PageableRepository<BeanDefinitionInfo, BeanInfoCompositeKey> {
    /**
     * Returns an aggregated summary of the registered bean definitions.
     *
     * <p>The summary contains aggregated metrics such as contextual
     * distribution, scope breakdown, role counts, loading mode distribution,
     * and overall bean counts.</p>
     *
     * @return the aggregated {@link BeanDefinitionSummary}
     */
    BeanDefinitionSummary getBeanDefinitionSummary();

    PageResponse<BeanDependency> findBeanDependencies(PageRequest pageRequest);
}
