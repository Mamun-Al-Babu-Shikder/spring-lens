package com.sdlcpro.springlens.insight.http.endpoint;

import com.sdlcpro.springlens.matcher.CompositeMatcher;
import com.sdlcpro.springlens.matcher.Matcher;
import com.sdlcpro.springlens.model.http.HttpRequestMethod;
import com.sdlcpro.springlens.model.http.endpoint.HandlerType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Unit test class for validating the behavior of {@link EndpointInfoContext} and its
 * interaction with matchers like {@link CompositeMatcher}.
 * Ensures immutability, defensive copying, correct handling of null/edge cases, and proper matching logic.
 */
class EndpointInfoContextTest {

    /**
     * Verifies that the context enforces immutability by performing defensive copies
     * of collection inputs, preventing external mutations and modifications via returned collections.
     */
    @Test
    @DisplayName("Should enforce immutability and defensive copying on request methods")
    void shouldEnforceImmutabilityAndDefensiveCopying() {
        EnumSet<HttpRequestMethod> mutableMethods = EnumSet.of(HttpRequestMethod.GET, HttpRequestMethod.POST);

        EndpointInfoContext context = new EndpointInfoContext(
                String.class,
                "/api/v1/resource",
                mutableMethods,
                HandlerType.CONTROLLER
        );

        assertThat(context.getClazz()).isEqualTo(String.class);
        assertThat(context.getHttpUri()).isEqualTo("/api/v1/resource");
        assertThat(context.getHttpRequestMethods()).containsExactlyInAnyOrder(HttpRequestMethod.GET, HttpRequestMethod.POST);
        assertThat(context.getHandlerType()).isEqualTo(HandlerType.CONTROLLER);

        mutableMethods.add(HttpRequestMethod.DELETE);
        assertThat(context.getHttpRequestMethods()).doesNotContain(HttpRequestMethod.DELETE);

        var httpMethods = context.getHttpRequestMethods();
        assertThatThrownBy(()->httpMethods.add(HttpRequestMethod.PUT)).isInstanceOf(UnsupportedOperationException.class);
    }

    /**
     * Verifies that providing a null HTTP request methods set is handled gracefully,
     * defaulting to an empty collection.
     */
    @Test
    @DisplayName("Should handle null request methods gracefully by defaulting to empty")
    void shouldHandleNullMethodsGracefully() {
        EndpointInfoContext context = new EndpointInfoContext(
                Integer.class,
                "/api/v2/test",
                null,
                HandlerType.UNKNOWN
        );

        assertThat(context.getHttpRequestMethods()).isEmpty();
        assertThat(context.getClazz()).isEqualTo(Integer.class);
        assertThat(context.getHttpUri()).isEqualTo("/api/v2/test");
        assertThat(context.getHandlerType()).isEqualTo(HandlerType.UNKNOWN);
    }

    /**
     * Verifies that an empty HTTP request methods set is handled correctly.
     */
    @Test
    @DisplayName("Should handle empty request methods set correctly")
    void shouldHandleEmptyMethodsGracefully() {
        EndpointInfoContext context = new EndpointInfoContext(
                Void.class,
                "/api/v3/empty",
                EnumSet.noneOf(HttpRequestMethod.class),
                HandlerType.FUNCTIONAL
        );

        assertThat(context.getHttpRequestMethods()).isEmpty();
        assertThat(context.getHandlerType()).isEqualTo(HandlerType.FUNCTIONAL);
    }

    /**
     * Verifies that the context allocates a new internal collection rather than retaining a reference
     * to the original input collection instance.
     */
    @Test
    @DisplayName("Should copy into a new EnumSet rather than referencing input collection")
    void shouldCopyIntoNewEnumSetNotReferenceInput() {
        EnumSet<HttpRequestMethod> original = EnumSet.of(HttpRequestMethod.GET);
        EndpointInfoContext context = new EndpointInfoContext(
                String.class,
                "/api/test",
                original,
                HandlerType.CONTROLLER
        );

        Set<HttpRequestMethod> returned = context.getHttpRequestMethods();
        assertThat(returned).isNotSameAs(original);
        assertThat(returned).containsExactly(HttpRequestMethod.GET);
    }

    /**
     * Verifies that all enumerated values of {@link HandlerType} are correctly supported.
     */
    @Test
    @DisplayName("Should support all defined HandlerType enum values")
    void shouldSupportAllHandlerTypes() {
        for (HandlerType type : HandlerType.values()) {
            EndpointInfoContext context = new EndpointInfoContext(
                    String.class,
                    "/api/handler",
                    EnumSet.of(HttpRequestMethod.GET),
                    type
            );
            assertThat(context.getHandlerType()).isEqualTo(type);
        }
    }

