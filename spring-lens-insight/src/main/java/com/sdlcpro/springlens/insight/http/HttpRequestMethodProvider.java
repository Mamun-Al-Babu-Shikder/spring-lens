package com.sdlcpro.springlens.insight.http;

import com.sdlcpro.springlens.model.http.HttpRequestMethod;

import java.util.Set;

/**
 * A functional provider interface that exposes the set of {@link HttpRequestMethod}
 * values supported by a target HTTP endpoint or request context.
 *
 * <p>By abstracting the supported request verbs behind this provider contract,
 * interceptors, endpoint mapping parsers, and filter components can uniformly
 * query which HTTP methods (such as {@link HttpRequestMethod#GET GET} or
 * {@link HttpRequestMethod#POST POST}) a mapping path accepts without depending
 * on the concrete model that produced the classification.</p>
 *
 * <p>Because this interface declares exactly one abstract method, it is marked
 * as a {@link FunctionalInterface} and can be expressed as a lambda expression
 * or method reference.</p>
 *
 * @see HttpRequestMethod
 * @since 1.0.0
 */
@FunctionalInterface
public interface HttpRequestMethodProvider {

    /**
     * Returns the set of HTTP request methods supported by the target mapping.
     *
     * @return the Set of supported {@link HttpRequestMethod} values; never
     * {@code null}, though it may be empty when no methods are declared
     */
    Set<HttpRequestMethod> getHttpRequestMethods();
}
