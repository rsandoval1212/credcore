"""Dashboard principal con KPIs financieros y alertas de cobro."""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum, Count, Q
from django.utils import timezone
from datetime import date, timedelta
from decimal import Decimal


class DashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.loans.models import Loan
        from apps.payments.models import Payment
        from apps.customers.models import Customer

        today = date.today()
        month_start = today.replace(day=1)
        branch = request.user.branch

        loan_qs = Loan.objects.filter(is_deleted=False)
        if branch and not request.user.is_superuser:
            loan_qs = loan_qs.filter(branch=branch)

        active_loans = loan_qs.filter(status='ACTIVE')
        overdue_loans = active_loans.filter(days_past_due__gt=0)

        pay_filter = {'loan__branch': branch} if branch and not request.user.is_superuser else {}
        pay_qs = Payment.objects.filter(status='CONFIRMED', **pay_filter)

        # Agregados de pagos
        pay_today = pay_qs.filter(payment_date=today).aggregate(
            total=Sum('total_amount'), interest=Sum('interest_amount'), count=Count('id')
        )
        pay_month = pay_qs.filter(payment_date__gte=month_start).aggregate(
            total=Sum('total_amount'), interest=Sum('interest_amount'), count=Count('id')
        )

        # Próximos vencimientos (próximos 7 días)
        from apps.loans.models import LoanSchedule
        next_7 = today + timedelta(days=7)
        upcoming = LoanSchedule.objects.filter(
            status__in=['PENDING', 'PARTIAL'],
            due_date__range=[today, next_7],
            **(({'loan__branch': branch}) if branch and not request.user.is_superuser else {})
        ).count()

        # Mora por semáforo
        mora_15  = active_loans.filter(days_past_due__gte=1,  days_past_due__lte=15).count()
        mora_30  = active_loans.filter(days_past_due__gte=16, days_past_due__lte=30).count()
        mora_30p = active_loans.filter(days_past_due__gt=30).count()

        total_portfolio = float(active_loans.aggregate(t=Sum('outstanding_principal'))['t'] or 0)
        overdue_pf      = float(overdue_loans.aggregate(t=Sum('outstanding_principal'))['t'] or 0)

        data = {
            'total_portfolio':          total_portfolio,
            'active_loans_count':       active_loans.count(),
            'overdue_loans_count':      overdue_loans.count(),
            'overdue_portfolio':        overdue_pf,
            'delinquency_rate':         round(overdue_pf / total_portfolio * 100, 2) if total_portfolio else 0,

            'active_customers':         Customer.objects.filter(status='ACTIVE', is_deleted=False).count(),
            'customers_in_arrears':     overdue_loans.values('customer').distinct().count(),

            # Cobros
            'collections_today':        float(pay_today['total'] or 0),
            'collections_today_count':  pay_today['count'] or 0,
            'collections_this_month':   float(pay_month['total'] or 0),
            'collections_month_count':  pay_month['count'] or 0,

            # Intereses = ganancia bruta
            'interest_today':           float(pay_today['interest'] or 0),
            'interest_this_month':      float(pay_month['interest'] or 0),

            # Desembolsos
            'disbursements_this_month': float(loan_qs.filter(
                disbursement_date__gte=month_start
            ).aggregate(t=Sum('principal_amount'))['t'] or 0),

            # Próximos vencimientos
            'upcoming_payments':        upcoming,

            # Semáforo de mora
            'mora_1_15':    mora_15,
            'mora_16_30':   mora_30,
            'mora_30_plus': mora_30p,

            'today': today.isoformat(),
        }

        return Response(data)


class KPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({'message': 'KPIs endpoint'})


class ChartsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.payments.models import Payment
        from django.db.models.functions import TruncMonth
        collections_by_month = (
            Payment.objects.filter(status='CONFIRMED')
            .annotate(month=TruncMonth('payment_date'))
            .values('month')
            .annotate(total=Sum('total_amount'))
            .order_by('-month')[:12]
        )
        return Response({'collections_by_month': list(collections_by_month)})


