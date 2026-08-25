package com.sdlcpro.springlens.model.http.endpoint;

import com.sdlcpro.springlens.model.http.HttpRequestMethod;
import com.sdlcpro.springlens.util.DefensiveCopies;
import com.sdlcpro.springlens.util.Preconditions;

import java.util.List;
import java.util.Set;

/**
 * Immutable snapshot describing a discovered Spring HTTP endpoint.
 * <p>
 * This model captures all routing metadata required by the Spring Lens
 * telemetry engine, including route path, supported HTTP methods,
 * media types, handler information, and method signature details.
 *
 * @param id                unique endpoint identifier
 * @param path              canonical endpoint path
 * @param httpMethods       supported HTTP methods
 * @param consumes          supported request media types
 * @param produces          supported response media types
 * @param handlerClassName  fully qualified handler class name
 * @param handlerMethodName handler method name
 * @param methodParameters  ordered method parameter representations
 * @param returnType        handler return type
 * @param handlerType       handler classification
 */
public record EndpointInfo(
        int id,
        String path,
        Set<HttpRequestMethod> httpMethods,
        Set<String> consumes,
        Set<String> produces,
        String handlerClassName,
        String handlerMethodName,
        List<String> methodParameters,
        String returnType,
        HandlerType handlerType
) {

    public EndpointInfo {

        Preconditions.isTrue(
                id > 0,
                "EndpointInfo id must be positive value"
        );

        Preconditions.notNull(
                path,
                "EndpointInfo path must not be null"
        );

        Preconditions.notEmpty(
                httpMethods,
                "Set of httpMethods must not be empty"
        );

        Preconditions.hasText(
                handlerClassName,
                "EndpointInfo handlerClassName must be provided"
        );

        Preconditions.hasText(
                handlerMethodName,
                "EndpointInfo handlerMethodName must be provided"
        );

        Preconditions.hasText(
                returnType,
                "EndpointInfo returnType must be provided"
        );

        Preconditions.notNull(
                handlerType,
                "EndpointInfo handlerType must not be null"
        );

        httpMethods = DefensiveCopies.immutableEnumSetOrEmpty(httpMethods);
        consumes = DefensiveCopies.immutableSetOrEmpty(consumes);
        produces = DefensiveCopies.immutableSetOrEmpty(produces);
        methodParameters = DefensiveCopies.immutableListOrEmpty(methodParameters);
    }
}
