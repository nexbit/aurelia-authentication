import {inject} from 'aurelia-dependency-injection';
import {HttpClient} from 'aurelia-fetch-client';
import {Config, Rest} from 'aurelia-api';
import {AuthService} from './authService';
import {BaseConfig} from './baseConfig';

@inject(HttpClient, Config, AuthService, BaseConfig)
export class FetchConfig {
  /**
   * Construct the FetchConfig
   *
   * @param {HttpClient} httpClient httpClient
   * @param {Config} clientConfig clientConfig
   * @param {Authentication} authService authService
   * @param {BaseConfig} config baseConfig
   */
  constructor(httpClient: HttpClient, clientConfig: Config, authService: Authentication, config: BaseConfig) {
    this.httpClient   = httpClient;
    this.clientConfig = clientConfig;
    this.authService  = authService;
    this.config       = config;
  }

  /**
   * Interceptor for HttpClient
   *
   * @return {{request: Function, response: Function}} The interceptor
   */
  get interceptor(): {request: Function, response: Function} {
    return {
      request: request => {
        if (!this.config.httpInterceptor || !this.authService.isAuthenticated()) {
          return request;
        }
        let token = this.authService.getAccessToken();

        if (this.config.authTokenType) {
          token = `${this.config.authTokenType} ${token}`;
        }

        request.headers.set(this.config.authHeader, token);

        return request;
      },
      response: (response, request) => {
        return new Promise((resolve, reject) => {
          if (response.ok) {
            return resolve(response);
          }
          if (response.status !== 401) {
            return resolve(response);
          }
          if (!this.config.httpInterceptor || !this.authService.isTokenExpired()) {
            return resolve(response);
          }
          if (!this.config.useRefreshToken || !this.authService.getRefreshToken()) {
            return resolve(response);
          }

          return this.authService.updateToken().then(() => {
            let token = this.authService.getAccessToken();

            if (this.config.authTokenType) {
              token = `${this.config.authTokenType} ${token}`;
            }

            request.headers.set(this.config.authHeader, token);

            return this.client.fetch(request).then(resolve);
          });
        });
      }
    };
  }

  /**
   * Configure client(s) with authorization interceptor
   *
   * @param {HttpClient|Rest|string[]} client HttpClient, rest client or api endpoint name, or an array thereof
   *
   * @return {HttpClient[]} The configured client(s)
   */
  configure(client: HttpClient|Rest|Array<string>): HttpClient|Array<HttpClient> {
    if (Array.isArray(client)) {
      let configuredClients = [];

      client.forEach(toConfigure => {
        configuredClients.push(this.configure(toConfigure));
      });

      return configuredClients;
    }

    if (typeof client === 'string') {
      const endpoint = this.clientConfig.getEndpoint(client);

      if (!endpoint) {
        throw new Error(`There is no '${client || 'default'}' endpoint registered.`);
      }
      client = endpoint.client;
    } else if (client instanceof Rest) {
      client = client.client;
    } else if (!(client instanceof HttpClient)) {
      client = this.httpClient;
    }

    client.interceptors.push(this.interceptor);

    return client;
  }
}
