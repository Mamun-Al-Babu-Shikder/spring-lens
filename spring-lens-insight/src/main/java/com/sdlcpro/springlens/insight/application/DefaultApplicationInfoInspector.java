package com.sdlcpro.springlens.insight.application;

import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import com.sdlcpro.springlens.inspector.application.ApplicationInfoInspector;
import com.sdlcpro.springlens.model.application.ApplicationInfo;
import com.sdlcpro.springlens.model.application.JavaInfo;
import com.sdlcpro.springlens.model.application.SpringInfo;
import com.sdlcpro.springlens.model.application.StartupInfo;
import org.springframework.boot.SpringBootVersion;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.SpringVersion;
import org.springframework.core.env.Environment;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.Set;

@SpringLensInternalComponent
public final class DefaultApplicationInfoInspector implements ApplicationInfoInspector,
        ApplicationListener<ApplicationReadyEvent> {
    private static final String JAVA_VERSION_PROP = "java.version";
    private static final String JAVA_VENDOR_PROP = "java.vendor";
    private static final String SPRING_APPLICATION_NAME_PROP = "spring.application.name";
    private static final String FALLBACK_SPRING_APPLICATION_NAME = "application";

    private volatile ApplicationInfo applicationInfo;

    @Override
    public ApplicationInfo inspect() {
        ApplicationInfo info = this.applicationInfo;
        if (info == null) {
            throw new IllegalStateException("ApplicationInfo is not available yet");
        }

        return info;
    }

    @Override
    public void onApplicationEvent(ApplicationReadyEvent event) {
        this.applicationInfo = buildApplicationInfo(event);
    }

    private ApplicationInfo buildApplicationInfo(ApplicationReadyEvent event) {
        ConfigurableApplicationContext context = event.getApplicationContext();
        Environment environment = context.getEnvironment();
        String name = environment.getProperty(SPRING_APPLICATION_NAME_PROP);

        Set<String> activeProfiles = Set.of(environment.getActiveProfiles());
        Set<String> defaultProfiles = Set.of(environment.getDefaultProfiles());

        var springInfo = new SpringInfo(
                SpringBootVersion.getVersion(),
                SpringVersion.getVersion()
        );

        var javaVersion = System.getProperty(JAVA_VERSION_PROP, "UNKNOWN");
        var javaVendor = System.getProperty(JAVA_VENDOR_PROP, "UNKNOWN");
        var javaInfo = new JavaInfo(javaVersion, javaVendor);

        var startupInfo = new StartupInfo(
                Instant.ofEpochMilli(event.getTimestamp()),
                event.getTimeTaken()
        );

        return new ApplicationInfo(
                StringUtils.hasText(name) ? name : FALLBACK_SPRING_APPLICATION_NAME,
                activeProfiles,
                defaultProfiles,
                springInfo,
                javaInfo,
                startupInfo
        );
    }
}
