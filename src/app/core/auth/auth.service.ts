import { Inject, Injectable, Optional } from '@angular/core';
import { PRIMARY_OUTLET, Router, UrlSegmentGroup, UrlTree } from '@angular/router';
import { HttpHeaders } from '@angular/common/http';
import { REQUEST, RESPONSE } from '@nguniversal/express-engine/tokens';

import { Observable, of as observableOf } from 'rxjs';
import { distinctUntilChanged, filter, map, startWith, switchMap, take, withLatestFrom } from 'rxjs/operators';
import { RouterReducerState } from '@ngrx/router-store';
import { select, Store } from '@ngrx/store';
import { CookieAttributes } from 'js-cookie';

import { EPerson } from '../eperson/models/eperson.model';
import { AuthRequestService } from './auth-request.service';
import { HttpOptions } from '../dspace-rest-v2/dspace-rest-v2.service';
import { AuthStatus } from './models/auth-status.model';
import { AuthTokenInfo, TOKENITEM } from './models/auth-token-info.model';
import { hasValue, hasValueOperator, isEmpty, isNotEmpty, isNotNull, isNotUndefined } from '../../shared/empty.util';
import { CookieService } from '../services/cookie.service';
import {
  getAuthenticatedUserId,
  getAuthenticationToken,
  getRedirectUrl,
  isAuthenticated,
  isTokenRefreshing
} from './selectors';
import { AppState, routerStateSelector } from '../../app.reducer';
import {
  CheckAuthenticationTokenAction,
  ResetAuthenticationMessagesAction,
  SetRedirectUrlAction
} from './auth.actions';
import { NativeWindowRef, NativeWindowService } from '../services/window.service';
import { Base64EncodeUrl } from '../../shared/utils/encode-decode.util';
import { RouteService } from '../services/route.service';
import { EPersonDataService } from '../eperson/eperson-data.service';
import { getAllSucceededRemoteDataPayload } from '../shared/operators';
import { AuthMethod } from './models/auth.method';

export const LOGIN_ROUTE = '/login';
export const LOGOUT_ROUTE = '/logout';
export const REDIRECT_COOKIE = 'dsRedirectUrl';
export const IMPERSONATING_COOKIE = 'dsImpersonatingEPerson';

/**
 * The auth service.
 */
@Injectable()
export class AuthService {

  /**
   * True if authenticated
   * @type boolean
   */
  protected _authenticated: boolean;

  constructor(@Inject(REQUEST) protected req: any,
              @Inject(NativeWindowService) protected _window: NativeWindowRef,
              @Optional() @Inject(RESPONSE) private response: any,
              protected authRequestService: AuthRequestService,
              protected epersonService: EPersonDataService,
              protected router: Router,
              protected routeService: RouteService,
              protected storage: CookieService,
              protected store: Store<AppState>
  ) {
    this.store.pipe(
      select(isAuthenticated),
      startWith(false)
    ).subscribe((authenticated: boolean) => this._authenticated = authenticated);

    // If current route is different from the one setted in authentication guard
    // and is not the login route, clear redirect url and messages
    const routeUrl$ = this.store.pipe(
      select(routerStateSelector),
      filter((routerState: RouterReducerState) => isNotUndefined(routerState)
        && isNotUndefined(routerState.state) && isNotEmpty(routerState.state.url)),
      filter((routerState: RouterReducerState) => !this.isLoginRoute(routerState.state.url)),
      map((routerState: RouterReducerState) => routerState.state.url)
    );
    const redirectUrl$ = this.store.pipe(select(getRedirectUrl), distinctUntilChanged());
    routeUrl$.pipe(
      withLatestFrom(redirectUrl$),
      map(([routeUrl, redirectUrl]) => [routeUrl, redirectUrl])
    ).pipe(filter(([routeUrl, redirectUrl]) => isNotEmpty(redirectUrl) && (routeUrl !== redirectUrl)))
      .subscribe(() => {
        this.clearRedirectUrl();
      });
  }

  /**
   * Check if is a login page route
   *
   * @param {string} url
   * @returns {Boolean}.
   */
  protected isLoginRoute(url: string) {
    const urlTree: UrlTree = this.router.parseUrl(url);
    const g: UrlSegmentGroup = urlTree.root.children[PRIMARY_OUTLET];
    const segment = '/' + g.toString();
    return segment === LOGIN_ROUTE;
  }

