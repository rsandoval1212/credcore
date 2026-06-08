"""Mueve algunas cuotas a fechas vencidas/próximas para probar el sistema de notificaciones."""
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
os.environ['USE_SQLITE'] = 'True'
os.environ['USE_REDIS'] = 'False'
django.setup()

from datetime import date, timedelta
from apps.loans.models import Loan, LoanSchedule
from apps.customers.models import Customer

print("Configurando datos de notificaciones de prueba...")

# Asegurar que clientes tengan WhatsApp
for c in Customer.objects.all():
    if not c.whatsapp:
        c.whatsapp = c.phone1
        c.save(update_fields=['whatsapp'])
        print(f"  WA asignado: {c.get_full_name()} -> {c.whatsapp}")

# Mover algunas cuotas a fechas pasadas/próximas
today = date.today()
loans = Loan.objects.filter(status='ACTIVE').order_by('created_at')

if loans.count() >= 1:
    # Primer préstamo: cuota 1 vencida hace 15 días, cuota 2 vence en 3 días
    loan1 = loans[0]
    cuotas = list(loan1.schedule.all().order_by('installment_number'))
    if len(cuotas) >= 2:
        cuotas[0].due_date = today - timedelta(days=15)
        cuotas[0].status = 'PARTIAL'
        cuotas[0].save()
        cuotas[1].due_date = today + timedelta(days=3)
        cuotas[1].status = 'PENDING'
        cuotas[1].save()
        # Actualizar dias_past_due del prestamo
        loan1.days_past_due = 15
        loan1.save(update_fields=['days_past_due'])
        print(f"  Loan {loan1.loan_number}: cuota 1 vencida (15 dias), cuota 2 vence en 3 dias")

if loans.count() >= 2:
    # Segundo préstamo: cuota 1 vence hoy
    loan2 = loans[1]
    cuotas = list(loan2.schedule.all().order_by('installment_number'))
    if len(cuotas) >= 1:
        cuotas[0].due_date = today
        cuotas[0].status = 'PENDING'
        cuotas[0].save()
        print(f"  Loan {loan2.loan_number}: cuota 1 vence HOY")

print("\nResumen:")
print(f"  Cuotas vencidas: {LoanSchedule.objects.filter(due_date__lt=today, status__in=['PENDING','PARTIAL']).count()}")
print(f"  Cuotas proximas (7 dias): {LoanSchedule.objects.filter(due_date__range=[today, today + timedelta(days=7)], status__in=['PENDING','PARTIAL']).count()}")
print(f"  Clientes con WA: {Customer.objects.exclude(whatsapp='').count()}")
print("\nListo. Recarga el navegador para ver las notificaciones.")
