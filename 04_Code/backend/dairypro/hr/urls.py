from django.urls import path
from .views import (EmployeeListCreateView, EmployeeDetailView,
                    AttendanceListCreateView, PayrollRunListCreateView,
                    PayrollRunDetailView, approve_payroll_run)

urlpatterns = [
    path('employees/',                           EmployeeListCreateView.as_view()),
    path('employees/<uuid:pk>/',                 EmployeeDetailView.as_view()),
    path('attendance/',                          AttendanceListCreateView.as_view()),
    path('payroll-runs/',                        PayrollRunListCreateView.as_view()),
    path('payroll-runs/<uuid:pk>/',              PayrollRunDetailView.as_view()),
    path('payroll-runs/<uuid:pk>/approve/',      approve_payroll_run),
]
