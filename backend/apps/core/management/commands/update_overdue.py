"""
Comando: python manage.py update_overdue

Actualiza automáticamente los días de mora y el estado de todos los préstamos activos.
Debe ejecutarse diariamente (idealmente a las 00:05 AM).

En Windows: Programar con el Programador de Tareas
En Linux:   cron job: 5 0 * * * /path/venv/bin/python manage.py update_overdue
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db.models import Q
from datetime import date


class Command(BaseCommand):
    help = 'Actualiza mora diaria de todos los préstamos activos'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true',
                            help='Simula sin guardar cambios')
        parser.add_argument('--verbose', action='store_true',
                            help='Muestra detalle de cada préstamo actualizado')

    def handle(self, *args, **options):
        from apps.loans.models import Loan, LoanSchedule

        dry_run = options['dry_run']
        verbose = options['verbose']
        today   = date.today()

        self.stdout.write(f'\n{"[DRY RUN] " if dry_run else ""}Actualizando mora — {today}\n')

        loans = Loan.objects.filter(
            status__in=['ACTIVE', 'DEFAULTED'],
            is_deleted=False,
        ).select_related('customer')

        updated       = 0
        to_default    = 0
        to_reactivate = 0
        errors        = 0

        for loan in loans:
            try:
                # Cuotas vencidas sin pagar
                overdue_qs = LoanSchedule.objects.filter(
                    loan=loan,
                    status__in=['PENDING', 'PARTIAL'],
                    due_date__lt=today,
                )
                overdue_count = overdue_qs.count()

                if overdue_count > 0:
                    first_overdue = overdue_qs.order_by('due_date').first()
                    days_past = (today - first_overdue.due_date).days
                else:
                    days_past = 0

                old_days   = loan.days_past_due
                old_status = loan.status
                new_status = loan.status

                # Reglas de estado
                if days_past >= 90:
                    new_status = 'DEFAULTED'
                elif days_past == 0 and loan.status == 'DEFAULTED':
                    new_status = 'ACTIVE'  # Se regularizó
                elif days_past > 0 and loan.status == 'ACTIVE':
                    new_status = 'ACTIVE'  # Sigue activo hasta 90 días

                changed = (days_past != old_days) or (new_status != old_status)

                if changed:
                    if not dry_run:
                        loan.days_past_due = days_past
                        loan.status        = new_status
                        loan.save(update_fields=['days_past_due', 'status'])
                    updated += 1

                    if new_status == 'DEFAULTED' and old_status != 'DEFAULTED':
                        to_default += 1
                    if new_status == 'ACTIVE' and old_status == 'DEFAULTED':
                        to_reactivate += 1

                    if verbose:
                        self.stdout.write(
                            f'  {loan.loan_number} | {str(loan.customer.get_full_name())[:20]:20} | '
                            f'{old_days}d -> {days_past}d | {old_status} -> {new_status}'
                        )

            except Exception as e:
                errors += 1
                self.stderr.write(f'ERROR en {loan.loan_number}: {e}')

        # Resumen
        self.stdout.write('\n' + '-' * 60)
        self.stdout.write(f'Prestamos actualizados:  {updated}')
        self.stdout.write(f'Nuevos en default (>=90 dias): {to_default}')
        self.stdout.write(f'Reactivados (mora saldada): {to_reactivate}')
        if errors:
            self.stdout.write(f'Errores: {errors}')
        self.stdout.write('[DRY RUN - sin cambios guardados]' if dry_run else 'Completado.')
