package com.sdlcpro.springlens.exposure.bean;

import com.sdlcpro.springlens.annotation.SpringLensEndpoint;
import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import com.sdlcpro.springlens.exception.DataNotFoundException;
import com.sdlcpro.springlens.exposure.ApiResponseHandler;
import com.sdlcpro.springlens.model.bean.BeanInfoCompositeKey;
import com.sdlcpro.springlens.query.PageRequest;
import com.sdlcpro.springlens.query.Sort;
import com.sdlcpro.springlens.repository.bean.BeanInstanceInfoRepository;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import static com.sdlcpro.springlens.query.Filters.*;

/**
 * REST controller that exposes runtime bean instance metadata collected by
 * Spring Lens.
 *
 * <p>The controller provides filtered, sorted, paginated access to bean
 * instance records and lookup by the composite application-context and bean
 * name key. Page sizes are constrained to {@value #MAX_PAGE_SIZE} to prevent
 * clients from requesting excessively large response payloads.</p>
 *
 * @author Ixtiyorxon
 * @since 2026-08-25
 */
@RestController
@SpringLensEndpoint
@SpringLensInternalComponent
@RequestMapping("/spring-lens/api/beans/instances")
public class BeanInstanceInfoRestController {

    private static final int MAX_PAGE_SIZE = 1000;

    private final BeanInstanceInfoRepository beanInstanceInfoRepository;

    /**
     * Creates a controller backed by the repository holding collected runtime
     * bean instance records.
     *
     * @param beanInstanceInfoRepository the repository used to query bean
     *                                   instance information
     */
    public BeanInstanceInfoRestController(BeanInstanceInfoRepository beanInstanceInfoRepository) {
        this.beanInstanceInfoRepository = beanInstanceInfoRepository;
    }

    /**
     * Returns a filtered page of collected bean instance records.
     *
     * @param contextId  optional Spring application context identifier
     * @param beanName   optional bean name
     * @param type       optional fully qualified bean type name
     * @param scope      optional bean scope, for example {@code singleton} or
     *                   {@code prototype}
     * @param search     optional case-insensitive text search over context ID,
     *                   bean name, type, and scope
     * @param pageNumber zero-based page index; negative values are treated as
     *                   {@code 0}
     * @param pageSize   requested number of records per page; values below one
     *                   are treated as {@code 1}, while values greater than
     *                   {@value #MAX_PAGE_SIZE} are capped
     * @param sortBy     property used for sorting; defaults to {@code beanName}
     * @param sortDir    sorting direction, {@code ASC} or {@code DESC}; defaults
     *                   to {@code ASC}
     * @return an HTTP response containing the requested page of bean instance
     * records, wrapped by {@link ApiResponseHandler}
     */
    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> getBeanInstanceInfo(
            @RequestParam(value = "contextId", required = false) String contextId,
            @RequestParam(value = "beanName", required = false) String beanName,
            @RequestParam(value = "type", required = false) String type,
            @RequestParam(value = "scope", required = false) String scope,
            @RequestParam(value = "search", required = false) String search,
            @RequestParam(value = "pageNumber", defaultValue = "0") int pageNumber,
            @RequestParam(value = "pageSize", defaultValue = "10") int pageSize,
            @RequestParam(value = "sortBy", required = false) String sortBy,
            @RequestParam(value = "sortDir", defaultValue = "ASC") String sortDir) {
        var sort = sortBy == null ? Sort.unsorted() : Sort.by(sortBy, sortDir);
        var pageRequest = new PageRequest(
                Math.max(pageNumber, 0),
                Math.min(Math.max(pageSize, 1), MAX_PAGE_SIZE),
                sort
        );

        return ApiResponseHandler.handle(() -> {
            var filter = and(
                    eqIfPresent("contextId", contextId),
                    eqIfPresent("beanName", beanName),
                    eqIfPresent("type", type),
                    eqIfPresent("scope", scope),
                    orIfPresent(
                            search,
                            containsIgnoreCaseIfPresent("contextId", search),
                            containsIgnoreCaseIfPresent("beanName", search),
                            containsIgnoreCaseIfPresent("type", search),
                            containsIgnoreCaseIfPresent("scope", search))
            );
            return beanInstanceInfoRepository.findAll(filter, pageRequest);
        });
    }


    /**
     * Returns one bean instance record identified by its application context and
     * bean name.
     *
     * @param contextId the Spring application context identifier
     * @param beanName  the bean name within the application context
     * @return an HTTP response containing the matching record, or a standardized
     * {@code 404 Not Found} response when no record exists for the key
     */
    @GetMapping(value = "/find", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> getBeanInstanceInfo(
            @RequestParam("contextId") String contextId,
            @RequestParam("beanName") String beanName) {
        var beanInstanceInfoKey = new BeanInfoCompositeKey(contextId, beanName);
        return ApiResponseHandler.handle(
                () -> this.beanInstanceInfoRepository.findById(beanInstanceInfoKey),
                "No bean instance found with name '%s' in application context '%s'".formatted(beanName, contextId)
        );
    }

    /**
     * Returns single bean instance proxy information according to the given contextId and beanName
     *
     * @param contextId the Spring application context identifier
     * @param beanName  the bean name within the application context
     * @return {@link ResponseEntity} containing the
     * {@link  com.sdlcpro.springlens.model.bean.instance.BeanInstanceProxyInfo) if found at repository
     */
    @GetMapping("/proxy-info")
    public ResponseEntity<?> getBeanInstanceProxyInfo(
            @RequestParam(value = "contextId") String contextId,
            @RequestParam(value = "beanName") String beanName
    ) {
        return ApiResponseHandler.handle(() -> {
            var key = new BeanInfoCompositeKey(contextId, beanName);
            return this.beanInstanceInfoRepository.findProxyInfoById(key).orElseThrow(
                    () -> new DataNotFoundException("Bean instance proxy information not found for " + key)
            );
        });
    }
}
