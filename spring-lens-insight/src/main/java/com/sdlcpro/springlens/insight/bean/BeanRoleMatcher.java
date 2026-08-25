package com.sdlcpro.springlens.insight.bean;

import com.sdlcpro.springlens.matcher.Matcher;
import com.sdlcpro.springlens.model.bean.BeanRole;
import com.sdlcpro.springlens.util.DefensiveCopies;

import java.util.Set;

public class BeanRoleMatcher<T extends BeanRoleProvider> implements Matcher<T> {
    private final Set<BeanRole> beanRoles;

    public BeanRoleMatcher(Set<BeanRole> beanRoles) {
        this.beanRoles = DefensiveCopies.immutableEnumSetOrEmpty(beanRoles);
    }

    @Override
    public boolean matches(T context) {
        return context != null
                && !this.beanRoles.isEmpty()
                && this.beanRoles.contains(context.getBeanRole());
    }
}
