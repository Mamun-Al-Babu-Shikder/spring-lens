package com.sdlcpro.springlens.exposure.application;

import com.sdlcpro.springlens.annotation.SpringLensEndpoint;
import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import com.sdlcpro.springlens.exposure.ApiResponseHandler;
import com.sdlcpro.springlens.inspector.application.ApplicationInfoInspector;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST controller that exposes metadata for the current Spring application.
 *
 * @author Ixtiyorxon
 * @since 2026-08-28
 */
@RestController
@SpringLensEndpoint
@SpringLensInternalComponent
@RequestMapping("/spring-lens/api/application")
public class ApplicationInfoRestController {

    private final ApplicationInfoInspector applicationInfoInspector;

    /**
     * Creates a controller backed by the application metadata inspector.
     *
     * @param applicationInfoInspector inspector used to retrieve the current application metadata
     */
    public ApplicationInfoRestController(ApplicationInfoInspector applicationInfoInspector) {
        this.applicationInfoInspector = applicationInfoInspector;
    }

    /**
     * Returns a snapshot of the current Spring application's environment and startup metadata.
     *
     * @return an HTTP response containing application metadata, or a standardized error response when unavailable
     */
    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> getApplicationInfo() {
        return ApiResponseHandler.handle(
                this.applicationInfoInspector::inspect,
                "ApplicationInfo not found!"
        );
    }
}
