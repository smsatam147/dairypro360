from django.urls import path
from .views import (CustomerListCreateView, SalesOrderListCreateView,
                    SalesOrderDetailView, InvoiceListCreateView, InvoiceDetailView)

urlpatterns = [
    path('customers/',              CustomerListCreateView.as_view()),
    path('orders/',                 SalesOrderListCreateView.as_view()),
    path('orders/<uuid:pk>/',       SalesOrderDetailView.as_view()),
    path('invoices/',               InvoiceListCreateView.as_view()),
    path('invoices/<uuid:pk>/',     InvoiceDetailView.as_view()),
]
