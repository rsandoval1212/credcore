from django.urls import path
from . import dashboard_views as v

urlpatterns = [
    path('',          v.DashboardView.as_view(),         name='dashboard'),
    path('kpis/',     v.KPIView.as_view(),               name='dashboard-kpis'),
    path('charts/',   v.ChartsView.as_view(),            name='dashboard-charts'),
    path('alerts/',   v.AlertsView.as_view(),            name='dashboard-alerts'),
    path('alerts/detail/', v.AlertsDetailView.as_view(), name='dashboard-alerts-detail'),

    # Ingresos por período
    path('earnings/', v.EarningsView.as_view(), name='earnings'),

    # Compartir documentos por WhatsApp
    path('receipt/<str:payment_id>/whatsapp/',     v.PaymentReceiptWhatsAppView.as_view(), name='receipt-wa'),
    path('amortization/<str:loan_id>/whatsapp/',   v.AmortizationShareView.as_view(),     name='amort-wa'),
    path('statement/<str:loan_id>/whatsapp/',      v.AccountStatementView.as_view(),      name='statement-wa'),
    path('analysis/<str:loan_id>/recurrence/',     v.PaymentRecurrenceAnalysisView.as_view(), name='recurrence'),

    # Configuración de empresa
    path('company/',  v.CompanySettingsView.as_view(),   name='company-settings'),

    # Backup
    path('backup/config/',              v.BackupConfigView.as_view(),   name='backup-config'),
    path('backup/list/',                v.BackupListView.as_view(),     name='backup-list'),
    path('backup/run/',                 v.BackupRunView.as_view(),      name='backup-run'),
    path('backup/<int:backup_id>/download/', v.BackupDownloadView.as_view(), name='backup-download'),
    path('backup/restore/',             v.BackupRestoreView.as_view(), name='backup-restore'),

    # Panel de inversionistas
    path('investors/', v.InvestorDashboardView.as_view(), name='investor-dashboard'),
]
