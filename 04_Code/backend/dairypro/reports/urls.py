from django.urls import path
from .views import dashboard_kpis, audit_log_view
from dairypro.core.views import AuditLogListView

urlpatterns = [
    path('dashboard/',  dashboard_kpis),
    path('audit-log/',  AuditLogListView.as_view()),
]
