package com.sdlcpro.springlens.autoconfigure.bean;

import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.HashSet;
import java.util.Set;

@SpringLensInternalComponent
@ConfigurationProperties(prefix = "spring.lens.bean")
public class SpringLensBeanProperties {

    private final Definition definition = new Definition();
    private final Instance instance = new Instance();
    private final Include include = new Include();
    private final Exclude exclude = new Exclude();

    public Definition getDefinition() {
        return definition;
    }

    public Instance getInstance() {
        return instance;
    }

    public Include getInclude() {
        return include;
    }

    public Exclude getExclude() {
        return exclude;
    }

    public static class Definition {
        private boolean enabled = true;

        public boolean isEnabled() {
            return enabled;
        }

        public void setEnabled(boolean enabled) {
            this.enabled = enabled;
        }
    }

    public static class Instance {
        private boolean enabled = true;

        public boolean isEnabled() {
            return enabled;
        }

        public void setEnabled(boolean enabled) {
            this.enabled = enabled;
        }
    }

    public static class Include {
        private boolean roleInfra = false;
        private boolean toolInternal = false;
        private boolean frameworkInternal = false;

        public boolean isRoleInfra() {
            return roleInfra;
        }

        public void setRoleInfra(boolean roleInfra) {
            this.roleInfra = roleInfra;
        }

        public boolean isToolInternal() {
            return toolInternal;
        }

        public void setToolInternal(boolean toolInternal) {
            this.toolInternal = toolInternal;
        }

        public boolean isFrameworkInternal() {
            return frameworkInternal;
        }

        public void setFrameworkInternal(boolean frameworkInternal) {
            this.frameworkInternal = frameworkInternal;
        }
    }

    public static class Exclude {
        private final Set<String> packagePatterns = new HashSet<>();
        private final Set<String> classes = new HashSet<>();

        public Set<String> getPackagePatterns() {
            return packagePatterns;
        }

        public Set<String> getClasses() {
            return classes;
        }
    }
}
