package com.sdlcpro.springlens.insight.http.request;

import com.sdlcpro.springlens.model.http.HttpRequestMethod;

import java.util.Set;

import static com.sdlcpro.springlens.util.DefensiveCopies.*;


/**
 * Immutable configuration settings for collecting HTTP request and response data.
 * <p>
 * This record provides defensive copying and null-safety for all collection components
 * during initialization. All collection accessors return unmodifiable or defensively
 * copied views to guarantee thread safety and prevent external state mutation.
 * </p>
 *
 * @param includeUriPatterns set of URI regex patterns or paths to include in collection;
 *                           if {@code null}, defaults to an empty immutable set
 * @param excludeUriPatterns set of URI regex patterns or paths to exclude from collection;
 *                           if {@code null}, defaults to an empty immutable set
 * @param includeRequestBody {@code true} to capture request payload body content;
 *                           {@code false} otherwise
 * @param includeResponseBody {@code true} to capture response payload body content;
 *                            {@code false} otherwise
 * @param maxBodyLength maximum allowed payload length in bytes to capture for bodies;
 *                      must be non-negative
 * @param excludeMethods HTTP methods to bypass during data collection;
 *                       if {@code null}, defaults to an empty set
 * @param maskableHeaders set of HTTP header keys (case-insensitive) whose values should be
 *                        redacted/masked; if {@code null}, defaults to an empty immutable set
 * @param maskableParams set of HTTP request parameter names whose values should be
 *                       redacted/masked; if {@code null}, defaults to an empty immutable set
 */
public record HttpRequestCollectorSettings(
        Set<String> includeUriPatterns,
        Set<String> excludeUriPatterns,
        boolean includeRequestBody,
        boolean includeResponseBody,
        int maxBodyLength,
        Set<HttpRequestMethod> excludeMethods,
        Set<String> maskableHeaders,
        Set<String> maskableParams

) {
    /**
     * Compact constructor enforcing null-safety, defensive copying, and structural invariants.
     */
    public HttpRequestCollectorSettings
    {
        includeUriPatterns = immutableSetOrEmpty(includeUriPatterns);
        excludeUriPatterns = immutableSetOrEmpty(excludeUriPatterns);
        maskableHeaders = immutableSetOrEmpty(maskableHeaders);
        maskableParams = immutableSetOrEmpty(maskableParams);

        // EnumSet : null-safe defensive copy.
        excludeMethods = immutableEnumSetOrEmpty(excludeMethods);

        if (maxBodyLength < 0) {
            throw new IllegalArgumentException("maxBodyLength must be a positive integer cannot be negative");
        }
    }

    @Override
    public Set<HttpRequestMethod> excludeMethods() {
        return this.excludeMethods;
    }
}
