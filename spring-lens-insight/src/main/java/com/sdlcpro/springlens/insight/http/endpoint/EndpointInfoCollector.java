package com.sdlcpro.springlens.insight.http.endpoint;

import com.sdlcpro.springlens.model.http.endpoint.EndpointInfo;
import org.springframework.web.servlet.HandlerMapping;

import java.util.List;

/**
 * Strategy interface for extracting {@link EndpointInfo} metadata from a
 * Spring {@link HandlerMapping} implementation.
 *
 * <p>Concrete implementations are responsible for inspecting a specific
 * {@code HandlerMapping} type (e.g. {@code RequestMappingHandlerMapping})
 * and collecting endpoint details relevant to that mapping strategy.</p>
 */
public interface EndpointInfoCollector {

    /**
     * Evaluates whether this collector is able to process the given
     * {@link HandlerMapping} bean=instance.
     *
     * @param mapping the handler mapping to evaluate
     * @return {@code true} if this collector supports the given mapping type,
     *         {@code false} by default
     */
    default boolean supports(HandlerMapping mapping) {
        return false;
    }

    /**
     * Extracts endpoint metadata from the given {@link HandlerMapping}.
     *
     * @param mapping the handler mapping to inspect
     * @return a list of {@link EndpointInfo} snapshots discovered within the mapping
     */
    List<EndpointInfo> collect(HandlerMapping mapping);
}