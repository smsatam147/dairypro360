from django.urls import path
from .views import MilkCollectionListCreateView, daily_summary_view, sync_offline_entries

urlpatterns = [
    path('collections/',        MilkCollectionListCreateView.as_view()),
    path('collections/sync/',   sync_offline_entries),
    path('summary/daily/',      daily_summary_view),
]