class AlertsView(APIView):
    """Alertas de pagos: conteo rápido para el badge del header."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.loans.models import LoanSchedule
        today = date.today()
        days_ahead = int(request.query_params.get('days', 7))

        qs = LoanSchedule.objects.filter(status__in=['PENDING', 'PARTIAL'])
        branch = request.user.branch
        if branch and not request.user.is_superuser:
            qs = qs.filter(loan__branch=branch)

        upcoming = qs.filter(due_date__range=[today, today + timedelta(days=days_ahead)]).count()
        overdue  = qs.filter(due_date__lt=today).count()

        return Response({
            'upcoming_payments': upcoming,
            'overdue_installments': overdue,
            'total': upcoming + overdue,
        })


class AlertsDetailView(APIView):
    """Detalle completo de alertas: datos del cliente, préstamo, cuota y WhatsApp."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.loans.models import LoanSchedule
        today = date.today()
        days_ahead = int(request.query_params.get('days', 7))
        alert_type = request.query_params.get('type', 'all')  # all | overdue | upcoming

        qs = LoanSchedule.objects.filter(
            status__in=['PENDING', 'PARTIAL']
        ).select_related('loan__customer', 'loan__branch').order_by('due_date')

        branch = request.user.branch
        if branch and not request.user.is_superuser:
            qs = qs.filter(loan__branch=branch)

        if alert_type == 'overdue':
            qs = qs.filter(due_date__lt=today)
        elif alert_type == 'upcoming':
            qs = qs.filter(due_date__range=[today, today + timedelta(days=days_ahead)])
        else:
            qs = qs.filter(
                Q(due_date__lt=today) |
                Q(due_date__range=[today, today + timedelta(days=days_ahead)])
            )

        results = []
        for inst in qs[:50]:
            loan = inst.loan
            customer = loan.customer
            days_overdue = (today - inst.due_date).days if inst.due_date < today else 0
            days_until = (inst.due_date - today).days if inst.due_date >= today else 0
            balance_due = float(inst.total_amount) - float(inst.total_paid)

            # Formatear número de WhatsApp (RD: +1-809/829/849)
            phone = customer.whatsapp or customer.phone1 or ''
            wa_phone = _format_wa_phone(phone)

            results.append({
                'id': str(inst.id),
                'type': 'overdue' if days_overdue > 0 else 'upcoming',
                'loan_number': loan.loan_number,
                'loan_id': str(loan.id),
                'installment_number': inst.installment_number,
                'due_date': inst.due_date.isoformat(),
                'balance_due': balance_due,
                'total_amount': float(inst.total_amount),
                'days_overdue': days_overdue,
                'days_until': days_until,
                'customer_name': customer.get_full_name(),
                'customer_code': customer.customer_code,
                'customer_id': str(customer.id),
                'customer_phone': customer.phone1,
                'customer_whatsapp': customer.whatsapp or customer.phone1,
                'wa_phone': wa_phone,
                'wa_url_reminder': _build_wa_reminder_url(wa_phone, customer, loan, inst, days_overdue, balance_due),
            })

        return Response({
            'count': len(results),
            'today': today.isoformat(),
            'results': results,
        })


class PaymentReceiptWhatsAppView(APIView):
    """Genera la URL de WhatsApp para compartir un recibo de pago."""
    permission_classes = [IsAuthenticated]

    def get(self, request, payment_id):
        from apps.payments.models import Payment
        try:
            payment = Payment.objects.select_related('customer', 'loan').get(pk=payment_id)
        except Payment.DoesNotExist:
            return Response({'detail': 'Pago no encontrado.'}, status=404)

        customer = payment.customer
        phone = customer.whatsapp or customer.phone1 or ''
        wa_phone = _format_wa_phone(phone)

        msg = _build_receipt_message(payment)
        import urllib.parse
        wa_url = f"https://wa.me/{wa_phone}?text={urllib.parse.quote(msg)}"

        return Response({
            'wa_url': wa_url,
            'wa_phone': wa_phone,
            'message': msg,
            'customer_name': customer.get_full_name(),
            'receipt_number': payment.receipt_number,
        })


# ── Helpers ────────────────────────────────────────────────────────────────────

def _format_wa_phone(phone: str) -> str:
    """Convierte teléfono dominicano al formato internacional para wa.me."""
    digits = ''.join(c for c in phone if c.isdigit())
    if not digits:
        return ''
    # Si empieza con 1 y tiene 11 dígitos: ya está en formato +1
    if len(digits) == 11 and digits.startswith('1'):
        return digits
    # Si tiene 10 dígitos (809-XXX-XXXX) → agregar 1
    if len(digits) == 10:
        return '1' + digits
    # Si tiene 7 dígitos → área 809
    if len(digits) == 7:
        return '1809' + digits
    return digits


def _build_wa_reminder_url(wa_phone, customer, loan, inst, days_overdue, balance_due):
    import urllib.parse
    name = customer.get_full_name().split()[0]  # Primer nombre
    fmt_amount = f"RD${balance_due:,.2f}"
    fmt_date = inst.due_date.strftime('%d/%m/%Y')

    if days_overdue > 0:
        msg = (
            f"Estimado/a {name}, le saludamos de CredCore.\n\n"
            f"⚠️ *CUOTA VENCIDA*\n"
            f"────────────────────\n"
            f"📋 Préstamo: {loan.loan_number}\n"
            f"💰 Monto pendiente: *{fmt_amount}*\n"
            f"📅 Venció el: {fmt_date}\n"
            f"⏰ Días de atraso: *{days_overdue} días*\n"
            f"────────────────────\n"
            f"Por favor comuníquese con nosotros para regularizar su situación. "
            f"Gracias por su preferencia. 🙏"
        )
    else:
        fmt_days = f"{inst.days_until if hasattr(inst, 'days_until') else ''}"
        msg = (
            f"Estimado/a {name}, le saludamos de CredCore.\n\n"
            f"📅 *RECORDATORIO DE PAGO*\n"
            f"────────────────────\n"
            f"📋 Préstamo: {loan.loan_number}\n"
            f"💰 Cuota #{inst.installment_number}: *{fmt_amount}*\n"
            f"📅 Vence el: *{fmt_date}*\n"
            f"────────────────────\n"
            f"Realice su pago a tiempo para mantener un buen historial crediticio. "
            f"¡Gracias! 😊"
        )

    if not wa_phone:
        return None
    return f"https://wa.me/{wa_phone}?text={urllib.parse.quote(msg)}"


def _get_company():
    from apps.core.models import CompanySettings
    return CompanySettings.get_solo()