  /**
   * Authenticate the user
   *
   * @param {string} user The user name
   * @param {string} password The user's password
   * @returns {Observable<User>} The authenticated user observable.
   */
  public authenticate(user: string, password: string): Observable<AuthStatus> {
    // Attempt authenticating the user using the supplied credentials.
    const body = (`password=${Base64EncodeUrl(password)}&user=${Base64EncodeUrl(user)}`);
    const options: HttpOptions = Object.create({});
    let headers = new HttpHeaders();
    headers = headers.append('Content-Type', 'application/x-www-form-urlencoded');
    options.headers = headers;
    return this.authRequestService.postToEndpoint('login', body, options).pipe(
      map((status: AuthStatus) => {
        if (status.authenticated) {
          return status;
        } else {
          throw(new Error('Invalid email or password'));
        }
      }))

  }

  /**
   * Checks if token is present into the request cookie
   */
  public checkAuthenticationCookie(): Observable<AuthStatus> {
    // Determine if the user has an existing auth session on the server
    const options: HttpOptions = Object.create({});
    let headers = new HttpHeaders();
    headers = headers.append('Accept', 'application/json');
    options.headers = headers;
    options.withCredentials = true;
    return this.authRequestService.getRequest('status', options).pipe(
      map((status: AuthStatus) => Object.assign(new AuthStatus(), status))
    );
  }

  /**
   * Determines if the user is authenticated
   * @returns {Observable<boolean>}
   */
  public isAuthenticated(): Observable<boolean> {
    return this.store.pipe(select(isAuthenticated));
  }

  /**
   * Returns the href link to authenticated user
   * @returns {string}
   */
  public authenticatedUser(token: AuthTokenInfo): Observable<string> {
    // Determine if the user has an existing auth session on the server
    const options: HttpOptions = Object.create({});
    let headers = new HttpHeaders();
    headers = headers.append('Accept', 'application/json');
    headers = headers.append('Authorization', `Bearer ${token.accessToken}`);
    options.headers = headers;
    return this.authRequestService.getRequest('status', options).pipe(
      map((status: AuthStatus) => {
        if (status.authenticated) {
          return status._links.eperson.href;
        } else {
          throw(new Error('Not authenticated'));
        }
      }))
  }

  /**
   * Returns the authenticated user by href
   * @returns {User}
   */
  public retrieveAuthenticatedUserByHref(userHref: string): Observable<EPerson> {
    return this.epersonService.findByHref(userHref).pipe(
      getAllSucceededRemoteDataPayload()
    )
  }

  /**
   * Returns the authenticated user by id
   * @returns {User}
   */
  public retrieveAuthenticatedUserById(userId: string): Observable<EPerson> {
    return this.epersonService.findById(userId).pipe(
      getAllSucceededRemoteDataPayload()
    )
  }

  /**
   * Returns the authenticated user from the store
   * @returns {User}
   */
  public getAuthenticatedUserFromStore(): Observable<EPerson> {
    return this.store.pipe(
      select(getAuthenticatedUserId),
      hasValueOperator(),
      switchMap((id: string) => this.epersonService.findById(id)),
      getAllSucceededRemoteDataPayload()
    )
  }

  /**
   * Checks if token is present into browser storage and is valid.
   */
  public checkAuthenticationToken() {
    this.store.dispatch(new CheckAuthenticationTokenAction());
  }

  /**
   * Checks if token is present into storage and is not expired
   */
  public hasValidAuthenticationToken(): Observable<AuthTokenInfo> {
    return this.store.pipe(
      select(getAuthenticationToken),
      take(1),
      map((authTokenInfo: AuthTokenInfo) => {
        let token: AuthTokenInfo;
        // Retrieve authentication token info and check if is valid
        token = isNotEmpty(authTokenInfo) ? authTokenInfo : this.storage.get(TOKENITEM);
        if (isNotEmpty(token) && token.hasOwnProperty('accessToken') && isNotEmpty(token.accessToken) && !this.isTokenExpired(token)) {
          return token;
        } else {
          throw false;
        }
      })
    );
  }

  /**
   * Checks if token is present into storage
   */
  public refreshAuthenticationToken(token: AuthTokenInfo): Observable<AuthTokenInfo> {
    const options: HttpOptions = Object.create({});
    let headers = new HttpHeaders();
    headers = headers.append('Accept', 'application/json');
    if (token && token.accessToken) {
      headers = headers.append('Authorization', `Bearer ${token.accessToken}`);
    }
    options.headers = headers;
    options.withCredentials = true;
    return this.authRequestService.postToEndpoint('login', {}, options).pipe(
      map((status: AuthStatus) => {
        if (status.authenticated) {
          return status.token;
        } else {
          throw(new Error('Not authenticated'));
        }
      }));
  }

