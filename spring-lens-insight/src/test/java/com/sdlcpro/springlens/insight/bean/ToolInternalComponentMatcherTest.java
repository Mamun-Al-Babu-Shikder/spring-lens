package com.sdlcpro.springlens.insight.bean;

import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import com.sdlcpro.springlens.insight.support.provider.ClassProvider;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ToolInternalComponentMatcherTest {

    private final ToolInternalComponentMatcher<ClassProvider> matcher = new ToolInternalComponentMatcher<>();

    @Test
    void shouldMatchClassAnnotatedAsSpringLensInternalComponent() {
        assertTrue(matcher.matches(() -> AnnotatedComponent.class));
    }

    @Test
    void shouldNotMatchClassWithoutSpringLensInternalComponentAnnotation() {
        assertFalse(matcher.matches(() -> UnannotatedComponent.class));
    }

    @SpringLensInternalComponent
    private static class AnnotatedComponent {
    }

    private static class UnannotatedComponent {
    }
}
