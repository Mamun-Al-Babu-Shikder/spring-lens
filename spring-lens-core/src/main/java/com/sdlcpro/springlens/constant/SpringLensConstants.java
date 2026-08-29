package com.sdlcpro.springlens.constant;

import java.util.Set;

public final class SpringLensConstants {

    private SpringLensConstants() {
        throw new UnsupportedOperationException("SpringLensConstants is an utility class and cannot be instantiated");
    }

    public static final String SPRING_LENS_BASE_PACKAGE_PATTERN = "com.sdlcpro.springlens.**";

    public static final Set<String> SPRING_FRAMEWORK_BASE_PACKAGE_PATTERNS = Set.of(
            "org.springframework.aop.**",
            "org.springframework.beans.**",
            "org.springframework.context.**",
            "org.springframework.core.**",
            "org.springframework.expression.**",
            "org.springframework.instrument.**",
            "org.springframework.jdbc.**",
            "org.springframework.jndi.**",
            "org.springframework.orm.**",
            "org.springframework.oxm.**",
            "org.springframework.r2dbc.**",
            "org.springframework.test.**",
            "org.springframework.transaction.**",
            "org.springframework.util.**",
            "org.springframework.validation.**",
            "org.springframework.web.**",
            "org.springframework.web.reactive.**",
            "org.springframework.web.servlet.**",
            "org.springframework.web.socket.**"
    );

    public static final String SPRING_BOOT_BASE_PACKAGE_PATTERN = "org.springframework.boot.**";
}
