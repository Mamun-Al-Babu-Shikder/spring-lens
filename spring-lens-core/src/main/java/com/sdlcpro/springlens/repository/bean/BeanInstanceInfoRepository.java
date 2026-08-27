package com.sdlcpro.springlens.repository.bean;

import com.sdlcpro.springlens.model.bean.BeanInfoCompositeKey;
import com.sdlcpro.springlens.model.bean.instance.BeanInstanceInfo;
import com.sdlcpro.springlens.model.bean.instance.BeanInstanceProxyInfo;
import com.sdlcpro.springlens.repository.PageableRepository;

import java.util.Optional;

/**
 * Manages persistence for {@link BeanInstanceInfo}, by context ID and bean name.
 */
public interface BeanInstanceInfoRepository extends PageableRepository<BeanInstanceInfo, BeanInfoCompositeKey> {

    /**
     * Returns proxy metadata for the bean instance matching the given key.
     *
     * @param key context ID + bean name identifying the instance
     * @return proxy info, or null if no matching instance exists
     */
    Optional<BeanInstanceProxyInfo> findProxyInfoById(BeanInfoCompositeKey key);
}
