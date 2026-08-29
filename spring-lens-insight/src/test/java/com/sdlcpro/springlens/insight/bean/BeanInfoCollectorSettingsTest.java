package com.sdlcpro.springlens.insight.bean;

import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class BeanInfoCollectorSettingsTest {

    @Test
    void mutatingSourceSetAfterConstructionDoesNotAffectRecord() {
        Set<String> packages = new HashSet<>(Set.of("com.example.internal"));
        Set<String> classes = new HashSet<>(Set.of("com.example.Foo"));

        BeanInfoCollectorSettings settings =
                new BeanInfoCollectorSettings(true, false, false, packages, classes);

        packages.add("com.example.hacked");
        classes.add("com.example.Injected");

        assertThat(settings.excludePackagePatterns())
                .containsExactly("com.example.internal");
        assertThat(settings.excludeClasses())
                .containsExactly("com.example.Foo");
    }

    @Test
    void internalSetsAreImmutable() {
        BeanInfoCollectorSettings settings = new BeanInfoCollectorSettings(
                true, true, true, Set.of("com.example"), Set.of("com.example.Foo"));

        assertThatThrownBy(() -> settings.excludePackagePatterns().add("x"))
                .isInstanceOf(UnsupportedOperationException.class);

        assertThatThrownBy(() -> settings.excludeClasses().add("y"))
                .isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    void nullSetsAreNormalizedToEmptySet() {
        BeanInfoCollectorSettings settings =
                new BeanInfoCollectorSettings(false, false, false, null, null);

        assertThat(settings.excludePackagePatterns()).isEmpty();
        assertThat(settings.excludeClasses()).isEmpty();
    }

    @Test
    void booleanFlagsAreStoredAsIs() {
        BeanInfoCollectorSettings settings =
                new BeanInfoCollectorSettings(true, false, false, Set.of(), Set.of());

        assertThat(settings.includeInfraRole()).isTrue();
        assertThat(settings.includeToolInternal()).isFalse();
    }

    @Test
    void equalsAndHashCodeWorkAsValueObject() {
        BeanInfoCollectorSettings a = new BeanInfoCollectorSettings(
                true, false, false, Set.of("p1"), Set.of("c1"));
        BeanInfoCollectorSettings b = new BeanInfoCollectorSettings(
                true, false, false, Set.of("p1"), Set.of("c1"));

        assertThat(a).isEqualTo(b).hasSameHashCodeAs(b);
    }

    @Test
    void alreadyImmutableSetDoesNotBreakCompactConstructor() {
        BeanInfoCollectorSettings settings =
                new BeanInfoCollectorSettings(true, true, true, Set.of(), Set.of());

        assertThat(settings.excludePackagePatterns()).isEmpty();
        assertThat(settings.excludeClasses()).isEmpty();
    }
}