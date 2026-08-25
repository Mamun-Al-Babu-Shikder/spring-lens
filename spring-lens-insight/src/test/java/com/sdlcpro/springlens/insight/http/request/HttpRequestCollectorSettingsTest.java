package com.sdlcpro.springlens.insight.http.request;

import com.sdlcpro.springlens.model.http.HttpRequestMethod;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.EnumSet;
import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

public class HttpRequestCollectorSettingsTest {

    @Test
    @DisplayName("Mutating external standard Set after construction does not alter record state")
    public void mutatingOriginalSetDoesNotAffectRecord()
    {
        Set<String> originalIncludeUriPattern = new HashSet<>();
        originalIncludeUriPattern.add("/api/v1/users");

        Set<String> originalMaskableHeaders = new HashSet<>();
        originalMaskableHeaders.add("Authorization");

        var settings = new HttpRequestCollectorSettings(
                originalIncludeUriPattern,
                Set.of(),
                true,
                true,
                        1024,
                EnumSet.noneOf(HttpRequestMethod.class),
                originalMaskableHeaders,
                Set.of()
        );

        originalIncludeUriPattern.add("/api/v1/admin");
        originalIncludeUriPattern.clear();

        originalMaskableHeaders.add("X-API-KEY");

        assertThat(settings.includeUriPatterns())
                .containsExactly("/api/v1/users")
                .doesNotContain("/api/v1/admin");

        assertThat(settings.maskableHeaders())
                .containsExactly("Authorization");
    }

    @Test
    @DisplayName("Mutating external EnumSet after construction does not alter record state")
    public void mutatingOriginalEnumSetDoesNotAffectRecord() {
        var originalMethods = EnumSet.of(HttpRequestMethod.GET);

        var settings = new HttpRequestCollectorSettings(
          Set.of(),
          Set.of(),
          true,
          true,1024,
          originalMethods,
          Set.of(),
          Set.of()
        );

        originalMethods.add(HttpRequestMethod.POST);
        originalMethods.add(HttpRequestMethod.DELETE);

        assertThat(settings.excludeMethods())
                .containsExactly(HttpRequestMethod.GET)
                .doesNotContain(HttpRequestMethod.POST);
    }

    @Test
    @DisplayName("Returned standard sets are immutable and throw on mutation attempts")
    void returnedStandardSetsAreImmutable() {
        HttpRequestCollectorSettings settings = new HttpRequestCollectorSettings(
                Set.of("/api/v1/test"),
                Set.of(),
                true,
                true,
                1024,
                EnumSet.noneOf(HttpRequestMethod.class),
                Set.of(),
                Set.of()
        );

        Set<String> patterns = settings.includeUriPatterns();

        assertThatThrownBy(() -> patterns.add("/api/v1/leak"))
                .isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    @DisplayName("Mutating returned EnumSet accessor does not leak into record state")
    void mutatingReturnedEnumSetDoesNotAffectRecord() {
        HttpRequestCollectorSettings settings = new HttpRequestCollectorSettings(
                Set.of(),
                Set.of(),
                true,
                true,
                1024,
                EnumSet.of(HttpRequestMethod.GET),
                Set.of(),
                Set.of()
        );

        assertThatThrownBy(()-> settings.excludeMethods().add(HttpRequestMethod.POST))
                .isInstanceOf(UnsupportedOperationException.class);

        assertThat(settings.excludeMethods())
                .containsExactly(HttpRequestMethod.GET);
    }
}
