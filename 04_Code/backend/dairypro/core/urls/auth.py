from django.urls import path
from dairypro.core.views import (login_view, refresh_view, logout_view,
                                  change_password_view, me_view)

urlpatterns = [
    path('login/',           login_view),
    path('refresh/',         refresh_view),
    path('logout/',          logout_view),
    path('change-password/', change_password_view),
    path('me/',              me_view),
]