    /**
     * Verifies that all enumerated values of {@link HttpRequestMethod} are correctly supported.
     */
    @Test
    @DisplayName("Should support all defined HttpRequestMethod enum values")
    void shouldSupportAllHttpRequestMethods() {
        for (HttpRequestMethod method : HttpRequestMethod.values()) {
            EndpointInfoContext context = new EndpointInfoContext(
                    String.class,
                    "/api/method",
                    EnumSet.of(method),
                    HandlerType.CONTROLLER
            );
            assertThat(context.getHttpRequestMethods()).containsExactly(method);
        }
    }

    /**
     * Verifies that equality and hash code contracts are correctly preserved for record structures.
     */
    @Test
    @DisplayName("Should preserve record equality and hash code contracts")
    void shouldPreserveRecordEquality() {
        EndpointInfoContext first = new EndpointInfoContext(
                String.class,
                "/api/v1/resource",
                EnumSet.of(HttpRequestMethod.GET, HttpRequestMethod.POST),
                HandlerType.CONTROLLER
        );

        EndpointInfoContext second = new EndpointInfoContext(
                String.class,
                "/api/v1/resource",
                EnumSet.of(HttpRequestMethod.POST, HttpRequestMethod.GET),
                HandlerType.CONTROLLER
        );

        assertThat(first).isEqualTo(second);
        assertThat(first.hashCode()).isEqualTo(second.hashCode());
    }

    /**
     * Verifies that contexts differing by class, URI, method, or handler type are not equal.
     */
    @Test
    @DisplayName("Should distinguish different records based on their component fields")
    void shouldDistinguishDifferentRecords() {
        EndpointInfoContext base = new EndpointInfoContext(
                String.class,
                "/api/v1/resource",
                EnumSet.of(HttpRequestMethod.GET),
                HandlerType.CONTROLLER
        );

        EndpointInfoContext differentClass = new EndpointInfoContext(
                Integer.class,
                "/api/v1/resource",
                EnumSet.of(HttpRequestMethod.GET),
                HandlerType.CONTROLLER
        );

        EndpointInfoContext differentUri = new EndpointInfoContext(
                String.class,
                "/api/v2/resource",
                EnumSet.of(HttpRequestMethod.GET),
                HandlerType.CONTROLLER
        );

        EndpointInfoContext differentMethod = new EndpointInfoContext(
                String.class,
                "/api/v1/resource",
                EnumSet.of(HttpRequestMethod.POST),
                HandlerType.CONTROLLER
        );

        EndpointInfoContext differentHandlerType = new EndpointInfoContext(
                String.class,
                "/api/v1/resource",
                EnumSet.of(HttpRequestMethod.GET),
                HandlerType.FUNCTIONAL
        );

        assertThat(base).isNotEqualTo(differentClass);
        assertThat(base).isNotEqualTo(differentUri);
        assertThat(base).isNotEqualTo(differentMethod);
        assertThat(base).isNotEqualTo(differentHandlerType);
    }

    /**
     * Verifies that the string representation includes all essential details of the context.
     */
    @Test
    @DisplayName("Should have a descriptive toString implementation")
    void shouldHaveDescriptiveToString() {
        EndpointInfoContext context = new EndpointInfoContext(
                String.class,
                "/api/v1/test",
                EnumSet.of(HttpRequestMethod.GET),
                HandlerType.CONTROLLER
        );

        String str = context.toString();
        assertThat(str).contains("EndpointInfoContext");
        assertThat(str).contains("java.lang.String");
        assertThat(str).contains("/api/v1/test");
        assertThat(str).contains("GET");
        assertThat(str).contains("CONTROLLER");
    }

    /**
     * Verifies correct handling of a single element method set.
     */
    @Test
    @DisplayName("Should handle a set containing a single HTTP method correctly")
    void shouldHandleSingleMethodSet() {
        EndpointInfoContext context = new EndpointInfoContext(
                String.class,
                "/api/v1/single",
                EnumSet.of(HttpRequestMethod.DELETE),
                HandlerType.CONTROLLER
        );

        assertThat(context.getHttpRequestMethods())
                .hasSize(1)
                .containsExactly(HttpRequestMethod.DELETE);
    }

    /**
     * Verifies correct handling of an empty URI string.
     */
    @Test
    @DisplayName("Should handle an empty URI string successfully")
    void shouldHandleEmptyUri() {
        EndpointInfoContext context = new EndpointInfoContext(
                String.class,
                "",
                EnumSet.of(HttpRequestMethod.GET),
                HandlerType.CONTROLLER
        );

        assertThat(context.getHttpUri()).isEmpty();
    }

