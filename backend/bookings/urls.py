from django.urls import path

from .views import create_tutorial_booking, find_available_halls

urlpatterns = [
    path("available-halls", find_available_halls, name="available_halls"),
    path("tutorials", create_tutorial_booking, name="create_tutorial_booking"),
]
