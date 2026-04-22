class SimpleCorsMiddleware:
    """
    Minimal CORS middleware for local frontend development.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        origin = request.headers.get("Origin", "")
        allow_origin = origin if origin in {"http://127.0.0.1:5500", "http://localhost:5500"} else ""
        # API uses bearer tokens, not Django session CSRF forms.
        # Keep admin protected while allowing frontend API calls.
        if not request.path.startswith("/admin/"):
            request._dont_enforce_csrf_checks = True

        if request.method == "OPTIONS":
            from django.http import HttpResponse

            response = HttpResponse(status=204)
        else:
            response = self.get_response(request)

        if allow_origin:
            response["Access-Control-Allow-Origin"] = allow_origin
            response["Access-Control-Allow-Credentials"] = "true"
            response["Vary"] = "Origin"

        response["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        response["Access-Control-Allow-Methods"] = "GET, POST, PATCH, PUT, DELETE, OPTIONS"
        return response