def _build_receipt_message(payment) -> str:
    company = _get_company()
    customer = payment.customer
    loan = payment.loan
    name = customer.get_full_name()
    date_str = payment.payment_date.strftime('%d/%m/%Y') if payment.payment_date else ''
    sym = company.currency_symbol

    method_map = {
        'CASH': 'Efectivo', 'BANK_TRANSFER': 'Transferencia Bancaria',
        'CHECK': 'Cheque', 'CARD': 'Tarjeta',
    }
    method = method_map.get(payment.payment_method, payment.payment_method)

    lines = [
        f"✅ *RECIBO DE PAGO - {company.company_name}*",
        "━━━━━━━━━━━━━━━━━━━━━━━━",
        f"📄 Recibo N°: *{payment.receipt_number}*",
        f"👤 Cliente: {name}",
        f"📋 Préstamo: {loan.loan_number}",
        "━━━━━━━━━━━━━━━━━━━━━━━━",
        f"💰 *Total pagado: {sym}{float(payment.total_amount):,.2f}*",
    ]

    if float(payment.principal_amount) > 0:
        lines.append(f"   • Capital: {sym}{float(payment.principal_amount):,.2f}")
    if float(payment.interest_amount) > 0:
        lines.append(f"   • Interés: {sym}{float(payment.interest_amount):,.2f}")
    if float(payment.late_fee_amount) > 0:
        lines.append(f"   • Mora: {sym}{float(payment.late_fee_amount):,.2f}")

    lines += [
        f"💳 Método: {method}",
        f"📅 Fecha: {date_str}",
        "━━━━━━━━━━━━━━━━━━━━━━━━",
    ]

    if payment.reference_number:
        lines.append(f"🏦 Ref. bancaria: {payment.reference_number}")

    # Saldo actualizado del préstamo
    total_outstanding = (
        float(loan.outstanding_principal) +
        float(loan.outstanding_interest) +
        float(loan.outstanding_late_fees)
    )
    lines += [
        f"📊 Saldo restante: {sym}{total_outstanding:,.2f}",
        f"📈 Cuotas pagadas: {loan.installments_paid}/{loan.installments_paid + loan.installments_remaining}",
        "━━━━━━━━━━━━━━━━━━━━━━━━",
    ]

    if company.receipt_footer:
        lines.append(company.receipt_footer)
    lines.append(f"_{company.company_name}_")
    if company.phone:
        lines.append(f"📞 {company.phone}")

    return "\n".join(lines)


class AmortizationShareView(APIView):
    """Genera tabla de amortización en formato texto para WhatsApp."""
    permission_classes = [IsAuthenticated]

    def get(self, request, loan_id):
        from apps.loans.models import Loan
        try:
            loan = Loan.objects.select_related('customer', 'product').get(pk=loan_id)
        except Loan.DoesNotExist:
            return Response({'detail': 'Préstamo no encontrado.'}, status=404)

        company = _get_company()
        customer = loan.customer
        phone = customer.whatsapp or customer.phone1 or ''
        wa_phone = _format_wa_phone(phone)
        sym = company.currency_symbol
        schedule = loan.schedule.all().order_by('installment_number')

        lines = [
            f"📋 *TABLA DE AMORTIZACIÓN*",
            f"_{company.company_name}_",
            "━━━━━━━━━━━━━━━━━━━━━━━━",
            f"👤 *Cliente:* {customer.get_full_name()}",
            f"📑 *Préstamo:* {loan.loan_number}",
            f"💵 *Capital:* {sym}{float(loan.principal_amount):,.2f}",
            f"📊 *Tasa:* {loan.annual_interest_rate}% anual",
            f"⏰ *Plazo:* {loan.term_months} meses",
            f"💰 *Cuota mensual:* {sym}{float(loan.monthly_payment):,.2f}",
            "━━━━━━━━━━━━━━━━━━━━━━━━",
            "*CUOTAS:*",
        ]

        for s in schedule:
            status_icon = {
                'PAID': '✅', 'PARTIAL': '🔶', 'PENDING': '⏳',
                'OVERDUE': '⚠️', 'WAIVED': '🚫',
            }.get(s.status, '•')
            lines.append(
                f"{status_icon} #{s.installment_number:02d} | "
                f"{s.due_date.strftime('%d/%m/%Y')} | "
                f"{sym}{float(s.total_amount):,.0f}"
            )

        lines += [
            "━━━━━━━━━━━━━━━━━━━━━━━━",
            f"📈 Pagado: {sym}{float(loan.total_paid):,.2f}",
            f"📉 Pendiente: {sym}{float(loan.outstanding_principal + loan.outstanding_interest):,.2f}",
            "━━━━━━━━━━━━━━━━━━━━━━━━",
            f"_{company.company_name}_",
        ]
        if company.phone:
            lines.append(f"📞 {company.phone}")

        message = "\n".join(lines)
        import urllib.parse
        wa_url = f"https://wa.me/{wa_phone}?text={urllib.parse.quote(message)}" if wa_phone else None

        return Response({
            'wa_url': wa_url,
            'wa_phone': wa_phone,
            'message': message,
            'customer_name': customer.get_full_name(),
            'loan_number': loan.loan_number,
            'schedule_count': schedule.count(),
        })


