package com.sdlcpro.springlens.insight.http.endpoint;

import com.sdlcpro.springlens.insight.http.HttpRequestMethodProvider;
import com.sdlcpro.springlens.insight.http.HttpUriProvider;
import com.sdlcpro.springlens.insight.support.provider.ClassProvider;
import com.sdlcpro.springlens.model.http.HttpRequestMethod;
import com.sdlcpro.springlens.model.http.endpoint.HandlerType;
import com.sdlcpro.springlens.util.DefensiveCopies;

import java.util.Set;

/**
 * A package-private context evaluation record that acts as a unified adapter
 * wrapping endpoint candidate properties during framework scanning.
 * <p>
 * Implements provider contracts to allow composite matchers to seamlessly inspect
 * candidate routes across target classes, URI patterns, HTTP methods, and handler types.
 *
 * @author sdlc-pro
 * @since 1.0
 */
record EndpointInfoContext(
        Class<?> clazz,
        String uri,
        Set<HttpRequestMethod> methods,
        HandlerType handlerType
) implements ClassProvider, HttpUriProvider, HttpRequestMethodProvider, HandlerTypeProvider {

    /**
     * Compact constructor for {@code EndpointInfoContext} that ensures defensive
     * copying and non-null handling for the HTTP methods set to maintain immutability.
     */
    EndpointInfoContext {
        methods = DefensiveCopies.immutableEnumSetOrEmpty(methods);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public Class<?> getClazz() {
        return this.clazz;
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public String getHttpUri() {
        return this.uri;
    }

    /**
     * Returns an unmodifiable view of the HTTP request methods supported by this endpoint.
     *
     * @return the Set of {@link HttpRequestMethod}s
     */
    @Override
    public Set<HttpRequestMethod> getHttpRequestMethods() {
        return this.methods;
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public HandlerType getHandlerType() {
        return this.handlerType;
    }
}
