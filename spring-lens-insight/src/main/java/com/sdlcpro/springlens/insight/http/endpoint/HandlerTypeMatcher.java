package com.sdlcpro.springlens.insight.http.endpoint;

import com.sdlcpro.springlens.matcher.Matcher;
import com.sdlcpro.springlens.model.http.endpoint.HandlerType;
import com.sdlcpro.springlens.util.DefensiveCopies;
import org.springframework.util.CollectionUtils;

import java.util.Collection;
import java.util.Set;

/**
 * A concrete {@link Matcher} that filters and evaluates candidate HTTP endpoints
 * based on their designated {@link HandlerType}.
 *
 * <p>This matcher integrates into composite evaluation pipelines by consuming
 * objects that implement {@link HandlerTypeProvider}, allowing framework scanning
 * components to filter routes based on handler classifications — such as
 * controller methods, functional WebFlux handlers, or custom/unknown handlers —
 * in a type-safe manner.</p>
 *
 * <p>The configured target set is defensively copied into an immutable
 * {@link Set} at construction time. A {@code null} or empty input set
 * yields an empty matching set, which causes every evaluation to fail.</p>
 *
 * @param <T> the type of context being matched; must expose its
 *            {@link HandlerType} via {@link HandlerTypeProvider}
 * @see HandlerTypeProvider
 * @see HandlerType
 * @see Matcher
 * @since 1.0.0
 */
public class HandlerTypeMatcher<T extends HandlerTypeProvider> implements Matcher<T> {

    private final Set<HandlerType> handlerTypes;

    /**
     * Creates a matcher that accepts contexts whose {@link HandlerType} is
     * contained in the given set.
     *
     * <p>When {@code handlerTypes} is {@code null} or empty, an empty
     * {@link Set} is used and {@link #matches} will always return
     * {@code false}. Otherwise the set is copied via
     * {@link DefensiveCopies#immutableEnumSetOrEmpty(Collection)} )} to guarantee immutability
     * of the matcher's internal state.</p>
     *
     * @param handlerTypes the handler types to match against; may be
     *                     {@code null} or empty
     */
    public HandlerTypeMatcher(Set<HandlerType> handlerTypes) {
        this.handlerTypes = DefensiveCopies.immutableEnumSetOrEmpty(handlerTypes);
    }

    /**
     * Evaluates whether the given context's handler type is among the
     * configured target types.
     *
     * <p>Returns {@code false} when {@code context} is {@code null}, when
     * {@link HandlerTypeProvider#getHandlerType()} returns {@code null}, or
     * when the configured handler-type set is empty. Otherwise returns
     * whether the candidate's handler type is contained in the matching set.</p>
     *
     * @param context the evaluation context providing a {@link HandlerType};
     *                may be {@code null}
     * @return {@code true} if the context's handler type is accepted by this
     * matcher; {@code false} otherwise
     */
    @Override
    public boolean matches(T context) {
        if (context == null || context.getHandlerType() == null || CollectionUtils.isEmpty(this.handlerTypes)) {
            return false;
        }

        return this.handlerTypes.contains(context.getHandlerType());
    }
}
