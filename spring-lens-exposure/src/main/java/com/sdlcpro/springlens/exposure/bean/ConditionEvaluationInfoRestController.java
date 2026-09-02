package com.sdlcpro.springlens.exposure.bean;

import com.sdlcpro.springlens.annotation.SpringLensEndpoint;
import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import com.sdlcpro.springlens.exposure.ApiResponseHandler;
import com.sdlcpro.springlens.model.bean.condition.ConditionEvaluationInfo;
import com.sdlcpro.springlens.model.bean.condition.ConditionEvaluationKey;
import com.sdlcpro.springlens.model.bean.condition.ConditionOutcome;
import com.sdlcpro.springlens.query.PageRequest;
import com.sdlcpro.springlens.query.Sort;
import com.sdlcpro.springlens.repository.bean.ConditionEvaluationInfoRepository;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import static com.sdlcpro.springlens.query.Filters.*;

/**
 * REST controller that exposes Spring Boot auto-configuration condition
 * evaluation snapshots collected by Spring Lens.
 *
 * <p>The controller supports filtering, sorting, and paginated access to the
 * reports. Requested page sizes are constrained to {@value #MAX_PAGE_SIZE} so
 * an HTTP client cannot request an unbounded response.</p>
 *
 * @author Ixtiyorxon
 * @since 1.0
 */
@RestController
@SpringLensEndpoint
@SpringLensInternalComponent
@RequestMapping("/spring-lens/api/beans/conditions")
public class ConditionEvaluationInfoRestController {

    private static final int MAX_PAGE_SIZE = 1000;

    private final ConditionEvaluationInfoRepository conditionEvaluationInfoRepository;

    /**
     * Creates a controller backed by the supplied condition evaluation
     * repository.
     *
     * @param conditionEvaluationInfoRepository the repository holding collected
     *                                          condition evaluation snapshots
     */
    public ConditionEvaluationInfoRestController(ConditionEvaluationInfoRepository conditionEvaluationInfoRepository) {
        this.conditionEvaluationInfoRepository = conditionEvaluationInfoRepository;
    }

    /**
     * Returns a filtered page of condition evaluation snapshots.
     *
     * @param contextId  optional Spring application context identifier
     * @param source     optional auto-configuration source name
     * @param outcome    optional aggregate evaluation outcome
     * @param search     optional case-insensitive text search over the context
     *                   identifier and source
     * @param pageNumber zero-based page index; negative values are treated as
     *                   {@code 0}
     * @param pageSize   requested number of records per page; values below one
     *                   are treated as {@code 1}, and values above
     *                   {@value #MAX_PAGE_SIZE} are capped
     * @param sortBy     property used for sorting; defaults to {@code source}
     * @param sortDir    sorting direction, {@code ASC} or {@code DESC}; defaults
     *                   to {@code ASC}
     * @return an HTTP response containing a page of {@link
     * ConditionEvaluationInfo condition evaluation snapshots}
     */
    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> getConditionEvaluationInfo(
            @RequestParam(value = "contextId", required = false) String contextId,
            @RequestParam(value = "source", required = false) String source,
            @RequestParam(value = "outcome", required = false) String outcome,
            @RequestParam(value = "search", required = false) String search,
            @RequestParam(value = "pageNumber", defaultValue = "0") int pageNumber,
            @RequestParam(value = "pageSize", defaultValue = "10") int pageSize,
            @RequestParam(value = "sortBy", defaultValue = "source") String sortBy,
            @RequestParam(value = "sortDir", defaultValue = "ASC") String sortDir) {
        var sort = Sort.by(sortBy, sortDir);
        var pageRequest = new PageRequest(
                Math.max(pageNumber, 0),
                Math.min(Math.max(pageSize, 1), MAX_PAGE_SIZE),
                sort
        );

        return ApiResponseHandler.handle(() -> {
            var filter = and(
                    eqIfPresent("contextId", contextId),
                    eqIfPresent("source", source),
                    eqIfPresent("outcome", outcome, ConditionOutcome::valueOf),
                    orIfPresent(
                            search,
                            containsIgnoreCaseIfPresent("contextId", search),
                            containsIgnoreCaseIfPresent("source", search))
            );

            return conditionEvaluationInfoRepository.findAll(filter, pageRequest);
        });
    }

    /**
     * Returns one condition evaluation snapshot identified by its application
     * context and auto-configuration source.
     *
     * @param contextId the Spring application context identifier
     * @param source    the evaluated auto-configuration source
     * @return an HTTP response containing the matching condition evaluation
     * snapshot, or a standardized {@code 404 Not Found} response when
     * no matching snapshot exists
     */
    @GetMapping(value = "/find", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> getConditionEvaluationInfo(
            @RequestParam("contextId") String contextId,
            @RequestParam("source") String source) {
        var conditionEvaluationKey = new ConditionEvaluationKey(contextId, source);
        return ApiResponseHandler.handle(
                () -> conditionEvaluationInfoRepository.findById(conditionEvaluationKey),
                "No condition evaluation found for source '%s' in application context '%s'"
                        .formatted(source, contextId)
        );
    }

    /**
     * Retrieves aggregated condition evaluation summary metrics.
     *
     * <p>The summary contains aggregated condition evaluation repost data,
     * including total condition source, matched, non-matched and total condition evaluation count.</p>
     *
     * @return an HTTP response containing the {@link com.sdlcpro.springlens.model.bean.condition.ConditionEvaluationSummary}
     * wrapped by the standardized {@link ResponseEntity}
     */
    @GetMapping("/summary")
    public ResponseEntity<?> getBeanDefinitionSummary() {
        return ApiResponseHandler.handle(this.conditionEvaluationInfoRepository::getConditionEvaluationSummary);
    }
}
