"""DairyPro 360 — Root URL Configuration"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/auth/',      include('dairypro.core.urls.auth')),
    path('api/v1/users/',     include('dairypro.core.urls.users')),
    path('api/v1/cattle/',    include('dairypro.cattle.urls')),
    path('api/v1/milk/',      include('dairypro.milk.urls')),
    path('api/v1/inventory/', include('dairypro.inventory.urls')),
    path('api/v1/sales/',     include('dairypro.sales.urls')),
    path('api/v1/hr/',        include('dairypro.hr.urls')),
    path('api/v1/finance/',   include('dairypro.finance.urls')),
    path('api/v1/reports/',   include('dairypro.reports.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
