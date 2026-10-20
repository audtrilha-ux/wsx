import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpContextToken, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export type AuthorityContext = 'client' | 'hq' | 'auto';
export const AUTH_AUTHORITY = new HttpContextToken<AuthorityContext>(() => 'auto');

export interface RequestOptions {
  headers?: HttpHeaders | Record<string, string | string[]>;
  params?: HttpParams | Record<string, string | number | boolean | readonly (string | number | boolean)[]>;
  reportProgress?: boolean;
  withCredentials?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class HqApiClient {
  private http = inject(HttpClient);

  private normalizeUrl(url: string): string {
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return url.startsWith('/api/v1') ? url : `/api/v1${url.startsWith('/') ? '' : '/'}${url}`;
  }

  private getHqContext(customContext?: HttpContext): HttpContext {
    const ctx = customContext || new HttpContext();
    return ctx.set(AUTH_AUTHORITY, 'hq');
  }

  get<T>(url: string, options?: RequestOptions): Observable<T> {
    return this.http.get<T>(this.normalizeUrl(url), {
      ...options,
      context: this.getHqContext()
    });
  }

  post<T>(url: string, body: unknown, options?: RequestOptions): Observable<T> {
    return this.http.post<T>(this.normalizeUrl(url), body, {
      ...options,
      context: this.getHqContext()
    });
  }

  put<T>(url: string, body: unknown, options?: RequestOptions): Observable<T> {
    return this.http.put<T>(this.normalizeUrl(url), body, {
      ...options,
      context: this.getHqContext()
    });
  }

  patch<T>(url: string, body: unknown, options?: RequestOptions): Observable<T> {
    return this.http.patch<T>(this.normalizeUrl(url), body, {
      ...options,
      context: this.getHqContext()
    });
  }

  delete<T>(url: string, options?: RequestOptions): Observable<T> {
    return this.http.delete<T>(this.normalizeUrl(url), {
      ...options,
      context: this.getHqContext()
    });
  }
}

@Injectable({
  providedIn: 'root'
})
export class ClientApiClient {
  private http = inject(HttpClient);

  private normalizeUrl(url: string): string {
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return url.startsWith('/api/v1') ? url : `/api/v1${url.startsWith('/') ? '' : '/'}${url}`;
  }

  private getClientContext(customContext?: HttpContext): HttpContext {
    const ctx = customContext || new HttpContext();
    return ctx.set(AUTH_AUTHORITY, 'client');
  }

  get<T>(url: string, options?: RequestOptions): Observable<T> {
    return this.http.get<T>(this.normalizeUrl(url), {
      ...options,
      context: this.getClientContext()
    });
  }

  post<T>(url: string, body: unknown, options?: RequestOptions): Observable<T> {
    return this.http.post<T>(this.normalizeUrl(url), body, {
      ...options,
      context: this.getClientContext()
    });
  }

  put<T>(url: string, body: unknown, options?: RequestOptions): Observable<T> {
    return this.http.put<T>(this.normalizeUrl(url), body, {
      ...options,
      context: this.getClientContext()
    });
  }

  patch<T>(url: string, body: unknown, options?: RequestOptions): Observable<T> {
    return this.http.patch<T>(this.normalizeUrl(url), body, {
      ...options,
      context: this.getClientContext()
    });
  }

  delete<T>(url: string, options?: RequestOptions): Observable<T> {
    return this.http.delete<T>(this.normalizeUrl(url), {
      ...options,
      context: this.getClientContext()
    });
  }
}
