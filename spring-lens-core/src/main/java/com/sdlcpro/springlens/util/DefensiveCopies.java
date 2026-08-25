package com.sdlcpro.springlens.util;

import java.util.*;

public final class DefensiveCopies {

    private DefensiveCopies() {
        throw new UnsupportedOperationException("DefensiveCopies is an utility class and cannot be instantiated");
    }

    public static <T> List<T> listOrEmpty(Collection<? extends T> source) {
        return source == null
                ? new ArrayList<>()
                : new ArrayList<>(source);
    }

    public static <T> Set<T> setOrEmpty(Collection<? extends T> source) {
        return source == null
                ? new HashSet<>()
                : new HashSet<>(source);
    }

    public static <K, V> Map<K, V> mapOrEmpty(Map<? extends K, ? extends V> source) {
        return source == null
                ? new HashMap<>()
                : new HashMap<>(source);
    }

    public static <E extends Enum<E>> EnumSet<E> enumSetOrEmpty(Collection<E> source, Class<E> elementType) {
        if (source == null || source.isEmpty()) {
            return EnumSet.noneOf(elementType);
        }

        return EnumSet.copyOf(source);
    }

    public static <T> List<T> immutableListOrEmpty(Collection<? extends T> source) {
        return source == null
                ? List.of()
                : List.copyOf(source);
    }

    public static <T> Set<T> immutableSetOrEmpty(Collection<? extends T> source) {
        return source == null
                ? Set.of()
                : Set.copyOf(source);
    }

    public static <K, V> Map<K, V> immutableMapOrEmpty(Map<? extends K, ? extends V> source) {
        return source == null
                ? Map.of()
                : Map.copyOf(source);
    }

    public static <E extends Enum<E>> Set<E> immutableEnumSetOrEmpty(Collection<E> source) {
        return source == null || source.isEmpty()
                ? Set.of()
                : Collections.unmodifiableSet(EnumSet.copyOf(source));
    }

    public static <K extends Enum<K>, V> Map<K, V> immutableEnumMapOrEmpty(Map<K, ? extends V> source) {
        return source == null || source.isEmpty()
                ? Map.of()
                : Map.copyOf(new EnumMap<K, V>(source));
    }
}
