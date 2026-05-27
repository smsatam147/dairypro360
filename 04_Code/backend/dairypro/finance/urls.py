from django.urls import path
from .views import AccountListCreateView, JournalEntryListCreateView, JournalEntryDetailView

urlpatterns = [
    path('accounts/',                  AccountListCreateView.as_view()),
    path('journal-entries/',           JournalEntryListCreateView.as_view()),
    path('journal-entries/<uuid:pk>/', JournalEntryDetailView.as_view()),
]
