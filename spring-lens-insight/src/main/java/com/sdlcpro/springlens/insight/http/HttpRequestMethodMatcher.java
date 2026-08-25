package com.sdlcpro.springlens.insight.http;

import com.sdlcpro.springlens.matcher.Matcher;
import com.sdlcpro.springlens.model.http.HttpRequestMethod;
import com.sdlcpro.springlens.util.DefensiveCopies;

import java.util.Set;

/**
 * A concrete {@link Matcher} implementation that evaluates whether candidate HTTP request methods
 * match any of the configured target {@link HttpRequestMethod} types.
 *
 * <p>This matcher is designed to be used in composite evaluation pipelines for filtering
 * candidate routes by matching supported HTTP verbs during endpoint scanning and route evaluation.
 *
 * <p>The matcher consumes evaluation contexts that implement {@link HttpRequestMethodProvider}
 * and returns {@code true} if any of the HTTP methods provided by the context match one of the
 * configured target methods.
 *
 * <p>This class is immutable and thread-safe. The internal set of target HTTP methods is
 * defensively copied during construction to guarantee immutability.
 *
 * @param <T> the type of the evaluation context, which must extend {@link HttpRequestMethodProvider}
 * @see HttpRequestMethodProvider
 * @see HttpRequestMethod
 * @see Matcher
 * @since 1.0.0
 */
public final class HttpRequestMethodMatcher<T extends HttpRequestMethodProvider> implements Matcher<T> {

    /**
     * The immutable set of HTTP request methods that this matcher will match against.
     */
    private final Set<HttpRequestMethod> httpRequestMethods;

    /**
     * Constructs a new {@code HttpRequestMethodMatcher} with the specified target HTTP methods.
     *
     * <p>The provided set is defensively copied using {@link DefensiveCopies} to ensure
     * internal immutability. If the provided set is {@code null}, an empty set is used, which
     * results in this matcher always returning {@code false} (since no methods will match).
     *
     * @param httpRequestMethods the target HTTP request methods to match against; may be {@code null}
     */
    public HttpRequestMethodMatcher(Set<HttpRequestMethod> httpRequestMethods) {
        this.httpRequestMethods = DefensiveCopies.immutableEnumSetOrEmpty(httpRequestMethods);
    }

    /**
     * Evaluates whether the provided evaluation context contains any HTTP method that matches
     * the configured target methods.
     *
     * <p>The matching logic proceeds as follows:
     * <ol>
     *   <li>If the provided context is {@code null}, returns {@code false}.</li>
     *   <li>Retrieves the set of HTTP methods from the context via
     *       {@link HttpRequestMethodProvider#getHttpRequestMethods()}.</li>
     *   <li>If the retrieved set is {@code null} or empty, returns {@code false}.</li>
     *   <li>Iterates through the candidate methods and returns {@code true} if any candidate
     *       method is contained in the configured target set.</li>
     *   <li>If no candidate methods match, returns {@code false}.</li>
     * </ol>
     *
     * @param context the evaluation context providing the candidate HTTP methods; may be {@code null}
     * @return {@code true} if any candidate HTTP method matches a configured target method;
     * {@code false} otherwise
     */
    @Override
    public boolean matches(T context) {
        if (context == null) {
            return false;
        }

        var httpMethods = context.getHttpRequestMethods();
        if (httpMethods == null || httpMethods.isEmpty()) {
            return false;
        }

        for (HttpRequestMethod method : httpMethods) {
            if (this.httpRequestMethods.contains(method)) {
                return true;
            }
        }

        return false;
    }
}
