package com.sdlcpro.springlens.model.bean.definition;

import com.sdlcpro.springlens.model.bean.BeanRole;
import com.sdlcpro.springlens.model.bean.LoadingMode;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class BeanDefinitionSummaryTest {

    @Test
    void shouldRejectNegativeTotalBeanDefinitions() {
        assertThatThrownBy(() -> new BeanDefinitionSummary(
                Map.of(),
                Map.of(),
                Map.of(),
                Map.of(),
                -1L
        ))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Total bean bean-definition count must not be negative value");
    }

    @Test
    void shouldDefensivelyCopyDistributionMaps() {
        Map<String, Integer> contexts = new HashMap<>();
        contexts.put("application", 5);

        Map<String, Integer> scopes = new HashMap<>();
        scopes.put("singleton", 5);

        Map<BeanRole, Integer> roles = new HashMap<>();
        roles.put(BeanRole.ROLE_APPLICATION, 5);

        Map<LoadingMode, Integer> loadingModes = new HashMap<>();
        loadingModes.put(LoadingMode.EAGER, 5);

        BeanDefinitionSummary summary = new BeanDefinitionSummary(
                contexts,
                scopes,
                roles,
                loadingModes,
                5L
        );

        contexts.put("another-context", 10);
        scopes.put("prototype", 10);
        roles.put(BeanRole.ROLE_INFRASTRUCTURE, 10);
        loadingModes.put(LoadingMode.LAZY, 10);

        assertThat(summary.contextDistribution())
                .containsExactly(Map.entry("application", 5));

        assertThat(summary.scopeDistribution())
                .containsExactly(Map.entry("singleton", 5));

        assertThat(summary.roleDistribution())
                .containsExactly(Map.entry(BeanRole.ROLE_APPLICATION, 5));

        assertThat(summary.loadingModeDistribution())
                .containsExactly(Map.entry(LoadingMode.EAGER, 5));
    }

    @Test
    void shouldExposeImmutableDistributionMaps() {
        BeanDefinitionSummary summary = new BeanDefinitionSummary(
                Map.of("application", 5),
                Map.of("singleton", 5),
                Map.of(BeanRole.ROLE_APPLICATION, 5),
                Map.of(LoadingMode.EAGER, 5),
                5L
        );

        assertThatThrownBy(() ->
                summary.contextDistribution().put("another", 1))
                .isInstanceOf(UnsupportedOperationException.class);

        assertThatThrownBy(() ->
                summary.scopeDistribution().put("prototype", 1))
                .isInstanceOf(UnsupportedOperationException.class);

        assertThatThrownBy(() ->
                summary.roleDistribution().put(BeanRole.ROLE_INFRASTRUCTURE, 1))
                .isInstanceOf(UnsupportedOperationException.class);

        assertThatThrownBy(() ->
                summary.loadingModeDistribution().put(LoadingMode.LAZY, 1))
                .isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    void shouldTreatNullDistributionMapsAsEmpty() {
        BeanDefinitionSummary summary = new BeanDefinitionSummary(
                null,
                null,
                null,
                null,
                0L
        );

        assertThat(summary.contextDistribution()).isEmpty();
        assertThat(summary.scopeDistribution()).isEmpty();
        assertThat(summary.roleDistribution()).isEmpty();
        assertThat(summary.loadingModeDistribution()).isEmpty();
    }

    @Test
    void emptyShouldReturnZeroedSummary() {
        BeanDefinitionSummary summary = BeanDefinitionSummary.empty();

        assertThat(summary.contextDistribution()).isEmpty();
        assertThat(summary.scopeDistribution()).isEmpty();
        assertThat(summary.roleDistribution()).isEmpty();
        assertThat(summary.loadingModeDistribution()).isEmpty();
        assertThat(summary.totalBeanDefinitions()).isZero();
    }
}
