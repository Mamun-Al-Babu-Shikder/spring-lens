package com.sdlcpro.springlens.constant;

import java.util.Collections;
import java.util.EnumSet;
import java.util.Locale;
import java.util.Set;

public enum SpringFrameworkModule {

    AI("org.springframework.ai.**"),
    AMQP("org.springframework.amqp.**"),
    AOP("org.springframework.aop.**"),
    BEANS("org.springframework.beans.**"),
    BATCH("org.springframework.batch.**"),
    CACHE("org.springframework.cache.**"),
    CONTEXT("org.springframework.context.**"),
    CORE("org.springframework.core.**"),
    CLOUD("org.springframework.cloud.**"),
    DATA("org.springframework.data.**"),
    EXPRESSION("org.springframework.expression.**"),
    GRAPHQL("org.springframework.graphql.**"),
    HTTP("org.springframework.http.**"),
    INSTRUMENT("org.springframework.instrument.**"),
    INTEGRATION("org.springframework.integration.**"),
    JDBC("org.springframework.jdbc.**"),
    JMS("org.springframework.jms.**"),
    JMX("org.springframework.jmx.**"),
    JNDI("org.springframework.jndi.**"),
    KAFKA("org.springframework.kafka.**"),
    MESSAGING("org.springframework.messaging.**"),
    ORM("org.springframework.orm.**"),
    OXM("org.springframework.oxm.**"),
    R2DBC("org.springframework.r2dbc.**"),
    SCHEDULER("org.springframework.scheduling.**"),
    SECURITY("org.springframework.security.**"),
    SESSION("org.springframework.session.**"),
    SHELL("org.springframework.shell.**"),
    TEST("org.springframework.test.**"),
    TRANSACTION("org.springframework.transaction.**"),
    UTIL("org.springframework.util.**"),
    VALIDATION("org.springframework.validation.**"),
    WEB("org.springframework.web.**"),
    WEBFLUX("org.springframework.web.reactive.**"),
    WEBMVC("org.springframework.web.servlet.**"),
    WEBSOCKET("org.springframework.web.socket.**"),
    BOOT("org.springframework.boot.**"),
    ALL(null);

    private static final SpringFrameworkModule[] VALUES;
    private static final Set<SpringFrameworkModule> MODULES;

    private final String packagePattern;

    static {
        VALUES = values();

        var moduleEnumSet = EnumSet.allOf(SpringFrameworkModule.class);
        moduleEnumSet.remove(ALL);
        MODULES = Collections.unmodifiableSet(moduleEnumSet);
    }

    SpringFrameworkModule(String packagePattern) {
        this.packagePattern = packagePattern;
    }

    public String getPackagePattern() {
        return packagePattern;
    }

    public static Set<SpringFrameworkModule> modules() {
        return MODULES;
    }

    public static SpringFrameworkModule from(String name) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("SpringFrameworkModule name must not be null or blank");
        }

        var normalized = name.trim().toUpperCase(Locale.ROOT);
        for (var value : VALUES) {
            if (value.name().equals(normalized)) {
                return value;
            }
        }

        throw new IllegalArgumentException("SpringFrameworkModule not found by name: " + name);
    }
}
