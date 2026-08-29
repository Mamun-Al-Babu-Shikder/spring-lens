package com.sdlcpro.springlens.inspector.bean;

import com.sdlcpro.springlens.model.bean.BeanInfoCompositeKey;
import com.sdlcpro.springlens.model.bean.instance.BeanInstanceProxyInfo;

/**
 * Inspects Spring bean instances to extract proxy metadata.
 */
public interface BeanProxyInfoInspector {

    /**
     * Inspects the specified bean and extracts its proxy metadata.
     *
     * @param key the {@link BeanInfoCompositeKey} with components contextId and beanName
     * @return proxy information for the bean, or {@code null} if the bean
     * does not exist or is not proxied
     */
    BeanInstanceProxyInfo inspectBy(BeanInfoCompositeKey key);
}
