package com.sdlcpro.springlens.insight.bean;

import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import com.sdlcpro.springlens.insight.support.matcher.AnnotatedClassMatcher;
import com.sdlcpro.springlens.insight.support.provider.ClassProvider;

import java.util.Set;

/**
 * Matches components marked with the {@link SpringLensInternalComponent} annotation.
 *
 * <p>By encapsulating the check for internal framework components, this matcher enables
 * condition report filters, bean definition processors, and instance collectors to
 * selectively include or exclude SpringLens internal infrastructure from inspection reports.</p>
 *
 * @param <T> the type of context being matched; must provide a class
 * @since 1.0.0
 */
public class ToolInternalComponentMatcher<T extends ClassProvider> extends AnnotatedClassMatcher<T> {

    /**
     * Creates a matcher that recognizes classes annotated with
     * {@link SpringLensInternalComponent}.
     */
    public ToolInternalComponentMatcher() {
        super(Set.of(SpringLensInternalComponent.class));
    }
}
