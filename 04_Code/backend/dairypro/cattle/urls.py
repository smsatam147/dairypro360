from django.urls import path
from .views import (CattleListCreateView, CattleDetailView,
                    HealthRecordListCreateView, VaccinationListCreateView,
                    BreedingRecordListCreateView)

urlpatterns = [
    path('',                                   CattleListCreateView.as_view()),
    path('<uuid:pk>/',                          CattleDetailView.as_view()),
    path('<uuid:cattle_id>/health-records/',    HealthRecordListCreateView.as_view()),
    path('<uuid:cattle_id>/vaccinations/',      VaccinationListCreateView.as_view()),
    path('<uuid:cattle_id>/breeding-records/',  BreedingRecordListCreateView.as_view()),
]