class AccountStatementView(APIView):
    """Genera estado de cuenta completo del préstamo."""
    permission_classes = [IsAuthenticated]

    def get(self, request, loan_id):
        from apps.loans.models import Loan
        from apps.payments.models import Payment
        try:
            loan = Loan.objects.select_related('customer', 'product').get(pk=loan_id)
        except Loan.DoesNotExist:
            return Response({'detail': 'Préstamo no encontrado.'}, status=404)

        company = _get_company()
        customer = loan.customer
        phone = customer.whatsapp or customer.phone1 or ''
        wa_phone = _format_wa_phone(phone)
        sym = company.currency_symbol

        payments = Payment.objects.filter(loan=loan, status='CONFIRMED').order_by('payment_date')
        schedule = loan.schedule.all().order_by('installment_number')

        total_paid = sum(float(p.total_amount) for p in payments)
        total_outstanding = (
            float(loan.outstanding_principal) +
            float(loan.outstanding_interest) +
            float(loan.outstanding_late_fees)
        )

        lines = [
            f"📊 *ESTADO DE CUENTA*",
            f"_{company.company_name}_",
            "━━━━━━━━━━━━━━━━━━━━━━━━",
            f"👤 *Cliente:* {customer.get_full_name()}",
            f"📑 *Préstamo:* {loan.loan_number}",
            f"📅 *Desembolso:* {loan.disbursement_date.strftime('%d/%m/%Y')}",
            f"📅 *Vencimiento:* {loan.maturity_date.strftime('%d/%m/%Y')}",
            "━━━━━━━━━━━━━━━━━━━━━━━━",
            f"💵 Capital original: *{sym}{float(loan.principal_amount):,.2f}*",
            f"📊 Tasa anual: {loan.annual_interest_rate}%",
            f"📈 Total intereses: {sym}{float(loan.total_interest):,.2f}",
            f"💰 Total a pagar: {sym}{float(loan.total_to_pay):,.2f}",
            "━━━━━━━━━━━━━━━━━━━━━━━━",
            f"✅ *PAGADO: {sym}{total_paid:,.2f}*",
            f"⏳ *PENDIENTE: {sym}{total_outstanding:,.2f}*",
            f"📊 Cuotas: {loan.installments_paid} de {loan.installments_paid + loan.installments_remaining}",
        ]

        if loan.days_past_due > 0:
            lines.append(f"⚠️ *MORA: {loan.days_past_due} días*")

        if payments.exists():
            lines += ["━━━━━━━━━━━━━━━━━━━━━━━━", "*HISTORIAL DE PAGOS:*"]
            for p in payments[:15]:  # Últimos 15
                lines.append(
                    f"✓ {p.payment_date.strftime('%d/%m/%Y')} | "
                    f"{p.receipt_number} | {sym}{float(p.total_amount):,.0f}"
                )
            if payments.count() > 15:
                lines.append(f"... y {payments.count() - 15} pagos más")

        # Próxima cuota
        next_inst = schedule.filter(status__in=['PENDING', 'PARTIAL']).first()
        if next_inst:
            lines += [
                "━━━━━━━━━━━━━━━━━━━━━━━━",
                f"📅 *Próximo pago:* {next_inst.due_date.strftime('%d/%m/%Y')}",
                f"💵 Monto: {sym}{float(next_inst.total_amount - next_inst.total_paid):,.2f}",
            ]

        lines += ["━━━━━━━━━━━━━━━━━━━━━━━━"]
        if company.statement_footer:
            lines.append(company.statement_footer)
        lines.append(f"_{company.company_name}_")
        if company.phone:
            lines.append(f"📞 {company.phone}")

        message = "\n".join(lines)
        import urllib.parse
        wa_url = f"https://wa.me/{wa_phone}?text={urllib.parse.quote(message)}" if wa_phone else None

        return Response({
            'wa_url': wa_url,
            'wa_phone': wa_phone,
            'message': message,
            'customer_name': customer.get_full_name(),
            'loan_number': loan.loan_number,
            'total_paid': total_paid,
            'total_outstanding': total_outstanding,
            'payments_count': payments.count(),
        })


class PaymentRecurrenceAnalysisView(APIView):
    """Analiza la recurrencia y regularidad de pagos de un préstamo."""
    permission_classes = [IsAuthenticated]

    def get(self, request, loan_id):
        from apps.loans.models import Loan
        from apps.payments.models import Payment
        from datetime import datetime
        try:
            loan = Loan.objects.get(pk=loan_id)
        except Loan.DoesNotExist:
            return Response({'detail': 'Préstamo no encontrado.'}, status=404)

        payments = list(Payment.objects.filter(loan=loan, status='CONFIRMED').order_by('payment_date'))
        schedule = list(loan.schedule.all().order_by('installment_number'))

        if not schedule:
            return Response({
                'has_data': False,
                'message': 'Préstamo sin tabla de amortización',
            })

        # Análisis cuota por cuota
        on_time = 0
        late = 0
        very_late = 0  # >30 días
        unpaid = 0
        avg_days_late = 0
        total_late_days = 0
        late_count = 0

        for sched_item in schedule:
            if sched_item.status == 'PAID':
                if sched_item.paid_date:
                    diff = (sched_item.paid_date - sched_item.due_date).days
                    if diff <= 0:
                        on_time += 1
                    elif diff <= 30:
                        late += 1
                        total_late_days += diff
                        late_count += 1
                    else:
                        very_late += 1
                        total_late_days += diff
                        late_count += 1
                else:
                    on_time += 1
            elif sched_item.status in ('PENDING', 'PARTIAL'):
                from datetime import date
                if sched_item.due_date < date.today():
                    unpaid += 1

        total_paid_inst = on_time + late + very_late
        if late_count > 0:
            avg_days_late = total_late_days / late_count

        # Clasificación general
        if total_paid_inst == 0:
            classification = 'NEW'
            classification_label = 'Sin historial'
            score = 0
        else:
            on_time_rate = (on_time / total_paid_inst) * 100
            if on_time_rate >= 90 and unpaid == 0:
                classification = 'EXCELLENT'
                classification_label = 'Excelente'
                score = 95
            elif on_time_rate >= 70 and unpaid <= 1:
                classification = 'REGULAR'
                classification_label = 'Pagador Regular'
                score = 75
            elif on_time_rate >= 50:
                classification = 'IRREGULAR'
                classification_label = 'Pagador Irregular'
                score = 50
            else:
                classification = 'POOR'
                classification_label = 'Pagador Deficiente'
                score = 25

        # Frecuencia: días entre pagos
        intervals = []
        for i in range(1, len(payments)):
            diff = (payments[i].payment_date - payments[i-1].payment_date).days
            intervals.append(diff)
        avg_interval = sum(intervals) / len(intervals) if intervals else 0

        # Tendencia: pagos en los últimos 3 meses vs anteriores
        from datetime import date, timedelta
        cutoff = date.today() - timedelta(days=90)
        recent = [p for p in payments if p.payment_date >= cutoff]
        older  = [p for p in payments if p.payment_date < cutoff]

        return Response({
            'has_data': True,
            'loan_number': loan.loan_number,
            'classification': classification,
            'classification_label': classification_label,
            'score': score,
            'on_time': on_time,
            'late': late,
            'very_late': very_late,
            'unpaid': unpaid,
            'total_paid_installments': total_paid_inst,
            'on_time_rate': round((on_time / total_paid_inst * 100) if total_paid_inst else 0, 1),
            'avg_days_late': round(avg_days_late, 1),
            'payments_count': len(payments),
            'avg_payment_interval_days': round(avg_interval, 1),
            'recent_payments_3m': len(recent),
            'older_payments': len(older),
            'recent_amount_3m': sum(float(p.total_amount) for p in recent),
            'monthly_payment': float(loan.monthly_payment),
            'last_payment_date': loan.last_payment_date.isoformat() if loan.last_payment_date else None,
        })


