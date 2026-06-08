from django.urls import path
from . import report_views
from . import excel_views
from . import pdf_views
from . import import_views

urlpatterns = [
    # PDFs
    path('pdf/receipt/<str:payment_id>/',   pdf_views.PaymentReceiptPDFView.as_view(),   name='pdf-receipt'),
    path('pdf/amortization/<str:loan_id>/', pdf_views.AmortizationPDFView.as_view(),     name='pdf-amortization'),
    path('pdf/contract/<str:loan_id>/',     pdf_views.LoanContractPDFView.as_view(),     name='pdf-contract'),
    path('pdf/statement/<str:loan_id>/',    pdf_views.AccountStatementPDFView.as_view(), name='pdf-statement'),

    # Importación desde Excel
    path('import/template/',  import_views.ImportTemplateView.as_view(),  name='import-template'),
    path('import/customers/', import_views.ImportCustomersView.as_view(), name='import-customers'),


    # Reportes JSON (existentes)
    path('loans/',       report_views.LoanReportView.as_view(),       name='report-loans'),
    path('payments/',    report_views.PaymentReportView.as_view(),    name='report-payments'),
    path('collections/', report_views.CollectionReportView.as_view(), name='report-collections'),
    path('portfolio/',   report_views.PortfolioReportView.as_view(),  name='report-portfolio'),

    # Exportaciones Excel individuales
    path('export/customers/', excel_views.ExportCustomersView.as_view(), name='export-customers'),
    path('export/loans/',     excel_views.ExportLoansView.as_view(),     name='export-loans'),
    path('export/payments/',  excel_views.ExportPaymentsView.as_view(),  name='export-payments'),

    # Reporte maestro completo (todas las hojas + gráficos)
    path('export/master/',    excel_views.ExportMasterReportView.as_view(), name='export-master'),
]
