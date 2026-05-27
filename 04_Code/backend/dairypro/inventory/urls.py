from django.urls import path
from .views import InventoryItemListCreateView, InventoryItemDetailView, StockTransactionCreateView

urlpatterns = [
    path('items/',              InventoryItemListCreateView.as_view()),
    path('items/<uuid:pk>/',    InventoryItemDetailView.as_view()),
    path('transactions/',       StockTransactionCreateView.as_view()),
]
