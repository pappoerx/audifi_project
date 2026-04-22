import json
from functools import wraps

from django.http import JsonResponse

from users.models import UserToken


def parse_json_body(request):
    try:
        return json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return None


def get_user_from_bearer(request):
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    token_value = header.split(" ", 1)[1].strip()
    token = UserToken.objects.filter(token=token_value).select_related("user").first()
    if not token:
        return None
    token.save(update_fields=["last_used_at"])
    return token.user


def require_bearer_auth(roles=None):
    roles = roles or []

    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            user = get_user_from_bearer(request)
            if user is None:
                return JsonResponse({"detail": "Authentication required."}, status=401)
            if roles and user.role not in roles:
                return JsonResponse({"detail": "Insufficient permissions."}, status=403)
            request.auth_user = user
            return view_func(request, *args, **kwargs)

        return wrapper

    return decorator
