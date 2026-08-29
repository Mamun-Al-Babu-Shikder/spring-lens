package com.sdlcpro.springlens.model.application;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * @author Ixtiyorxon
 * @since 2026-08-28
 */
@DisplayName("ApplicationInfo Domain Model Tests")
class ApplicationInfoTest {

    private static final SpringInfo SPRING = new SpringInfo("3.5.0", "6.2.0");
    private static final JavaInfo JAVA = new JavaInfo("21", "Eclipse Adoptium");
    private static final StartupInfo STARTUP = new StartupInfo(Instant.parse("2026-01-01T00:00:00Z"), Duration.ofSeconds(2));

    @Test
    @DisplayName("Creates an application metadata snapshot")
    void createsSnapshot() {
        var applicationInfo = new ApplicationInfo(
                "orders-service", Set.of("prod"), Set.of("default"), SPRING, JAVA, STARTUP
        );

        assertThat(applicationInfo.name()).isEqualTo("orders-service");
        assertThat(applicationInfo.activeProfiles()).containsExactly("prod");
        assertThat(applicationInfo.defaultProfiles()).containsExactly("default");
        assertThat(applicationInfo.spring()).isEqualTo(SPRING);
        assertThat(applicationInfo.java()).isEqualTo(JAVA);
        assertThat(applicationInfo.startup()).isEqualTo(STARTUP);
    }

    @Test
    @DisplayName("Defensively copies profile sets and exposes them as immutable")
    void defensivelyCopiesProfileSets() {
        var activeProfiles = new HashSet<>(Set.of("dev"));
        var defaultProfiles = new HashSet<>(Set.of("default"));
        var applicationInfo = new ApplicationInfo(
                "orders-service", activeProfiles, defaultProfiles, SPRING, JAVA, STARTUP
        );

        activeProfiles.add("local");
        defaultProfiles.add("fallback");

        assertThat(applicationInfo.activeProfiles()).containsExactly("dev");
        assertThat(applicationInfo.defaultProfiles()).containsExactly("default");
        assertThatThrownBy(() -> applicationInfo.activeProfiles().add("test"))
                .isInstanceOf(UnsupportedOperationException.class);
        assertThatThrownBy(() -> applicationInfo.defaultProfiles().add("test"))
                .isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    @DisplayName("Converts null profile sets to empty immutable sets")
    void convertsNullProfileSetsToEmptyImmutableSets() {
        var applicationInfo = new ApplicationInfo("orders-service", null, null, SPRING, JAVA, STARTUP);

        assertThat(applicationInfo.activeProfiles()).isEmpty();
        assertThat(applicationInfo.defaultProfiles()).isEmpty();
        assertThatThrownBy(() -> applicationInfo.activeProfiles().add("test"))
                .isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    @DisplayName("Rejects missing required application metadata")
    void rejectsMissingRequiredMetadata() {
        assertThatThrownBy(() -> new ApplicationInfo(null, Set.of(), Set.of(), SPRING, JAVA, STARTUP))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new ApplicationInfo("orders-service", Set.of(), Set.of(), null, JAVA, STARTUP))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new ApplicationInfo("orders-service", Set.of(), Set.of(), SPRING, null, STARTUP))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new ApplicationInfo("orders-service", Set.of(), Set.of(), SPRING, JAVA, null))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
