package com.sdlcpro.springlens.inspector.application;

import com.sdlcpro.springlens.model.application.ApplicationInfo;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifies the {@link ApplicationInfoInspector} contract.
 *
 * @author Ixtiyorxon
 * @since 2026-08-28
 */
@DisplayName("ApplicationInfoInspector Contract Tests")
class ApplicationInfoInspectorTest {

    @Test
    @DisplayName("Declares an inspect method that returns ApplicationInfo")
    void declaresInspectMethodReturningApplicationInfo() throws NoSuchMethodException {
        var inspectMethod = ApplicationInfoInspector.class.getDeclaredMethod("inspect");

        assertThat(ApplicationInfoInspector.class.isInterface()).isTrue();
        assertThat(inspectMethod.getParameterCount()).isZero();
        assertThat(inspectMethod.getReturnType()).isEqualTo(ApplicationInfo.class);
    }
}
