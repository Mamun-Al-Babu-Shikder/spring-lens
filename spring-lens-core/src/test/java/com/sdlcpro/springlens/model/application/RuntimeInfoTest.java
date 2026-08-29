package com.sdlcpro.springlens.model.application;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * @author Ixtiyorxon
 * @since 2026-08-28
 */
@DisplayName("Runtime Metadata Domain Model Tests")
class RuntimeInfoTest {

    @Test
    @DisplayName("Creates Spring, Java, and startup metadata")
    void createsRuntimeMetadata() {
        var startedAt = Instant.parse("2026-01-01T00:00:00Z");
        var springInfo = new SpringInfo("3.5.0", "6.2.0");
        var javaInfo = new JavaInfo("21", "Eclipse Adoptium");
        var startupInfo = new StartupInfo(startedAt, Duration.ofMillis(250));

        assertThat(springInfo.bootVersion()).isEqualTo("3.5.0");
        assertThat(springInfo.frameworkVersion()).isEqualTo("6.2.0");
        assertThat(javaInfo.version()).isEqualTo("21");
        assertThat(javaInfo.vendor()).isEqualTo("Eclipse Adoptium");
        assertThat(startupInfo.startedAt()).isEqualTo(startedAt);
        assertThat(startupInfo.startupDuration()).isEqualTo(Duration.ofMillis(250));
    }

    @Test
    @DisplayName("Rejects invalid runtime metadata")
    void rejectsInvalidRuntimeMetadata() {
        assertThatThrownBy(() -> new SpringInfo(null, "6.2.0")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new JavaInfo("21", " ")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new StartupInfo(null, Duration.ZERO)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new StartupInfo(Instant.now(), null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new StartupInfo(Instant.now(), Duration.ofMillis(-1))).isInstanceOf(IllegalArgumentException.class);
    }
}
