import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    // Grab the token from localStorage
    const token = localStorage.getItem('token');
    // If token exists, clone the request and add the Authorization header
    if (token) {
        const authReq = req.clone({
            setHeaders: {
                Authorization: `Bearer ${token}`
            }
        });
        return next(authReq);
    }

    // Otherwise, send the original request (important for login!)
    return next(req);
};