"""finance/views.py"""
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from .models import Account, JournalEntry
from .serializers import AccountSerializer, JournalEntrySerializer
from dairypro.core.permissions import IsAccountantOrAbove
from dairypro.core.utils import write_audit_log


class AccountListCreateView(generics.ListCreateAPIView):
    serializer_class   = AccountSerializer
    permission_classes = [IsAuthenticated, IsAccountantOrAbove]
    queryset           = Account.objects.filter(is_active=True)


class JournalEntryListCreateView(generics.ListCreateAPIView):
    serializer_class   = JournalEntrySerializer
    permission_classes = [IsAuthenticated, IsAccountantOrAbove]
    filterset_fields   = ['entry_date', 'reference_type']

    def get_queryset(self):
        return JournalEntry.objects.prefetch_related('lines__account').order_by('-entry_date')

    def perform_create(self, serializer):
        entry = serializer.save(created_by=self.request.user)
        write_audit_log(self.request.user, 'CREATE', 'journal_entry',
                        resource_id=entry.id,
                        new_values={'entry_number': entry.entry_number},
                        request=self.request)


class JournalEntryDetailView(generics.RetrieveAPIView):
    serializer_class   = JournalEntrySerializer
    permission_classes = [IsAuthenticated, IsAccountantOrAbove]
    queryset           = JournalEntry.objects.prefetch_related('lines__account')