# ── CONFIGURACIÓN DE EMPRESA ──────────────────────────────────────────────────

class CompanySettingsView(APIView):
    """GET/PATCH la configuración global de la empresa."""
    permission_classes = [IsAuthenticated]
    parser_classes = []  # se asignan dinámicamente

    def get_parsers(self):
        from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
        return [JSONParser(), MultiPartParser(), FormParser()]

    @property
    def parser_classes_resolved(self):
        return self.get_parsers()

    def get(self, request):
        from apps.core.models import CompanySettings
        c = CompanySettings.get_solo()
        return Response(_serialize_company(c, request))

    def patch(self, request):
        from apps.core.models import CompanySettings
        c = CompanySettings.get_solo()
        allowed = [
            'company_name', 'legal_name', 'tax_id',
            'address', 'city', 'province', 'country',
            'phone', 'phone2', 'email', 'website', 'whatsapp',
            'bank_accounts', 'currency', 'currency_symbol', 'timezone',
            'receipt_footer', 'statement_footer', 'legal_notice',
            'facebook', 'instagram',
        ]
        for field in allowed:
            if field in request.data:
                setattr(c, field, request.data[field])
        if 'logo' in request.FILES:
            c.logo = request.FILES['logo']
        c.updated_by = request.user
        c.save()
        return Response(_serialize_company(c, request))


def _serialize_company(c, request=None):
    logo_url = None
    if c.logo:
        try:
            # URL relativa para que vaya por proxy /media del frontend
            logo_url = c.logo.url
        except Exception:
            logo_url = None
    return {
        'company_name': c.company_name, 'legal_name': c.legal_name, 'tax_id': c.tax_id,
        'logo': logo_url,
        'address': c.address, 'city': c.city, 'province': c.province, 'country': c.country,
        'phone': c.phone, 'phone2': c.phone2, 'email': c.email, 'website': c.website,
        'whatsapp': c.whatsapp, 'bank_accounts': c.bank_accounts,
        'currency': c.currency, 'currency_symbol': c.currency_symbol, 'timezone': c.timezone,
        'receipt_footer': c.receipt_footer, 'statement_footer': c.statement_footer,
        'legal_notice': c.legal_notice,
        'facebook': c.facebook, 'instagram': c.instagram,
        'updated_at': c.updated_at.isoformat() if c.updated_at else None,
    }


# ── BACKUP DE BASE DE DATOS ───────────────────────────────────────────────────

class BackupConfigView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.core.models import BackupConfig
        c = BackupConfig.get_solo()
        return Response(_serialize_backup_config(c))

    def patch(self, request):
        from apps.core.models import BackupConfig
        c = BackupConfig.get_solo()
        for f in ('enabled', 'frequency', 'time_of_day', 'retention_days', 'notify_emails'):
            if f in request.data:
                setattr(c, f, request.data[f])
        c.save()
        return Response(_serialize_backup_config(c))


def _serialize_backup_config(c):
    tod = c.time_of_day
    if hasattr(tod, 'strftime'):
        tod_str = tod.strftime('%H:%M')
    else:
        tod_str = str(tod)[:5] if tod else '02:00'
    return {
        'enabled': c.enabled, 'frequency': c.frequency,
        'frequency_display': c.get_frequency_display(),
        'time_of_day': tod_str,
        'retention_days': c.retention_days,
        'notify_emails': c.notify_emails,
        'last_run_at': c.last_run_at.isoformat() if c.last_run_at else None,
        'last_status': c.last_status,
        'last_error': c.last_error,
    }


class BackupListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.core.models import BackupRecord
        recs = BackupRecord.objects.all()[:50]
        return Response({
            'count': BackupRecord.objects.count(),
            'results': [_serialize_backup_record(r) for r in recs],
        })


