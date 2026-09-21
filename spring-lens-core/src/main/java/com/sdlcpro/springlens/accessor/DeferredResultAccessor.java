package com.sdlcpro.springlens.accessor;

import com.sdlcpro.springlens.util.Preconditions;

import java.util.function.Supplier;

/**
 * A thread-safe, lazy-loading wrapper for expensive computations such as
 * telemetry data calculations or reflection-heavy lookups.
 *
 * <p>Uses the Double-Checked Locking (DCL) pattern with a {@code volatile}
 * state flag to guarantee that the underlying {@link Supplier} is executed
 * exactly once, even under concurrent access from multiple threads.</p>
 *
 * <p>Typical usage:</p>
 * <pre>{@code
 * DeferredResultAccessor<ExpensiveData> accessor =
 *         DeferredResultAccessor.of(() -> computeExpensiveData());
 *
 * // First call triggers the supplier; subsequent calls return the cached result.
 * ExpensiveData data = accessor.getResult();
 * }</pre>
 *
 * <p>This class is {@code final} to prevent subclassing and preserve its
 * thread-safety guarantees.</p>
 *
 * @param <T> the type of the deferred result
 */
public final class DeferredResultAccessor<T> {

    private T result;
    private final Supplier<T> supplier;
    private volatile boolean initialized;

    /**
     * Creates a new {@code DeferredResultAccessor} wrapping the given supplier.
     *
     * @param supplier the data-fetching supplier to invoke lazily; must not be {@code null}
     * @param <T>      the type of the deferred result
     * @return a new accessor bean=instance
     * @throws IllegalArgumentException if {@code supplier} is {@code null}
     */
    public static <T> DeferredResultAccessor<T> of(Supplier<T> supplier) {
        return new DeferredResultAccessor<>(supplier);
    }

    private DeferredResultAccessor(Supplier<T> supplier) {
        Preconditions.notNull(supplier, "Deferred result supplier must not be null");
        this.supplier = supplier;
    }

    /**
     * Returns the deferred result, computing it on the first invocation.
     *
     * <p>The supplier is guaranteed to be called at most once regardless of
     * how many threads call this method concurrently. The volatile read of
     * {@code initialized} acts as a memory barrier, ensuring full visibility
     * of the {@code result} field after initialization.</p>
     *
     * @return the computed result (may be {@code null} if the supplier returns {@code null})
     */
    public T getResult() {
        if (!this.initialized) {
            synchronized (this) {
                if (!this.initialized) {
                    this.result = this.supplier.get();
                    this.initialized = true;
                }
            }
        }

        return result;
    }
}