  /**
   * Clear authentication errors
   */
  public resetAuthenticationError(): void {
    this.store.dispatch(new ResetAuthenticationMessagesAction());
  }

  /**
   * Retrieve authentication methods available
   * @returns {User}
   */
  public retrieveAuthMethodsFromAuthStatus(status: AuthStatus): Observable<AuthMethod[]> {
    let authMethods: AuthMethod[] = [];
    if (isNotEmpty(status.authMethods)) {
      authMethods = status.authMethods;
    }
    return observableOf(authMethods);
  }

  /**
   * Create a new user
   * @returns {User}
   */
  public create(user: EPerson): Observable<EPerson> {
    // Normally you would do an HTTP request to POST the user
    // details and then return the new user object
    // but, let's just return the new user for this example.
    // this._authenticated = true;
    return observableOf(user);
  }

  /**
   * End session
   * @returns {Observable<boolean>}
   */
  public logout(): Observable<boolean> {
    // Send a request that sign end the session
    let headers = new HttpHeaders();
    headers = headers.append('Content-Type', 'application/x-www-form-urlencoded');
    const options: HttpOptions = Object.create({ headers, responseType: 'text' });
    return this.authRequestService.getRequest('logout', options).pipe(
      map((status: AuthStatus) => {
        if (!status.authenticated) {
          return true;
        } else {
          throw(new Error('auth.errors.invalid-user'));
        }
      }))
  }

  /**
   * Retrieve authentication token info and make authorization header
   * @returns {string}
   */
  public buildAuthHeader(token?: AuthTokenInfo): string {
    if (isEmpty(token)) {
      token = this.getToken();
    }
    return (this._authenticated && isNotNull(token)) ? `Bearer ${token.accessToken}` : '';
  }

  /**
   * Get authentication token info
   * @returns {AuthTokenInfo}
   */
  public getToken(): AuthTokenInfo {
    let token: AuthTokenInfo;
    this.store.pipe(select(getAuthenticationToken))
      .subscribe((authTokenInfo: AuthTokenInfo) => {
        // Retrieve authentication token info and check if is valid
        token = authTokenInfo || null;
      });
    return token;
  }

  /**
   * Check if a token is next to be expired
   * @returns {boolean}
   */
  public isTokenExpiring(): Observable<boolean> {
    return this.store.pipe(
      select(isTokenRefreshing),
      take(1),
      map((isRefreshing: boolean) => {
        if (this.isTokenExpired() || isRefreshing) {
          return false;
        } else {
          const token = this.getToken();
          return token.expires - (60 * 5 * 1000) < Date.now();
        }
      })
    )
  }

  /**
   * Check if a token is expired
   * @returns {boolean}
   */
  public isTokenExpired(token?: AuthTokenInfo): boolean {
    token = token || this.getToken();
    return token && token.expires < Date.now();
  }

  /**
   * Save authentication token info
   *
   * @param {AuthTokenInfo} token The token to save
   * @returns {AuthTokenInfo}
   */
  public storeToken(token: AuthTokenInfo) {
    // Add 1 day to the current date
    const expireDate = Date.now() + (1000 * 60 * 60 * 24);

    // Set the cookie expire date
    const expires = new Date(expireDate);
    const options: CookieAttributes = { expires: expires };

    // Save cookie with the token
    return this.storage.set(TOKENITEM, token, options);
  }

  /**
   * Remove authentication token info
   */
  public removeToken() {
    return this.storage.remove(TOKENITEM);
  }

  /**
   * Replace authentication token info with a new one
   */
  public replaceToken(token: AuthTokenInfo) {
    this.removeToken();
    return this.storeToken(token);
  }

  /**
   * Redirect to the login route
   */
  public redirectToLogin() {
    this.router.navigate([LOGIN_ROUTE]);
  }

  /**
   * Redirect to the login route when token has expired
   */
  public redirectToLoginWhenTokenExpired() {
    const redirectUrl = LOGIN_ROUTE + '?expired=true';
    if (this._window.nativeWindow.location) {
      // Hard redirect to login page, so that all state is definitely lost
      this._window.nativeWindow.location.href = redirectUrl;
    } else if (this.response) {
      if (!this.response._headerSent) {
        this.response.redirect(302, redirectUrl);
      }
    } else {
      this.router.navigateByUrl(redirectUrl);
    }
  }

