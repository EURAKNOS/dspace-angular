// import actions
import {
  AddAuthenticationMessageAction,
  AuthActions,
  AuthActionTypes,
  AuthenticatedSuccessAction,
  AuthenticationErrorAction,
  LogOutErrorAction,
  RedirectWhenAuthenticationIsRequiredAction,
  RedirectWhenTokenExpiredAction,
  RefreshTokenSuccessAction,
  RetrieveAuthenticatedEpersonSuccessAction,
  RetrieveAuthMethodsSuccessAction,
  SetRedirectUrlAction
} from './auth.actions';
// import models
import { AuthTokenInfo } from './models/auth-token-info.model';
import { AuthMethod } from './models/auth.method';
import { AuthMethodType } from './models/auth.method-type';

/**
 * The auth state.
 * @interface State
 */
export interface AuthState {

  // boolean if user is authenticated
  authenticated: boolean;

  // the authentication token
  authToken?: AuthTokenInfo;

  // error message
  error?: string;

  // true if we have attempted existing auth session
  loaded: boolean;

  // true when loading
  loading: boolean;

  // info message
  info?: string;

  // redirect url after login
  redirectUrl?: string;

  // true when refreshing token
  refreshing?: boolean;

  // the authenticated user's id
  userId?: string;

  // all authentication Methods enabled at the backend
  authMethods?: AuthMethod[];

}

/**
 * The initial state.
 */
const initialState: AuthState = {
  authenticated: false,
  loaded: false,
  loading: false,
  authMethods: []
};

/**
 * The reducer function.
 * @function reducer
 * @param {State} state Current state
 * @param {AuthActions} action Incoming action
 */
export function authReducer(state: any = initialState, action: AuthActions): AuthState {

  switch (action.type) {
    case AuthActionTypes.AUTHENTICATE:
      return Object.assign({}, state, {
        error: undefined,
        loading: true,
        info: undefined
      });

    case AuthActionTypes.AUTHENTICATED:
    case AuthActionTypes.CHECK_AUTHENTICATION_TOKEN:
    case AuthActionTypes.CHECK_AUTHENTICATION_TOKEN_COOKIE:
      return Object.assign({}, state, {
        loading: true
      });

    case AuthActionTypes.AUTHENTICATED_ERROR:
    case AuthActionTypes.RETRIEVE_AUTHENTICATED_EPERSON_ERROR:
      return Object.assign({}, state, {
        authenticated: false,
        authToken: undefined,
        error: (action as AuthenticationErrorAction).payload.message,
        loaded: true,
        loading: false
      });

    case AuthActionTypes.AUTHENTICATED_SUCCESS:
      return Object.assign({}, state, {
        authenticated: true,
        authToken: (action as AuthenticatedSuccessAction).payload.authToken
      });

    case AuthActionTypes.RETRIEVE_AUTHENTICATED_EPERSON_SUCCESS:
      return Object.assign({}, state, {
        loaded: true,
        error: undefined,
        loading: false,
        info: undefined,
        userId: (action as RetrieveAuthenticatedEpersonSuccessAction).payload
      });

    case AuthActionTypes.AUTHENTICATE_ERROR:
    case AuthActionTypes.REGISTRATION_ERROR:
      return Object.assign({}, state, {
        authenticated: false,
        authToken: undefined,
        error: (action as AuthenticationErrorAction).payload.message,
        loading: false
      });

    case AuthActionTypes.AUTHENTICATE_SUCCESS:
    case AuthActionTypes.LOG_OUT:
      return state;

    case AuthActionTypes.LOG_OUT_ERROR:
      return Object.assign({}, state, {
        authenticated: true,
        error: (action as LogOutErrorAction).payload.message
      });

    case AuthActionTypes.LOG_OUT_SUCCESS:
    case AuthActionTypes.REFRESH_TOKEN_ERROR:
      return Object.assign({}, state, {
        authenticated: false,
        authToken: undefined,
        error: undefined,
        loaded: false,
        loading: false,
        info: undefined,
        refreshing: false,
        userId: undefined
      });

    case AuthActionTypes.REDIRECT_AUTHENTICATION_REQUIRED:
    case AuthActionTypes.REDIRECT_TOKEN_EXPIRED:
      return Object.assign({}, state, {
        authenticated: false,
        authToken: undefined,
        loaded: false,
        loading: false,
        info: (action as RedirectWhenTokenExpiredAction as RedirectWhenAuthenticationIsRequiredAction).payload,
        userId: undefined
      });

    case AuthActionTypes.REGISTRATION:
      return Object.assign({}, state, {
        authenticated: false,
        authToken: undefined,
        error: undefined,
        loading: true,
        info: undefined
      });

    case AuthActionTypes.REGISTRATION_SUCCESS:
      return state;

    case AuthActionTypes.REFRESH_TOKEN:
      return Object.assign({}, state, {
        refreshing: true,
      });

    case AuthActionTypes.REFRESH_TOKEN_SUCCESS:
      return Object.assign({}, state, {
        authToken: (action as RefreshTokenSuccessAction).payload,
        refreshing: false,
      });

    case AuthActionTypes.ADD_MESSAGE:
      return Object.assign({}, state, {
        info: (action as AddAuthenticationMessageAction).payload,
      });

    case AuthActionTypes.RESET_MESSAGES:
      return Object.assign({}, state, {
        error: undefined,
        info: undefined,
      });

    // next three cases are used by dynamic rendering of login methods
    case AuthActionTypes.RETRIEVE_AUTH_METHODS:
      return Object.assign({}, state, {
        loading: true
      });

    case AuthActionTypes.RETRIEVE_AUTH_METHODS_SUCCESS:
      return Object.assign({}, state, {
        loading: false,
        authMethods: (action as RetrieveAuthMethodsSuccessAction).payload
      });

    case AuthActionTypes.RETRIEVE_AUTH_METHODS_ERROR:
      return Object.assign({}, state, {
        loading: false,
        authMethods: [new AuthMethod(AuthMethodType.Password)]
      });

    case AuthActionTypes.SET_REDIRECT_URL:
      return Object.assign({}, state, {
        redirectUrl: (action as SetRedirectUrlAction).payload,
      });

    default:
      return state;
  }
}
