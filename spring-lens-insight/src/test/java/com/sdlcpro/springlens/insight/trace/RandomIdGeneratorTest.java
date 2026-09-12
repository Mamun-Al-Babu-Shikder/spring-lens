package com.sdlcpro.springlens.insight.trace;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Modifier;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.*;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.*;

class RandomIdGeneratorTest {

    private final RandomIdGenerator generator = RandomIdGenerator.getInstance();

    // --- Functional Tests ---

    @Test
    @DisplayName("1. Trace ID should be 32 characters long")
    void testTraceIdLength() {
        assertEquals(32, generator.generateTraceId().length());
    }

    @Test
    @DisplayName("2. Span ID should be 16 characters long")
    void testSpanIdLength() {
        assertEquals(16, generator.generateSpanId().length());
    }

    @Test
    @DisplayName("3. Trace ID should only contain valid hex characters")
    void testTraceIdHexChars() {
        assertTrue(generator.generateTraceId().matches("^[0-9a-f]+$"));
    }

    @Test
    @DisplayName("4. Span ID should only contain valid hex characters")
    void testSpanIdHexChars() {
        assertTrue(generator.generateSpanId().matches("^[0-9a-f]+$"));
    }

    @Test
    @DisplayName("5. Multiple Trace IDs should be unique")
    void testTraceIdUniqueness() {
        Set<String> ids = new HashSet<>();

        IntStream.range(0, 1000)
                .forEach(i -> ids.add(generator.generateTraceId()));

        assertEquals(1000, ids.size());
    }

    @Test
    @DisplayName("6. Multiple Span IDs should be unique")
    void testSpanIdUniqueness() {
        Set<String> ids = new HashSet<>();

        IntStream.range(0, 1000)
                .forEach(i -> ids.add(generator.generateSpanId()));

        assertEquals(1000, ids.size());
    }

    // --- Singleton & Threading Tests ---

    @Test
    @DisplayName("7. Instance should be a Singleton")
    void testSingletonInstance() {
        RandomIdGenerator instance1 = RandomIdGenerator.getInstance();
        RandomIdGenerator instance2 = RandomIdGenerator.getInstance();

        assertSame(instance1, instance2);
    }

    @Test
    @DisplayName("8. Should handle concurrent generation without exception")
    void testConcurrentGeneration() throws Exception {

        int threads = 10;
        ExecutorService service = Executors.newFixedThreadPool(threads);

        try {
            List<Future<String>> futures = IntStream.range(0, threads)
                    .mapToObj(i -> service.submit(generator::generateTraceId))
                    .toList();

            for (Future<String> future : futures) {
                assertNotNull(future.get());
            }

        } finally {
            service.shutdown();
            assertTrue(service.awaitTermination(5, TimeUnit.SECONDS));
        }
    }

    @Test
    @DisplayName("9. Ensure thread isolation in random generation")
    void testThreadIsolation() throws Exception {

        CompletableFuture<String> future1 =
                CompletableFuture.supplyAsync(generator::generateTraceId);

        CompletableFuture<String> future2 =
                CompletableFuture.supplyAsync(generator::generateTraceId);

        assertNotEquals(future1.get(), future2.get());
    }

    // --- Boundary & Edge Tests ---

    @Test
    @DisplayName("10. Generated trace ID should not be empty")
    void testTraceIdNotEmpty() {
        assertFalse(generator.generateTraceId().isEmpty());
    }

    @Test
    @DisplayName("11. Generated span ID should not be empty")
    void testSpanIdNotEmpty() {
        assertFalse(generator.generateSpanId().isEmpty());
    }

    @Test
    @DisplayName("12. Ensure generator is initialized")
    void testGeneratorInitialization() {
        assertNotNull(generator);
    }

    @Test
    @DisplayName("13. Ensure generator is RandomIdGenerator")
    void testImplementation() {
        assertInstanceOf(RandomIdGenerator.class, generator);
    }

    @Test
    @DisplayName("14. Ensure non-null return values")
    void testNotNull() {
        assertNotNull(generator.generateTraceId());
        assertNotNull(generator.generateSpanId());
    }

    @Test
    @DisplayName("15. Validate generation consistency")
    void testGenerationConsistency() {

        String id1 = generator.generateTraceId();
        String id2 = generator.generateTraceId();

        assertNotEquals(id1, id2);
    }

    @Test
    @DisplayName("16. Stress test uniqueness")
    void testHighVolumeUniqueness() {

        int count = 10_000;

        Set<String> ids = ConcurrentHashMap.newKeySet();

        IntStream.range(0, count)
                .parallel()
                .forEach(i -> ids.add(generator.generateTraceId()));

        assertEquals(count, ids.size());
    }

    @Test
    @DisplayName("17. Verify constructor is private")
    void testConstructorPrivate() throws Exception {

        var constructor =
                RandomIdGenerator.class.getDeclaredConstructor();

        assertTrue(Modifier.isPrivate(constructor.getModifiers()));
    }

    @Test
    @DisplayName("18. Check if HEX chars match bean-definition")
    void testHexCharDefinition() {

        String id = generator.generateTraceId();

        for (char c : id.toCharArray()) {
            assertTrue("0123456789abcdef".indexOf(c) >= 0);
        }
    }

    @Test
    @DisplayName("19. Verify class is final")
    void testClassIsFinal() {
        assertTrue(Modifier.isFinal(RandomIdGenerator.class.getModifiers()));
    }

    @Test
    @DisplayName("20. Verify execution time")
    void testPerformance() {

        for (int i = 0; i < 1000; i++) {
            generator.generateTraceId();
        }

        long start = System.nanoTime();
        generator.generateTraceId();
        long end = System.nanoTime();

        long duration = end - start;

        assertTrue(
                duration < 1_000_000,
                "Generation took longer than 1ms"
        );
    }

    @Test
    @DisplayName("21. Verify IdGenerator interface method count")
    void testMethodCount() {

        long abstractMethodCount =
                IntStream.range(0, IdGenerator.class.getDeclaredMethods().length)
                        .count();

        assertTrue(abstractMethodCount >= 2);
    }
}