  /**
   * Redirect to the route navigated before the login
   */
  public redirectAfterLoginSuccess(isStandalonePage: boolean) {
    this.getRedirectUrl().pipe(
      take(1))
      .subscribe((redirectUrl) => {

        if (isNotEmpty(redirectUrl)) {
          this.clearRedirectUrl();
          this.router.onSameUrlNavigation = 'reload';
          this.navigateToRedirectUrl(redirectUrl);
        } else {
          // If redirectUrl is empty use history.
          this.routeService.getHistory().pipe(
            take(1)
          ).subscribe((history) => {
            let redirUrl;
            if (isStandalonePage) {
              // For standalone login pages, use the previous route.
              redirUrl = history[history.length - 2] || '';
            } else {
              redirUrl = history[history.length - 1] || '';
            }
            this.navigateToRedirectUrl(redirUrl);
          });
        }
      });

  }

  protected navigateToRedirectUrl(redirectUrl: string) {
    const url = decodeURIComponent(redirectUrl);
    // in case the user navigates directly to /login (via bookmark, etc), or the route history is not found.
    if (isEmpty(url) || url.startsWith(LOGIN_ROUTE)) {
      this.router.navigateByUrl('/');
      /* TODO Reenable hard redirect when REST API can handle x-forwarded-for, see https://github.com/DSpace/DSpace/pull/2207 */
      // this._window.nativeWindow.location.href = '/';
    } else {
      /* TODO Reenable hard redirect when REST API can handle x-forwarded-for, see https://github.com/DSpace/DSpace/pull/2207 */
      // this._window.nativeWindow.location.href = url;
      this.router.navigateByUrl(url);
    }
  }

  /**
   * Refresh route navigated
   */
  public refreshAfterLogout() {
    // Hard redirect to the reload page with a unique number behind it
    // so that all state is definitely lost
    this._window.nativeWindow.location.href = `/reload/${new Date().getTime()}`;
  }

  /**
   * Get redirect url
   */
  getRedirectUrl(): Observable<string> {
    const redirectUrl = this.storage.get(REDIRECT_COOKIE);
    if (isNotEmpty(redirectUrl)) {
      return observableOf(redirectUrl);
    } else {
      return this.store.pipe(select(getRedirectUrl));
    }
  }

  /**
   * Set redirect url
   */
  setRedirectUrl(url: string) {
    // Add 1 hour to the current date
    const expireDate = Date.now() + (1000 * 60 * 60);

    // Set the cookie expire date
    const expires = new Date(expireDate);
    const options: CookieAttributes = { expires: expires };
    this.storage.set(REDIRECT_COOKIE, url, options);
    this.store.dispatch(new SetRedirectUrlAction(isNotUndefined(url) ? url : ''));
  }

  /**
   * Clear redirect url
   */
  clearRedirectUrl() {
    this.store.dispatch(new SetRedirectUrlAction(''));
    this.storage.remove(REDIRECT_COOKIE);
  }

  /**
   * Start impersonating EPerson
   * @param epersonId ID of the EPerson to impersonate
   */
  impersonate(epersonId: string) {
    this.storage.set(IMPERSONATING_COOKIE, epersonId);
    this.refreshAfterLogout();
  }

  /**
   * Stop impersonating EPerson
   */
  stopImpersonating() {
    this.storage.remove(IMPERSONATING_COOKIE);
  }

  /**
   * Stop impersonating EPerson and refresh the store/ui
   */
  stopImpersonatingAndRefresh() {
    this.stopImpersonating();
    this.refreshAfterLogout();
  }

  /**
   * Get the ID of the EPerson we're currently impersonating
   * Returns undefined if we're not impersonating anyone
   */
  getImpersonateID(): string {
    return this.storage.get(IMPERSONATING_COOKIE);
  }

  /**
   * Whether or not we are currently impersonating an EPerson
   */
  isImpersonating(): boolean {
    return hasValue(this.getImpersonateID());
  }

  /**
   * Whether or not we are currently impersonating a specific EPerson
   * @param epersonId ID of the EPerson to check
   */
  isImpersonatingUser(epersonId: string): boolean {
    return this.getImpersonateID() === epersonId;
  }

}
