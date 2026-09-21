package com.sdlcpro.springlens.model.bean.instance;

import com.sdlcpro.springlens.model.bean.ProxyType;
import com.sdlcpro.springlens.util.Preconditions;

import java.util.List;

/**
 * Captures structural runtime information regarding AOP and CGLIB proxies 
 * wrapping a Spring bean bean=instance.
 */
public record BeanInstanceProxyInfo(
        String targetClass,
        List<String> advices,
        List<String> proxiedInterfaces,
        boolean adviceFrozen,
        ProxyType proxyType
) {
    public BeanInstanceProxyInfo {
        Preconditions.notNull(proxyType, "Proxy type must not be null");
        advices = advices == null ? List.of() : List.copyOf(advices);
        proxiedInterfaces = proxiedInterfaces == null ? List.of() : List.copyOf(proxiedInterfaces);
    }
}
