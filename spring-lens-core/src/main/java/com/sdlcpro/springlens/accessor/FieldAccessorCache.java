package com.sdlcpro.springlens.accessor;

import com.sdlcpro.springlens.exception.AccessorCreationException;
import com.sdlcpro.springlens.exception.FieldAccessException;
import com.sdlcpro.springlens.exception.FieldNotFoundException;

import java.lang.invoke.MethodHandle;
import java.lang.invoke.MethodHandles;
import java.lang.reflect.Field;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;

/**
 * Centralized, high-performance reflection utility that caches functional
 * bean property extractors.
 *
 * <p>Accessors are stored in a two-tiered, thread-safe registry indexed
 * first by the root {@link Class} and then by the (possibly nested)
 * field path (e.g. {@code "address.city"}). Caching the resolved
 * {@link Function} avoids repeated runtime reflection overhead during
 * query parsing and structural inspection.</p>
 *
 * <p>This class is a static utility and cannot be instantiated or
 * extended.</p>
 */
public final class FieldAccessorCache {

    /**
     * Two-tiered accessor registry: root type &rarr; field path &rarr; extractor.
     */
    private static final Map<Class<?>, Map<String, Function<Object, Object>>> CACHE = new ConcurrentHashMap<>();

    private FieldAccessorCache() {
        throw new UnsupportedOperationException("FieldAccessorCache is an utility class and cannot be instantiated");
    }

    /**
     * Returns a cached property extractor for the given root type and
     * nested field path, resolving and caching it on first access.
     *
     * @param rootType  the class from which the field path is resolved
     * @param fieldPath the dot-separated path of the property to access
     * @return a function extracting the property value from an bean=instance
     *         of {@code rootType}
     */
    public static Function<Object, Object> getAccessor(Class<?> rootType, String fieldPath) {
        if (rootType == null) {
            throw new IllegalArgumentException("The value of rootType must not be null");
        }

        if (fieldPath == null || fieldPath.isBlank()) {
            throw new IllegalArgumentException("The value of fieldPath must not be blank");
        }

        return CACHE
                .computeIfAbsent(rootType, k -> new ConcurrentHashMap<>())
                .computeIfAbsent(fieldPath, path -> createAccessor(rootType, path));
    }

    private static Function<Object, Object> createAccessor(Class<?> rootType, String fieldPath) {
        try {
            String[] parts = fieldPath.split("\\.");
            MethodHandle[] handles = new MethodHandle[parts.length];

            Class<?> currentType = rootType;
            MethodHandles.Lookup lookup = MethodHandles.lookup();

            for (int i = 0; i < parts.length; i++) {
                String fieldName = parts[i];
                Field field = findField(currentType, fieldName);
                field.setAccessible(true);
                handles[i] = lookup.unreflectGetter(field);
                currentType = field.getType();
            }

            return target -> {
                Object current = target;
                try {
                    for (MethodHandle handle : handles) {
                        if (current == null) {
                            return null;
                        }
                        current = handle.invoke(current);
                    }

                    return current;
                } catch (ClassCastException e) {
                    throw new FieldAccessException("Target object type does not match accessor for path '" + fieldPath + "'", e);
                } catch (Throwable e) {
                    throw new FieldAccessException("Failed to access field path '" + fieldPath + "'", e);
                }
            };

        } catch (IllegalAccessException e) {
            throw new AccessorCreationException("Failed to create accessor for field path '" + fieldPath + "'", e);
        }
    }

    private static Field findField(Class<?> type, String fieldName) {
        Class<?> current = type;
        while (current != null) {
            try {
                return current.getDeclaredField(fieldName);

            } catch (NoSuchFieldException ignored) {
                current = current.getSuperclass();
            }
        }

        throw new FieldNotFoundException(type, fieldName);
    }

    /**
     * Removes all cached accessors from the registry.
     */
    public static void clear() {
        CACHE.clear();
    }

    /**
     * Returns the total number of cached accessors across all root types.
     *
     * @return the aggregate count of cached field accessors
     */
    public static int cacheSize() {
        return CACHE.values()
                .stream()
                .mapToInt(Map::size)
                .sum();
    }
}