    /**
     * Verifies evaluation behavior when using a pre-configured {@link CompositeMatcher}.
     */
    @Test
    @DisplayName("Should evaluate successfully with a pre-configured CompositeMatcher")
    void shouldEvaluateSuccessfullyWithCompositeMatcher() {
        EndpointInfoContext context = new EndpointInfoContext(
                EndpointInfoContextTest.class,
                "/api/v1/items",
                EnumSet.of(HttpRequestMethod.GET),
                HandlerType.CONTROLLER
        );

        CompositeMatcher<EndpointInfoContext> compositeMatcher = buildCompositeMatcher();
        assertThat(compositeMatcher.matches(context)).isTrue();
    }

    /**
     * Verifies that a {@link CompositeMatcher} can be instantiated with no arguments.
     */
    @Test
    @DisplayName("Should construct a CompositeMatcher with no arguments")
    void shouldConstructCompositeMatcherWithNoArgs() {
        CompositeMatcher<EndpointInfoContext> matcher = new CompositeMatcher<>();

        EndpointInfoContext context = new EndpointInfoContext(
                EndpointInfoContextTest.class,
                "/api/v1/items",
                EnumSet.of(HttpRequestMethod.GET),
                HandlerType.CONTROLLER
        );

        assertThat(matcher.matches(context)).isTrue();
    }

    /**
     * Verifies that an include matcher can be successfully added via mutation methods.
     */
    @Test
    @DisplayName("Should add an include matcher via mutation method")
    void shouldAddIncludeMatcherViaMutation() {
        CompositeMatcher<EndpointInfoContext> matcher = new CompositeMatcher<>();
        Matcher<EndpointInfoContext> includeMatcher = ctx -> true;

        matcher.addIncludeMatcher(includeMatcher);

        EndpointInfoContext context = new EndpointInfoContext(
                String.class,
                "/api/test",
                EnumSet.of(HttpRequestMethod.GET),
                HandlerType.CONTROLLER
        );
        assertThat(matcher.matches(context)).isTrue();
    }

    /**
     * Verifies that an exclude matcher can be successfully added via mutation methods.
     */
    @Test
    @DisplayName("Should add an exclude matcher via mutation method")
    void shouldAddExcludeMatcherViaMutation() {
        CompositeMatcher<EndpointInfoContext> matcher = new CompositeMatcher<>();
        Matcher<EndpointInfoContext> excludeMatcher = ctx -> false;

        matcher.addExcludeMatcher(excludeMatcher);

        EndpointInfoContext context = new EndpointInfoContext(
                String.class,
                "/api/test",
                EnumSet.of(HttpRequestMethod.GET),
                HandlerType.CONTROLLER
        );
        assertThat(matcher.matches(context)).isTrue();
    }

    /**
     * Verifies handling of a single method set during composite matcher evaluation.
     */
    @Test
    @DisplayName("Should handle single method set during CompositeMatcher evaluation")
    void shouldHandleSingleMethodInCompositeMatcherEvaluation() {
        EndpointInfoContext context = new EndpointInfoContext(
                EndpointInfoContextTest.class,
                "/api/v1/items",
                EnumSet.of(HttpRequestMethod.GET),
                HandlerType.CONTROLLER
        );

        CompositeMatcher<EndpointInfoContext> matcher = new CompositeMatcher<>(
                List.of(ctx -> ctx.getClazz().equals(EndpointInfoContextTest.class)),
                Collections.emptyList()
        );

        assertThat(matcher.matches(context)).isTrue();
    }

    /**
     * Verifies that a mismatched context correctly fails evaluation against the composite matcher.
     */
    @Test
    @DisplayName("Should handle mismatched context in CompositeMatcher evaluation")
    void shouldHandleMismatchedContextInCompositeMatcher() {
        EndpointInfoContext context = new EndpointInfoContext(
                String.class,
                "/api/v2/wrong",
                EnumSet.of(HttpRequestMethod.POST),
                HandlerType.UNKNOWN
        );

        CompositeMatcher<EndpointInfoContext> compositeMatcher = buildCompositeMatcher();

        assertThat(compositeMatcher.matches(context)).isFalse();
    }

    /**
     * Helper method to build a standard {@link CompositeMatcher} for testing.
     *
     * @return a configured instance of {@link CompositeMatcher} for {@link EndpointInfoContext}
     */
    private static CompositeMatcher<EndpointInfoContext> buildCompositeMatcher() {
        Matcher<EndpointInfoContext> classMatcher = ctx -> ctx.getClazz().equals(EndpointInfoContextTest.class);
        Matcher<EndpointInfoContext> uriMatcher = ctx -> ctx.getHttpUri().startsWith("/api/v1/");
        Matcher<EndpointInfoContext> methodMatcher = ctx -> ctx.getHttpRequestMethods().contains(HttpRequestMethod.GET);

        return new CompositeMatcher<>(
                List.of(classMatcher, uriMatcher, methodMatcher),
                Collections.emptyList()
        );
    }
}