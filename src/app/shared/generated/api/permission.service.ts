/**
 * onecx-permission-bff
 * No description provided (generated by Openapi Generator https://github.com/openapitools/openapi-generator)
 *
 * The version of the OpenAPI document: 1.0.0
 *
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */
/* tslint:disable:no-unused-variable member-ordering */

import { Inject, Injectable, Optional } from "@angular/core";
import {
  HttpClient,
  HttpHeaders,
  HttpParams,
  HttpResponse,
  HttpEvent,
  HttpParameterCodec,
  HttpContext,
} from "@angular/common/http";
import { CustomHttpParameterCodec } from "../encoder";
import { Observable } from "rxjs";

// @ts-ignore
import { PermissionPageResult } from "../model/permissionPageResult";
// @ts-ignore
import { PermissionSearchCriteria } from "../model/permissionSearchCriteria";
// @ts-ignore
import { ProblemDetailResponse } from "../model/problemDetailResponse";

// @ts-ignore
import { BASE_PATH, COLLECTION_FORMATS } from "../variables";
import { Configuration } from "../configuration";

export interface SearchPermissionsRequestParams {
  permissionSearchCriteria: PermissionSearchCriteria;
}

@Injectable({
  providedIn: "any",
})
export class PermissionAPIService {
  protected basePath = "http://onecx-permission-bff:8080";
  public defaultHeaders = new HttpHeaders();
  public configuration = new Configuration();
  public encoder: HttpParameterCodec;

  constructor(
    protected httpClient: HttpClient,
    @Optional() @Inject(BASE_PATH) basePath: string | string[],
    @Optional() configuration: Configuration
  ) {
    if (configuration) {
      this.configuration = configuration;
    }
    if (typeof this.configuration.basePath !== "string") {
      if (Array.isArray(basePath) && basePath.length > 0) {
        basePath = basePath[0];
      }

      if (typeof basePath !== "string") {
        basePath = this.basePath;
      }
      this.configuration.basePath = basePath;
    }
    this.encoder = this.configuration.encoder || new CustomHttpParameterCodec();
  }

  // @ts-ignore
  private addToHttpParams(
    httpParams: HttpParams,
    value: any,
    key?: string
  ): HttpParams {
    if (typeof value === "object" && value instanceof Date === false) {
      httpParams = this.addToHttpParamsRecursive(httpParams, value);
    } else {
      httpParams = this.addToHttpParamsRecursive(httpParams, value, key);
    }
    return httpParams;
  }

  private addToHttpParamsRecursive(
    httpParams: HttpParams,
    value?: any,
    key?: string
  ): HttpParams {
    if (value == null) {
      return httpParams;
    }

    if (typeof value === "object") {
      if (Array.isArray(value)) {
        (value as any[]).forEach(
          (elem) =>
            (httpParams = this.addToHttpParamsRecursive(httpParams, elem, key))
        );
      } else if (value instanceof Date) {
        if (key != null) {
          httpParams = httpParams.append(
            key,
            (value as Date).toISOString().substring(0, 10)
          );
        } else {
          throw Error("key may not be null if value is Date");
        }
      } else {
        Object.keys(value).forEach(
          (k) =>
            (httpParams = this.addToHttpParamsRecursive(
              httpParams,
              value[k],
              key != null ? `${key}.${k}` : k
            ))
        );
      }
    } else if (key != null) {
      httpParams = httpParams.append(key, value);
    } else {
      throw Error("key may not be null if value is not object or array");
    }
    return httpParams;
  }

  /**
   * Search for permissions
   * @param requestParameters
   * @param observe set whether or not to return the data Observable as the body, response or events. defaults to returning the body.
   * @param reportProgress flag to report request and response progress.
   */
  public searchPermissions(
    requestParameters: SearchPermissionsRequestParams,
    observe?: "body",
    reportProgress?: boolean,
    options?: { httpHeaderAccept?: "application/json"; context?: HttpContext }
  ): Observable<Array<PermissionPageResult>>;
  public searchPermissions(
    requestParameters: SearchPermissionsRequestParams,
    observe?: "response",
    reportProgress?: boolean,
    options?: { httpHeaderAccept?: "application/json"; context?: HttpContext }
  ): Observable<HttpResponse<Array<PermissionPageResult>>>;
  public searchPermissions(
    requestParameters: SearchPermissionsRequestParams,
    observe?: "events",
    reportProgress?: boolean,
    options?: { httpHeaderAccept?: "application/json"; context?: HttpContext }
  ): Observable<HttpEvent<Array<PermissionPageResult>>>;
  public searchPermissions(
    requestParameters: SearchPermissionsRequestParams,
    observe: any = "body",
    reportProgress: boolean = false,
    options?: { httpHeaderAccept?: "application/json"; context?: HttpContext }
  ): Observable<any> {
    const permissionSearchCriteria = requestParameters.permissionSearchCriteria;
    if (
      permissionSearchCriteria === null ||
      permissionSearchCriteria === undefined
    ) {
      throw new Error(
        "Required parameter permissionSearchCriteria was null or undefined when calling searchPermissions."
      );
    }

    let localVarHeaders = this.defaultHeaders;

    let localVarHttpHeaderAcceptSelected: string | undefined =
      options && options.httpHeaderAccept;
    if (localVarHttpHeaderAcceptSelected === undefined) {
      // to determine the Accept header
      const httpHeaderAccepts: string[] = ["application/json"];
      localVarHttpHeaderAcceptSelected =
        this.configuration.selectHeaderAccept(httpHeaderAccepts);
    }
    if (localVarHttpHeaderAcceptSelected !== undefined) {
      localVarHeaders = localVarHeaders.set(
        "Accept",
        localVarHttpHeaderAcceptSelected
      );
    }

    let localVarHttpContext: HttpContext | undefined =
      options && options.context;
    if (localVarHttpContext === undefined) {
      localVarHttpContext = new HttpContext();
    }

    // to determine the Content-Type header
    const consumes: string[] = ["application/json"];
    const httpContentTypeSelected: string | undefined =
      this.configuration.selectHeaderContentType(consumes);
    if (httpContentTypeSelected !== undefined) {
      localVarHeaders = localVarHeaders.set(
        "Content-Type",
        httpContentTypeSelected
      );
    }

    let responseType_: "text" | "json" | "blob" = "json";
    if (localVarHttpHeaderAcceptSelected) {
      if (localVarHttpHeaderAcceptSelected.startsWith("text")) {
        responseType_ = "text";
      } else if (
        this.configuration.isJsonMime(localVarHttpHeaderAcceptSelected)
      ) {
        responseType_ = "json";
      } else {
        responseType_ = "blob";
      }
    }

    let localVarPath = `/permissions/search`;
    return this.httpClient.request<Array<PermissionPageResult>>(
      "post",
      `${this.configuration.basePath}${localVarPath}`,
      {
        context: localVarHttpContext,
        body: permissionSearchCriteria,
        responseType: <any>responseType_,
        withCredentials: this.configuration.withCredentials,
        headers: localVarHeaders,
        observe: observe,
        reportProgress: reportProgress,
      }
    );
  }
}
