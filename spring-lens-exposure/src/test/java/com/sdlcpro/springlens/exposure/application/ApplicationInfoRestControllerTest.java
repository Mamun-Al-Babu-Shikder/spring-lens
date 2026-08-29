package com.sdlcpro.springlens.exposure.application;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializerProvider;
import com.fasterxml.jackson.databind.module.SimpleModule;
import com.sdlcpro.springlens.model.application.ApplicationInfo;
import com.sdlcpro.springlens.model.application.JavaInfo;
import com.sdlcpro.springlens.model.application.SpringInfo;
import com.sdlcpro.springlens.model.application.StartupInfo;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.Set;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Verifies the HTTP exposure of application runtime metadata.
 *
 * @author Ixtiyorxon
 * @since 2026-08-28
 */
@DisplayName("ApplicationInfoRestController Tests")
class ApplicationInfoRestControllerTest {

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        var applicationInfo = new ApplicationInfo(
                "orders-service",
                Set.of("prod"),
                Set.of("default"),
                new SpringInfo("3.2.0", "6.1.0"),
                new JavaInfo("17", "Eclipse Adoptium"),
                new StartupInfo(Instant.parse("2026-08-28T10:00:00Z"), Duration.ofMillis(450))
        );

        mockMvc = MockMvcBuilders.standaloneSetup(new ApplicationInfoRestController(() -> applicationInfo))
                .setMessageConverters(new MappingJackson2HttpMessageConverter(objectMapper()))
                .build();
    }

    @Test
    @DisplayName("GET application endpoint returns application metadata as JSON")
    void returnsApplicationInfoAsJson() throws Exception {
        mockMvc.perform(get("/spring-lens/api/application").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("orders-service"))
                .andExpect(jsonPath("$.activeProfiles[0]").value("prod"))
                .andExpect(jsonPath("$.defaultProfiles[0]").value("default"))
                .andExpect(jsonPath("$.spring.bootVersion").value("3.2.0"))
                .andExpect(jsonPath("$.spring.frameworkVersion").value("6.1.0"))
                .andExpect(jsonPath("$.java.version").value("17"))
                .andExpect(jsonPath("$.java.vendor").value("Eclipse Adoptium"))
                .andExpect(jsonPath("$.startup.startedAt").value("2026-08-28T10:00:00Z"))
                .andExpect(jsonPath("$.startup.startupDuration").value("PT0.45S"));
    }

    private ObjectMapper objectMapper() {
        var module = new SimpleModule();
        module.addSerializer(Instant.class, stringSerializer());
        module.addSerializer(Duration.class, stringSerializer());
        return new ObjectMapper().registerModule(module);
    }

    private <T> JsonSerializer<T> stringSerializer() {
        return new JsonSerializer<>() {
            @Override
            public void serialize(T value, JsonGenerator generator, SerializerProvider provider) throws IOException {
                generator.writeString(value.toString());
            }
        };
    }
}