def _serialize_backup_record(r):
    return {
        'id': r.id, 'file_name': r.file_name,
        'file_size_mb': r.file_size_mb, 'status': r.status,
        'status_display': r.get_status_display(), 'trigger': r.trigger,
        'trigger_display': r.get_trigger_display(),
        'started_at': r.started_at.isoformat() if r.started_at else None,
        'completed_at': r.completed_at.isoformat() if r.completed_at else None,
        'duration_seconds': r.duration_seconds, 'error_message': r.error_message,
        'triggered_by_name': r.triggered_by.get_full_name() if r.triggered_by else 'Sistema',
    }


class BackupRunView(APIView):
    """Ejecuta un backup manual ahora mismo."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from apps.core.models import BackupRecord
        from django.conf import settings as django_settings
        from django.utils import timezone
        import os, shutil, time

        if not request.user.is_superuser and not request.user.is_staff:
            return Response({'detail': 'Solo administradores pueden ejecutar backups.'}, status=403)

        ts = timezone.now().strftime('%Y%m%d_%H%M%S')
        file_name = f'credcore_backup_{ts}.sqlite3'

        backups_dir = os.path.join(django_settings.BASE_DIR, 'backups')
        os.makedirs(backups_dir, exist_ok=True)
        dest = os.path.join(backups_dir, file_name)

        record = BackupRecord.objects.create(
            file_name=file_name, file_path=dest,
            trigger='MANUAL', triggered_by=request.user,
        )

        start_time = time.time()
        try:
            db_path = django_settings.DATABASES['default']['NAME']
            if not os.path.exists(db_path):
                raise Exception(f'Archivo de DB no encontrado: {db_path}')

            shutil.copy2(db_path, dest)
            size = os.path.getsize(dest)
            duration = round(time.time() - start_time, 2)

            record.status = 'COMPLETED'
            record.completed_at = timezone.now()
            record.duration_seconds = duration
            record.file_size_bytes = size
            record.save()

            return Response({
                'success': True,
                'message': f'Backup creado: {file_name} ({record.file_size_mb} MB)',
                'record': _serialize_backup_record(record),
            }, status=201)
        except Exception as e:
            record.status = 'FAILED'
            record.error_message = str(e)
            record.completed_at = timezone.now()
            record.save()
            return Response({
                'success': False,
                'message': str(e),
                'record': _serialize_backup_record(record),
            }, status=500)


# ── DESCARGAR BACKUP ─────────────────────────────────────────────────────────

class BackupDownloadView(APIView):
    """Descarga el archivo de un backup específico (solo admins)."""
    permission_classes = [IsAuthenticated]

    def get(self, request, backup_id):
        import os
        from django.http import FileResponse, Http404
        from apps.core.models import BackupRecord

        if not request.user.is_superuser and not request.user.is_staff:
            return Response({'detail': 'Sin permiso.'}, status=403)

        try:
            record = BackupRecord.objects.get(id=backup_id, status='COMPLETED')
        except BackupRecord.DoesNotExist:
            raise Http404('Backup no encontrado.')

        if not record.file_path or not os.path.exists(record.file_path):
            return Response({'detail': 'El archivo ya no existe en el servidor.'}, status=404)

        f = open(record.file_path, 'rb')
        response = FileResponse(f, content_type='application/octet-stream')
        response['Content-Disposition'] = f'attachment; filename="{record.file_name}"'
        response['Content-Length'] = os.path.getsize(record.file_path)
        return response


# ── RESTAURAR BACKUP ─────────────────────────────────────────────────────────

class BackupRestoreView(APIView):
    """Restaura la base de datos desde un archivo .sqlite3 subido."""
    permission_classes = [IsAuthenticated]

    def get_parsers(self):
        from rest_framework.parsers import MultiPartParser, FormParser
        return [MultiPartParser(), FormParser()]

    def post(self, request):
        import os, shutil, time
        from django.conf import settings as django_settings
        from django.utils import timezone as tz

        if not request.user.is_superuser:
            return Response({'detail': 'Solo superadministradores pueden restaurar backups.'}, status=403)

        backup_file = request.FILES.get('backup_file')
        if not backup_file:
            return Response({'detail': 'Debes subir el archivo de backup (.sqlite3).'}, status=400)

        if not backup_file.name.endswith('.sqlite3'):
            return Response({'detail': 'Solo se aceptan archivos .sqlite3'}, status=400)

        db_path = django_settings.DATABASES['default'].get('NAME', '')
        if not db_path or not str(db_path).endswith('.sqlite3'):
            return Response({'detail': 'La restauración solo está disponible con SQLite.'}, status=400)

        db_path = str(db_path)

        # 1. Guardar copia de emergencia del estado actual
        ts = tz.now().strftime('%Y%m%d_%H%M%S')
        backups_dir = os.path.join(django_settings.BASE_DIR, 'backups')
        os.makedirs(backups_dir, exist_ok=True)
        emergency_path = os.path.join(backups_dir, f'pre_restore_{ts}.sqlite3')

        try:
            shutil.copy2(db_path, emergency_path)
        except Exception as e:
            return Response({'detail': f'No se pudo hacer copia de seguridad antes de restaurar: {e}'}, status=500)

        # 2. Guardar el archivo subido en temporal
        tmp_path = os.path.join(backups_dir, f'restore_tmp_{ts}.sqlite3')
        try:
            with open(tmp_path, 'wb') as f:
                for chunk in backup_file.chunks():
                    f.write(chunk)

            # 3. Validar que es una DB SQLite válida
            import sqlite3
            conn = sqlite3.connect(tmp_path)
            tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
            conn.close()
            if len(tables) < 3:
                os.remove(tmp_path)
                return Response({'detail': 'El archivo no parece una base de datos válida de CredCore.'}, status=400)

            # 4. Reemplazar la DB actual
            shutil.copy2(tmp_path, db_path)
            os.remove(tmp_path)

            return Response({
                'success': True,
                'message': f'Base de datos restaurada exitosamente. Se guardó copia de emergencia: pre_restore_{ts}.sqlite3',
                'tables_found': len(tables),
                'emergency_backup': f'pre_restore_{ts}.sqlite3',
            })

        except Exception as e:
            # Revertir si algo falló
            try:
                shutil.copy2(emergency_path, db_path)
            except Exception:
                pass
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
            return Response({'detail': f'Error restaurando: {e}'}, status=500)


# ── INGRESOS POR PERÍODO ─────────────────────────────────────────────────────

class EarningsView(APIView):
    """
    Ingresos por intereses: resumen diario / semanal / mensual.
    Los ingresos se calculan desde Payment.interest_amount (pagos confirmados).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.payments.models import Payment
        from django.db.models.functions import TruncDay, TruncWeek, TruncMonth

        today = date.today()
        branch = request.user.branch

        base_qs = Payment.objects.filter(status='CONFIRMED')
        if branch and not request.user.is_superuser:
            base_qs = base_qs.filter(loan__branch=branch)

        # ── Resumen rápido ──────────────────────────────────────────────────
        week_start = today - timedelta(days=today.weekday())
        month_start = today.replace(day=1)
        year_start = today.replace(month=1, day=1)

        summary = base_qs.aggregate(
            today_interest=Sum('interest_amount', filter=Q(payment_date=today)),
            today_principal=Sum('principal_amount', filter=Q(payment_date=today)),
            today_total=Sum('total_amount', filter=Q(payment_date=today)),
            week_interest=Sum('interest_amount', filter=Q(payment_date__gte=week_start)),
            week_total=Sum('total_amount', filter=Q(payment_date__gte=week_start)),
            month_interest=Sum('interest_amount', filter=Q(payment_date__gte=month_start)),
            month_total=Sum('total_amount', filter=Q(payment_date__gte=month_start)),
            year_interest=Sum('interest_amount', filter=Q(payment_date__gte=year_start)),
            year_total=Sum('total_amount', filter=Q(payment_date__gte=year_start)),
        )

        def f(v):
            return float(v) if v else 0.0

        # ── Ingresos diarios — últimos 30 días ──────────────────────────────
        daily_start = today - timedelta(days=29)
        daily_raw = (
            base_qs
            .filter(payment_date__gte=daily_start)
            .annotate(period=TruncDay('payment_date'))
            .values('period')
            .annotate(
                interest=Sum('interest_amount'),
                principal=Sum('principal_amount'),
                total=Sum('total_amount'),
                count=Count('id'),
            )
            .order_by('period')
        )
        # Rellenar días sin pagos con cero
        daily_map = {
            r['period'].date() if hasattr(r['period'], 'date') else r['period']: r
            for r in daily_raw
        }
        daily = []
        for i in range(30):
            d = daily_start + timedelta(days=i)
            r = daily_map.get(d)
            daily.append({
                'date': d.isoformat(),
                'label': d.strftime('%d/%m'),
                'interest': f(r['interest']) if r else 0,
                'principal': f(r['principal']) if r else 0,
                'total': f(r['total']) if r else 0,
                'count': r['count'] if r else 0,
            })

        # ── Ingresos semanales — últimas 12 semanas ─────────────────────────
        weekly_start = today - timedelta(weeks=12)
        weekly_raw = (
            base_qs
            .filter(payment_date__gte=weekly_start)
            .annotate(period=TruncWeek('payment_date'))
            .values('period')
            .annotate(
                interest=Sum('interest_amount'),
                principal=Sum('principal_amount'),
                total=Sum('total_amount'),
                count=Count('id'),
            )
            .order_by('period')
        )
        weekly = []
        for r in weekly_raw:
            d = r['period'].date() if hasattr(r['period'], 'date') else r['period']
            weekly.append({
                'date': d.isoformat(),
                'label': f"Sem. {d.strftime('%d/%m')}",
                'interest': f(r['interest']),
                'principal': f(r['principal']),
                'total': f(r['total']),
                'count': r['count'],
            })

        # ── Ingresos mensuales — últimos 12 meses ───────────────────────────
        monthly_start = (today.replace(day=1) - timedelta(days=365)).replace(day=1)
        monthly_raw = (
            base_qs
            .filter(payment_date__gte=monthly_start)
            .annotate(period=TruncMonth('payment_date'))
            .values('period')
            .annotate(
                interest=Sum('interest_amount'),
                principal=Sum('principal_amount'),
                total=Sum('total_amount'),
                count=Count('id'),
            )
            .order_by('period')
        )
        MONTHS_ES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
                     'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
        monthly = []
        for r in monthly_raw:
            d = r['period'].date() if hasattr(r['period'], 'date') else r['period']
            monthly.append({
                'date': d.isoformat(),
                'label': f"{MONTHS_ES[d.month]} {d.year}",
                'interest': f(r['interest']),
                'principal': f(r['principal']),
                'total': f(r['total']),
                'count': r['count'],
            })

        return Response({
            'summary': {
                'today_interest':  f(summary['today_interest']),
                'today_principal': f(summary['today_principal']),
                'today_total':     f(summary['today_total']),
                'week_interest':   f(summary['week_interest']),
                'week_total':      f(summary['week_total']),
                'month_interest':  f(summary['month_interest']),
                'month_total':     f(summary['month_total']),
                'year_interest':   f(summary['year_interest']),
                'year_total':      f(summary['year_total']),
            },
            'daily':   daily,
            'weekly':  weekly,
            'monthly': monthly,
        })


