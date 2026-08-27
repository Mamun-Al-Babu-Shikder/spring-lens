package com.sdlcpro.springlens.exposure.bean;

import com.sdlcpro.springlens.annotation.SpringLensEndpoint;
import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import com.sdlcpro.springlens.exposure.ApiResponseHandler;
import com.sdlcpro.springlens.model.bean.BeanInfoCompositeKey;
import com.sdlcpro.springlens.model.bean.BeanRole;
import com.sdlcpro.springlens.query.PageRequest;
import com.sdlcpro.springlens.query.Sort;
import com.sdlcpro.springlens.repository.bean.BeanDefinitionInfoRepository;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import static com.sdlcpro.springlens.query.Filters.*;

/**
 * REST controller that exposes the bean metadata collected by Spring Lens.
 */
@RestController
@SpringLensEndpoint
@SpringLensInternalComponent
@RequestMapping("/spring-lens/api/beans/definitions")
public class BeanDefinitionInfoRestController {
    private static final int MAX_PAGE_SIZE = 1000;

    private final BeanDefinitionInfoRepository beanDefinitionInfoRepository;

    /**
     * Creates a new controller backed by the given repository.
     *
     * @param beanDefinitionInfoRepository the repository holding the collected bean
     *                                     metadata; must not be {@code null}
     */
    public BeanDefinitionInfoRestController(BeanDefinitionInfoRepository beanDefinitionInfoRepository) {
        this.beanDefinitionInfoRepository = beanDefinitionInfoRepository;
    }

    /**
     * Returns a page of collected bean metadata.
     *
     * @param contextId  the value of application context id
     * @param beanName   the unique bean name for each application context
     * @param scope      the scope of the bean (like: singleton, prototype, request
     *                   etc.)
     * @param role       the role of the bean (like: ROLE_APPLICATION, ROLE_SUPPORT
     *                   etc.)
     * @param primary    define is the bean primary or not
     * @param lazyInit   define is the bean initialized lazily
     * @param search     free text search value which will be applied search on
     *                   different field (like: contextId, beanName etc.)
     * @param pageNumber zero-based page index (defaults to {@code 0})
     * @param pageSize   the number of records per page (defaults to {@code 10})
     * @param sortBy     optional property name to sort by
     * @param sortDir    optional sort direction ({@code ASC} or {@code DESC});
     *                   defaults to
     *                   ascending when a {@code sortBy} property is supplied
     * @return a {@link ResponseEntity} wrapping the requested
     * {@link com.sdlcpro.springlens.query.PageResponse page} of bean
     * definitions
     */
    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> getBeanDefinitionInfo(
            @RequestParam(value = "contextId", required = false) String contextId,
            @RequestParam(value = "beanName", required = false) String beanName,
            @RequestParam(value = "scope", required = false) String scope,
            @RequestParam(value = "role", required = false) String role,
            @RequestParam(value = "primary", required = false) Boolean primary,
            @RequestParam(value = "lazyInit", required = false) Boolean lazyInit,
            @RequestParam(value = "search", required = false) String search,
            @RequestParam(value = "pageNumber", defaultValue = "0") int pageNumber,
            @RequestParam(value = "pageSize", defaultValue = "10") int pageSize,
            @RequestParam(value = "sortBy", required = false) String sortBy,
            @RequestParam(value = "sortDir", required = false, defaultValue = "ASC") String sortDir) {
        var sort = sortBy == null ? Sort.unsorted() : Sort.by(sortBy, sortDir);
        var pageRequest = new PageRequest(Math.max(pageNumber, 0), Math.min(pageSize, MAX_PAGE_SIZE), sort);

        return ApiResponseHandler.handle(() -> {
            var filter = and(
                    eqIfPresent("contextId", contextId),
                    eqIfPresent("beanName", beanName),
                    eqIfPresent("scope", scope),
                    eqIfPresent("role", role, BeanRole::valueOf),
                    eqIfPresent("primary", primary),
                    eqIfPresent("lazyInit", lazyInit),
                    orIfPresent(
                            search,
                            containsIgnoreCaseIfPresent("contextId", search),
                            containsIgnoreCaseIfPresent("beanName", search),
                            containsIgnoreCaseIfPresent("resource", search),
                            containsIgnoreCaseIfPresent("description", search),
                            containsIgnoreCaseIfPresent("initMethodName", search),
                            containsIgnoreCaseIfPresent("destroyMethodName", search),
                            containsIgnoreCaseIfPresent("factoryBeanName", search)));

            return this.beanDefinitionInfoRepository.findAll(filter, pageRequest);
        });
    }

    /**
     * Return BeanInstanceInfo according to the contextId and beanName
     *
     * @param contextId the value of application context id
     * @param beanName  the unique bean name for each application context
     * @return a {@link ResponseEntity} by wrapping the
     * {@link com.sdlcpro.springlens.model.bean.instance.BeanInstanceInfo}
     */
    @GetMapping(value = "/find", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> getBeanDefinitionInfo(
            @RequestParam("contextId") String contextId,
            @RequestParam("beanName") String beanName) {
        var beanDefinitionInfoKey = new BeanInfoCompositeKey(contextId, beanName);
        return ApiResponseHandler.handle(
                () -> this.beanDefinitionInfoRepository.findById(beanDefinitionInfoKey),
                "No bean definition found with name '%s' in application context '%s'".formatted(beanName, contextId)
        );
    }

    /**
     * Retrieves aggregated bean definition summary metrics.
     *
     * <p>The summary contains aggregated bean definition distributions,
     * including context, scope, role, loading mode, and total counts.</p>
     *
     * @return an HTTP response containing the bean definition summary
     * wrapped by the standardized {@link ResponseEntity}
     */
    @GetMapping("/summary")
    public ResponseEntity<?> getBeanDefinitionSummary() {
        return ApiResponseHandler.handle(
                this.beanDefinitionInfoRepository::getBeanDefinitionSummary
        );
    }

    /**
     * Return BeanDependency with pagination
     *
     * @param pageNumber zero-based page index (defaults to {@code 0})
     * @param pageSize   the number of records per page (defaults to {@code 100})
     * @return an HTTP response containing the BeanDependency
     * wrapped by the standardized {@link ResponseEntity}
     */
    @GetMapping(value = "/dependencies", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> getBeanDefinitionDependency(
            @RequestParam(value = "pageNumber", defaultValue = "0") int pageNumber,
            @RequestParam(value = "pageSize", defaultValue = "100") int pageSize
    ) {
        return ApiResponseHandler.handle(() -> this.beanDefinitionInfoRepository.findBeanDependencies(
                new PageRequest(pageNumber, Math.min(pageSize, MAX_PAGE_SIZE), Sort.unsorted()))
        );
    }
}