# ── PANEL DE INVERSIONISTAS ──────────────────────────────────────────────────
class InvestorDashboardView(APIView):
    """
    Dashboard ejecutivo para inversionistas / socios.
    Muestra métricas de rentabilidad, portafolio, riesgo y ROI.
    Solo accesible para superadmins.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not request.user.is_superuser and not request.user.is_staff:
            return Response({'detail': 'Acceso restringido.'}, status=403)

        from apps.loans.models import Loan
        from apps.payments.models import Payment
        from apps.customers.models import Customer
        from apps.branches.models import Branch

        today = date.today()
        month_start = today.replace(day=1)
        year_start  = today.replace(month=1, day=1)

        loans_qs = Loan.objects.filter(is_deleted=False)
        active   = loans_qs.filter(status='ACTIVE')
        pays_qs  = Payment.objects.filter(status='CONFIRMED')

        def f(v): return float(v) if v else 0.0

        # Totales del portafolio
        total_disbursed = f(loans_qs.aggregate(t=Sum('principal_amount'))['t'])
        total_portfolio = f(active.aggregate(t=Sum('outstanding_principal'))['t'])
        total_collected = f(pays_qs.aggregate(t=Sum('total_amount'))['t'])
        total_interest  = f(pays_qs.aggregate(t=Sum('interest_amount'))['t'])
        total_principal_back = f(pays_qs.aggregate(t=Sum('principal_amount'))['t'])

        # Cobros del año y mes
        year_collected  = f(pays_qs.filter(payment_date__gte=year_start).aggregate(t=Sum('total_amount'))['t'])
        year_interest   = f(pays_qs.filter(payment_date__gte=year_start).aggregate(t=Sum('interest_amount'))['t'])
        month_collected = f(pays_qs.filter(payment_date__gte=month_start).aggregate(t=Sum('total_amount'))['t'])
        month_interest  = f(pays_qs.filter(payment_date__gte=month_start).aggregate(t=Sum('interest_amount'))['t'])

        # ROI = (interés cobrado / capital desembolsado) * 100
        roi_total = round(total_interest / total_disbursed * 100, 2) if total_disbursed > 0 else 0
        roi_year  = round(year_interest / total_disbursed * 100, 2) if total_disbursed > 0 else 0

        # Mora y riesgo
        overdue = active.filter(days_past_due__gt=0)
        overdue_amount = f(overdue.aggregate(t=Sum('outstanding_principal'))['t'])
        delinquency = round(overdue_amount / total_portfolio * 100, 2) if total_portfolio > 0 else 0

        # Rendimiento por sucursal
        branches = []
        for b in Branch.objects.filter(is_active=True):
            b_loans = active.filter(branch=b)
            b_pays  = pays_qs.filter(loan__branch=b, payment_date__gte=month_start)
            b_port  = f(b_loans.aggregate(t=Sum('outstanding_principal'))['t'])
            b_int   = f(b_pays.aggregate(t=Sum('interest_amount'))['t'])
            b_total = f(b_pays.aggregate(t=Sum('total_amount'))['t'])
            b_mora  = f(b_loans.filter(days_past_due__gt=0).aggregate(t=Sum('outstanding_principal'))['t'])
            branches.append({
                'id': b.id, 'name': b.name,
                'active_loans': b_loans.count(),
                'portfolio': b_port,
                'month_interest': b_int,
                'month_collected': b_total,
                'overdue_amount': b_mora,
                'delinquency': round(b_mora / b_port * 100, 2) if b_port > 0 else 0,
            })

        # Proyección mensual (promedio últimos 3 meses)
        three_months_ago = (today.replace(day=1) - timedelta(days=90)).replace(day=1)
        avg_monthly = f(
            pays_qs.filter(payment_date__gte=three_months_ago)
                   .aggregate(t=Sum('interest_amount'))['t']
        ) / 3

        # Licencia
        from apps.core.models import CompanySettings
        company = CompanySettings.get_solo()

        return Response({
            'kpis': {
                'total_capital_invested':  total_disbursed,
                'total_portfolio':         total_portfolio,
                'total_collected':         total_collected,
                'total_interest_earned':   total_interest,
                'total_principal_recovered': total_principal_back,
                'roi_total_pct':           roi_total,
                'roi_year_pct':            roi_year,
                'delinquency_pct':         delinquency,
                'overdue_amount':          overdue_amount,
                'active_loans':            active.count(),
                'active_customers':        Customer.objects.filter(status='ACTIVE', is_deleted=False).count(),
                'year_interest':           year_interest,
                'year_collected':          year_collected,
                'month_interest':          month_interest,
                'month_collected':         month_collected,
                'avg_monthly_projection':  round(avg_monthly, 2),
            },
            'branches': branches,
            'license': {
                'plan':    company.license_plan,
                'expires': company.license_expires.isoformat() if company.license_expires else None,
                'max_branches': company.max_branches,
                'max_users':    company.max_users,
                'current_branches': Branch.objects.filter(is_active=True).count(),
                'current_users':    request.user.__class__.objects.filter(is_active=True).count(),
            },
            'exchange_rate': {
                'primary':   f'{company.currency_symbol} ({company.currency})',
                'secondary': f'{company.secondary_currency_symbol} ({company.secondary_currency})' if company.secondary_currency else None,
                'rate':      float(company.exchange_rate) if company.exchange_rate else 0,
            },
            'generated_at': today.isoformat(),
        })
